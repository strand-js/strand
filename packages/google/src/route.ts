import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateId, validateMessages, RateLimiter } from '@strand-js/core'
import type { StrandHandlerConfig } from './handler'
import { toolToGoogleTool, messagesToGoogleMessages } from './format'

function sseChunk(eventType: string, data: object): Uint8Array {
  return new TextEncoder().encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function createStrandRoute(
  config: StrandHandlerConfig,
): (req: Request) => Promise<Response> {
  const genAI = new GoogleGenerativeAI(config.apiKey)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleTools = (config.tools ?? []).map(toolToGoogleTool) as any[]
  const maxSteps = config.maxSteps ?? 10
  const rateLimiter = config.rateLimit ? new RateLimiter(config.rateLimit) : null

  return async (req: Request): Promise<Response> => {
    // ── 0. Rate limiting ─────────────────────────────────────────────────
    if (rateLimiter) {
      const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
      const limited = rateLimiter.check(ip)
      if (limited) {
        return new Response(JSON.stringify({ error: 'Too many requests', retryAfter: limited.retryAfter }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(limited.retryAfter) },
        })
      }
    }

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

          const model = genAI.getGenerativeModel({
            model: config.model,
            ...(system ? { systemInstruction: system } : {}),
            ...(googleTools.length > 0 ? { tools: googleTools } : {}),
          })

          const allMessages = messages.map(m => ({
            id: generateId(),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: new Date(),
          }))

          const history = messagesToGoogleMessages(allMessages.slice(0, -1))
          const lastMessage = allMessages.at(-1)?.content ?? ''
          const chat = model.startChat({ history })

          let totalInput = 0
          let totalOutput = 0

          for (let step = 0; step < maxSteps; step++) {
            const result = await chat.sendMessageStream(lastMessage)
            let pendingFunctionCall: { name: string; args: Record<string, unknown> } | null = null

            for await (const chunk of result.stream) {
              const candidate = chunk.candidates?.[0]
              if (!candidate) continue
              for (const part of candidate.content?.parts ?? []) {
                if ('text' in part && part.text) emit('strand:text-delta', { delta: part.text })
                if ('functionCall' in part && part.functionCall) {
                  const fc = part.functionCall
                  pendingFunctionCall = { name: fc.name, args: fc.args as Record<string, unknown> }
                  const toolCallId = generateId()
                  emit('strand:tool-start', { toolCallId, toolName: fc.name })
                  emit('strand:tool-input-done', { toolCallId, input: fc.args })
                }
              }
              if (chunk.usageMetadata) {
                totalInput = chunk.usageMetadata.promptTokenCount ?? totalInput
                totalOutput = chunk.usageMetadata.candidatesTokenCount ?? totalOutput
              }
            }

            const response = await result.response
            const finishReason = response.candidates?.[0]?.finishReason

            if (!pendingFunctionCall || finishReason === 'STOP') {
              emit('strand:done', { usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput } })
              break
            }

            const toolCallId = generateId()
            try {
              const toolResult = await config.onToolCall?.(pendingFunctionCall.name, pendingFunctionCall.args, { request: req })
              emit('strand:tool-result', { toolCallId, result: toolResult })
              await chat.sendMessageStream([{ functionResponse: { name: pendingFunctionCall.name, response: { result: toolResult } } }])
              continue
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Tool execution failed'
              emit('strand:tool-error', { toolCallId, error: message })
              break
            }
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
