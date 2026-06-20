import Anthropic from '@anthropic-ai/sdk'
import { generateId, validateMessages } from '@strand/core'
import type { StrandHandlerConfig } from './handler'
import { toolToAnthropicTool } from './format'

interface ToolAccumulator {
  id: string
  name: string
  inputJson: string
}

function sseChunk(eventType: string, data: object): Uint8Array {
  return new TextEncoder().encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function createStrandRoute(
  config: StrandHandlerConfig,
): (req: Request) => Promise<Response> {
  const client = new Anthropic({ apiKey: config.apiKey })
  const anthropicTools = (config.tools ?? []).map(toolToAnthropicTool)
  const maxSteps = config.maxSteps ?? 10

  return async (req: Request): Promise<Response> => {
    const body = await req.json() as { messages?: unknown; context?: Record<string, unknown> }

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

          const conversation: Anthropic.MessageParam[] = messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))

          let totalInput = 0
          let totalOutput = 0

          for (let step = 0; step < maxSteps; step++) {
            const anthropicStream = await client.messages.create({
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

            for await (const event of anthropicStream) {
              if (event.type === 'message_start' && event.message.usage) totalInput += event.message.usage.input_tokens
              if (event.type === 'content_block_start') {
                const block = event.content_block
                if (block.type === 'text') assistantContent.push({ type: 'text', text: '', citations: null })
                if (block.type === 'tool_use') {
                  currentTool = { id: block.id, name: block.name, inputJson: '' }
                  emit('strand:tool-start', { toolCallId: block.id, toolName: block.name })
                }
              }
              if (event.type === 'content_block_delta') {
                const delta = event.delta
                if (delta.type === 'text_delta') {
                  const last = assistantContent.at(-1)
                  if (last?.type === 'text') last.text += delta.text
                  emit('strand:text-delta', { delta: delta.text })
                }
                if (delta.type === 'input_json_delta' && currentTool) {
                  currentTool.inputJson += delta.partial_json
                  emit('strand:tool-input-delta', { toolCallId: currentTool.id, delta: delta.partial_json })
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
              emit('strand:done', { usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput } })
              break
            }

            if (stopReason === 'tool_use' && completedTools.length > 0) {
              conversation.push({ role: 'assistant', content: assistantContent })
              const results = await Promise.all(
                completedTools.map(async (block: { id: string; name: string; input: Record<string, unknown> }) => {
                  emit('strand:tool-input-done', { toolCallId: block.id, input: block.input })
                  try {
                    const result = await config.onToolCall?.(block.name, block.input, { request: req })
                    emit('strand:tool-result', { toolCallId: block.id, result })
                    return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result ?? null) }
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Tool execution failed'
                    emit('strand:tool-error', { toolCallId: block.id, error: message })
                    return { type: 'tool_result' as const, tool_use_id: block.id, content: message, is_error: true }
                  }
                }),
              )
              conversation.push({ role: 'user', content: results })
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
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }
}
