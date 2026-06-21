import Anthropic from '@anthropic-ai/sdk'
import type { ToolDefinition, Session } from '@strand-js/core'
import { generateId, validateMessages, RateLimiter } from '@strand-js/core'
import type { RateLimitConfig } from '@strand-js/core'
import { toolToAnthropicTool } from './format'

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
  rateLimit?: RateLimitConfig  // built-in rate limiting by IP
  maxMessages?: number         // default: 100 — reject requests with more messages
  maxMessageLength?: number    // default: 50_000 — reject messages with more chars
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

interface ToolAccumulator {
  id: string
  name: string
  inputJson: string
}

function emit(res: AnyRes, eventType: string, data: object): void {
  res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
}

// Wraps an Express req so request.headers.get() works like the Web API Request
function normalizeRequest(req: AnyReq): Request {
  const rawHeaders = (req.headers ?? {}) as Record<string, string | string[] | undefined>
  const normalized = {
    ...req,
    headers: {
      get: (name: string): string | null => {
        const val = rawHeaders[name.toLowerCase()]
        return Array.isArray(val) ? (val[0] ?? null) : (val ?? null)
      },
    },
  }
  return normalized as unknown as Request
}

export function createStrandHandler(
  config: StrandHandlerConfig,
): (req: AnyReq, res: AnyRes) => Promise<void> {
  const client = new Anthropic({ apiKey: config.apiKey })
  const anthropicTools = (config.tools ?? []).map(toolToAnthropicTool)
  const maxSteps = config.maxSteps ?? 10
  const rateLimiter = config.rateLimit ? new RateLimiter(config.rateLimit) : null

  return async (req: AnyReq, res: AnyRes) => {
    const normalizedReq = normalizeRequest(req)
    const body = req.body as { messages?: unknown; context?: Record<string, unknown> }

    // ── 0. Rate limiting ───────────────────────────────────────────────────
    if (rateLimiter) {
      const ip = (req as Record<string, unknown>).ip as string ?? 'unknown'
      const limited = rateLimiter.check(ip)
      if (limited) {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: limited.retryAfter,
        })
        return
      }
    }

    // ── 1. Validate input before any SSE headers ───────────────────────────
    const validation = validateMessages(body?.messages, {
      maxMessages: config.maxMessages,
      maxMessageLength: config.maxMessageLength,
    })
    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.error })
      return
    }

    // ── 2. Authorize ───────────────────────────────────────────────────────
    if (config.authorize) {
      try {
        await config.authorize(normalizedReq)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unauthorized'
        res.status(401).json({ error: message })
        return
      }
    }

    // ── 3. Stream ──────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    emit(res, 'strand:start', { sessionId: generateId(), requestId: generateId() })

    try {
      const messages = body.messages as Array<{ role: string; content: string }>

      const system =
        typeof config.system === 'function'
          ? await config.system(normalizedReq)
          : (config.system ?? '')

      const conversation: Anthropic.MessageParam[] = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      let totalInput = 0
      let totalOutput = 0

      for (let step = 0; step < maxSteps; step++) {
        const stream = await client.messages.create({
          model: config.model,
          max_tokens: 8192,
          ...(system ? { system } : {}),
          messages: conversation,
          ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
          stream: true,
        })

        let stopReason: string | null = null
        let currentTool: ToolAccumulator | null = null
        const completedTools: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
        const assistantContent: Anthropic.ContentBlock[] = []

        for await (const event of stream) {
          if (event.type === 'message_start' && event.message.usage) {
            totalInput += event.message.usage.input_tokens
          }
          if (event.type === 'content_block_start') {
            const block = event.content_block
            if (block.type === 'text') assistantContent.push({ type: 'text', text: '', citations: null })
            if (block.type === 'tool_use') {
              currentTool = { id: block.id, name: block.name, inputJson: '' }
              emit(res, 'strand:tool-start', { toolCallId: block.id, toolName: block.name })
            }
          }
          if (event.type === 'content_block_delta') {
            const delta = event.delta
            if (delta.type === 'text_delta') {
              const last = assistantContent.at(-1)
              if (last?.type === 'text') last.text += delta.text
              emit(res, 'strand:text-delta', { delta: delta.text })
            }
            if (delta.type === 'input_json_delta' && currentTool) {
              currentTool.inputJson += delta.partial_json
              emit(res, 'strand:tool-input-delta', { toolCallId: currentTool.id, delta: delta.partial_json })
            }
          }
          if (event.type === 'content_block_stop' && currentTool) {
            const input = JSON.parse(currentTool.inputJson || '{}') as Record<string, unknown>
            completedTools.push({ id: currentTool.id, name: currentTool.name, input })
            assistantContent.push({ type: 'tool_use', id: currentTool.id, name: currentTool.name, input })
            currentTool = null
          }
          if (event.type === 'message_delta') {
            stopReason = event.delta.stop_reason ?? null
            if (event.usage) totalOutput += event.usage.output_tokens
          }
        }

        if (stopReason === 'end_turn' || stopReason === 'max_tokens') {
          emit(res, 'strand:done', { usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput } })
          res.end()
          return
        }

        if (stopReason === 'tool_use' && completedTools.length > 0) {
          conversation.push({ role: 'assistant', content: assistantContent })
          const toolResults = await Promise.all(
            completedTools.map(async block => {
              emit(res, 'strand:tool-input-done', { toolCallId: block.id, input: block.input })
              try {
                const result = await config.onToolCall?.(block.name, block.input, { request: normalizedReq })
                emit(res, 'strand:tool-result', { toolCallId: block.id, result })
                return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result ?? null) }
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Tool execution failed'
                emit(res, 'strand:tool-error', { toolCallId: block.id, error: message })
                return { type: 'tool_result' as const, tool_use_id: block.id, content: message, is_error: true }
              }
            }),
          )
          conversation.push({ role: 'user', content: toolResults })
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
