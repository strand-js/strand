import OpenAI from 'openai'
import { generateId, validateMessages } from '@strand-js/core'
import type { StrandHandlerConfig } from './handler'
import { toolToOpenAITool } from './format'

function sseChunk(eventType: string, data: object): Uint8Array {
  return new TextEncoder().encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function createStrandRoute(
  config: StrandHandlerConfig,
): (req: Request) => Promise<Response> {
  const client = new OpenAI({ apiKey: config.apiKey })
  const openAITools = (config.tools ?? []).map(toolToOpenAITool)
  const maxSteps = config.maxSteps ?? 10

  return async (req: Request): Promise<Response> => {
    const body = await req.json() as { messages?: unknown }

    // ── 1. Validate input ────────────────────────────────────────────────
    const validation = validateMessages(body?.messages, {
      maxMessages: config.maxMessages,
      maxMessageLength: config.maxMessageLength,
    })
    if (!validation.ok) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: validation.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Authorize ─────────────────────────────────────────────────────
    if (config.authorize) {
      try {
        await config.authorize(req)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unauthorized'
        return new Response(JSON.stringify({ error: message }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // ── 3. Stream ────────────────────────────────────────────────────────
    const messages = body.messages as Array<{ role: string; content: string }>

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (eventType: string, data: object) =>
          controller.enqueue(sseChunk(eventType, data))

        emit('strand:start', { sessionId: generateId(), requestId: generateId() })

        try {
          const system =
            typeof config.system === 'function'
              ? await config.system(req)
              : (config.system ?? '')

          const conversation: OpenAI.ChatCompletionMessageParam[] = [
            ...(system ? [{ role: 'system' as const, content: system }] : []),
            ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          ]

          let totalInput = 0
          let totalOutput = 0

          for (let step = 0; step < maxSteps; step++) {
            const openAIStream = await client.chat.completions.create({
              model: config.model,
              messages: conversation,
              ...(openAITools.length > 0 ? { tools: openAITools } : {}),
              stream: true,
              stream_options: { include_usage: true },
            })

            let finishReason: string | null = null
            const toolCallAccumulator = new Map<number, { id: string; name: string; argsJson: string }>()

            for await (const chunk of openAIStream) {
              const choice = chunk.choices[0]
              if (!choice) {
                if (chunk.usage) { totalInput += chunk.usage.prompt_tokens; totalOutput += chunk.usage.completion_tokens }
                continue
              }
              const delta = choice.delta
              if (delta.content) emit('strand:text-delta', { delta: delta.content })
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.id) {
                    toolCallAccumulator.set(tc.index, { id: tc.id, name: tc.function?.name ?? '', argsJson: '' })
                    emit('strand:tool-start', { toolCallId: tc.id, toolName: tc.function?.name ?? '' })
                  }
                  if (tc.function?.arguments) {
                    const acc = toolCallAccumulator.get(tc.index)
                    if (acc) { acc.argsJson += tc.function.arguments; emit('strand:tool-input-delta', { toolCallId: acc.id, delta: tc.function.arguments }) }
                  }
                }
              }
              if (choice.finish_reason) finishReason = choice.finish_reason
            }

            if (finishReason === 'stop') {
              emit('strand:done', { usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput } })
              break
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
              const results = await Promise.all(
                completedTools.map(async block => {
                  emit('strand:tool-input-done', { toolCallId: block.id, input: block.input })
                  try {
                    const result = await config.onToolCall?.(block.name, block.input, { request: req })
                    emit('strand:tool-result', { toolCallId: block.id, result })
                    return { role: 'tool' as const, tool_call_id: block.id, content: JSON.stringify(result ?? null) }
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Tool execution failed'
                    emit('strand:tool-error', { toolCallId: block.id, error: message })
                    return { role: 'tool' as const, tool_call_id: block.id, content: message }
                  }
                }),
              )
              conversation.push(...results)
              continue
            }

            emit('strand:done', { usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput } })
            break
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Internal server error'
          emit('strand:error', { code: 'server_error', message })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    })
  }
}
