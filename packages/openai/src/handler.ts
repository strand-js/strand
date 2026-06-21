import OpenAI from 'openai'
import type { ToolDefinition, Session } from '@strandjs/core'
import { generateId, validateMessages } from '@strandjs/core'
import { toolToOpenAITool } from './format'

export interface StrandHandlerConfig {
  apiKey: string
  model: string
  system?: string | ((request: Request) => string | Promise<string>)
  tools?: ToolDefinition[]
  onToolCall?: (
    name: string,
    args: Record<string, unknown>,
    ctx: { request: Request },
  ) => Promise<unknown>
  // Security
  authorize?: (request: Request) => Promise<unknown> | unknown
  maxMessages?: number        // default: 100
  maxMessageLength?: number   // default: 50_000
  // Lifecycle
  maxSteps?: number
  onRequest?: (req: Request) => void
  onFinish?: (session: Session) => void
}

type AnyReq = Record<string, unknown>
type AnyRes = {
  setHeader(name: string, value: string): void
  status(code: number): AnyRes
  json(body: unknown): void
  write(chunk: string): void
  end(): void
}

function emit(res: AnyRes, eventType: string, data: object): void {
  res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function createStrandHandler(
  config: StrandHandlerConfig,
): (req: AnyReq, res: AnyRes) => Promise<void> {
  const client = new OpenAI({ apiKey: config.apiKey })
  const openAITools = (config.tools ?? []).map(toolToOpenAITool)
  const maxSteps = config.maxSteps ?? 10

  return async (req: AnyReq, res: AnyRes) => {
    const body = req.body as { messages?: unknown }

    // ── 1. Validate input ────────────────────────────────────────────────
    const validation = validateMessages(body?.messages, {
      maxMessages: config.maxMessages,
      maxMessageLength: config.maxMessageLength,
    })
    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.error })
      return
    }

    // ── 2. Authorize ─────────────────────────────────────────────────────
    if (config.authorize) {
      try {
        await config.authorize(req as unknown as Request)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unauthorized'
        res.status(401).json({ error: message })
        return
      }
    }

    // ── 3. Stream ────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    emit(res, 'strand:start', { sessionId: generateId(), requestId: generateId() })

    try {
      const messages = body.messages as Array<{ role: string; content: string }>

      const system =
        typeof config.system === 'function'
          ? await config.system(req as unknown as Request)
          : (config.system ?? '')

      const conversation: OpenAI.ChatCompletionMessageParam[] = [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ]

      let totalInput = 0
      let totalOutput = 0

      for (let step = 0; step < maxSteps; step++) {
        const stream = await client.chat.completions.create({
          model: config.model,
          messages: conversation,
          ...(openAITools.length > 0 ? { tools: openAITools } : {}),
          stream: true,
          stream_options: { include_usage: true },
        })

        let finishReason: string | null = null
        const toolCallAccumulator = new Map<number, { id: string; name: string; argsJson: string }>()

        for await (const chunk of stream) {
          const choice = chunk.choices[0]
          if (!choice) {
            if (chunk.usage) { totalInput += chunk.usage.prompt_tokens; totalOutput += chunk.usage.completion_tokens }
            continue
          }
          const delta = choice.delta
          if (delta.content) emit(res, 'strand:text-delta', { delta: delta.content })
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                toolCallAccumulator.set(tc.index, { id: tc.id, name: tc.function?.name ?? '', argsJson: '' })
                emit(res, 'strand:tool-start', { toolCallId: tc.id, toolName: tc.function?.name ?? '' })
              }
              if (tc.function?.arguments) {
                const acc = toolCallAccumulator.get(tc.index)
                if (acc) { acc.argsJson += tc.function.arguments; emit(res, 'strand:tool-input-delta', { toolCallId: acc.id, delta: tc.function.arguments }) }
              }
            }
          }
          if (choice.finish_reason) finishReason = choice.finish_reason
        }

        if (finishReason === 'stop') {
          emit(res, 'strand:done', { usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput } })
          res.end()
          return
        }

        if (finishReason === 'tool_calls' && toolCallAccumulator.size > 0) {
          const completedTools = Array.from(toolCallAccumulator.values()).map(acc => ({
            id: acc.id, name: acc.name,
            input: JSON.parse(acc.argsJson || '{}') as Record<string, unknown>,
          }))
          conversation.push({
            role: 'assistant', content: null,
            tool_calls: completedTools.map(tc => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: JSON.stringify(tc.input) } })),
          })
          const toolResults = await Promise.all(
            completedTools.map(async block => {
              emit(res, 'strand:tool-input-done', { toolCallId: block.id, input: block.input })
              try {
                const result = await config.onToolCall?.(block.name, block.input, { request: req as unknown as Request })
                emit(res, 'strand:tool-result', { toolCallId: block.id, result })
                return { role: 'tool' as const, tool_call_id: block.id, content: JSON.stringify(result ?? null) }
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Tool execution failed'
                emit(res, 'strand:tool-error', { toolCallId: block.id, error: message })
                return { role: 'tool' as const, tool_call_id: block.id, content: message }
              }
            }),
          )
          conversation.push(...toolResults)
          continue
        }

        break
      }

      emit(res, 'strand:done', { usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput } })
      res.end()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      emit(res, 'strand:error', { code: 'server_error', message })
      res.end()
    }
  }
}
