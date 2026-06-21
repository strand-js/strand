import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ToolDefinition, Session } from '@strand-js/core'
import { generateId, validateMessages, RateLimiter } from '@strand-js/core'
import type { RateLimitConfig } from '@strand-js/core'
import { toolToGoogleTool, messagesToGoogleMessages } from './format'

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
  rateLimit?: RateLimitConfig
  maxMessages?: number
  maxMessageLength?: number
  // Lifecycle
  maxSteps?: number
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

function normalizeRequest(req: AnyReq): Request {
  const rawHeaders = (req.headers ?? {}) as Record<string, string | string[] | undefined>
  return {
    ...req,
    headers: {
      get: (name: string): string | null => {
        const val = rawHeaders[name.toLowerCase()]
        return Array.isArray(val) ? (val[0] ?? null) : (val ?? null)
      },
    },
  } as unknown as Request
}

export function createStrandHandler(
  config: StrandHandlerConfig,
): (req: AnyReq, res: AnyRes) => Promise<void> {
  const genAI = new GoogleGenerativeAI(config.apiKey)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleTools = (config.tools ?? []).map(toolToGoogleTool) as any[]
  const maxSteps = config.maxSteps ?? 10
  const rateLimiter = config.rateLimit ? new RateLimiter(config.rateLimit) : null

  return async (req: AnyReq, res: AnyRes) => {
    const normalizedReq = normalizeRequest(req)
    const body = req.body as { messages?: unknown }

    // ── 0. Rate limiting ────────────────────────────────────────────────
    if (rateLimiter) {
      const ip = (req as Record<string, unknown>).ip as string ?? 'unknown'
      const limited = rateLimiter.check(ip)
      if (limited) {
        res.status(429).json({ error: 'Too many requests', retryAfter: limited.retryAfter })
        return
      }
    }

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
        await config.authorize(normalizedReq)
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
          ? await config.system(normalizedReq)
          : (config.system ?? '')

      const model = genAI.getGenerativeModel({
        model: config.model,
        ...(system ? { systemInstruction: system } : {}),
        ...(googleTools.length > 0 ? { tools: googleTools } : {}),
      })

      // Convert to Gemini format — split last user message as the prompt
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
            if ('text' in part && part.text) {
              emit(res, 'strand:text-delta', { delta: part.text })
            }
            if ('functionCall' in part && part.functionCall) {
              const fc = part.functionCall
              pendingFunctionCall = {
                name: fc.name,
                args: fc.args as Record<string, unknown>,
              }
              const toolCallId = generateId()
              emit(res, 'strand:tool-start', { toolCallId, toolName: fc.name })
              emit(res, 'strand:tool-input-done', { toolCallId, input: fc.args })
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
          emit(res, 'strand:done', {
            usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput },
          })
          res.end()
          return
        }

        // Execute tool and continue
        const toolCallId = generateId()
        try {
          const toolResult = await config.onToolCall?.(
            pendingFunctionCall.name,
            pendingFunctionCall.args,
            { request: normalizedReq },
          )
          emit(res, 'strand:tool-result', { toolCallId, result: toolResult })

          // Feed result back via sendMessageStream
          await chat.sendMessageStream([{
            functionResponse: {
              name: pendingFunctionCall.name,
              response: { result: toolResult },
            },
          }])
          continue
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Tool execution failed'
          emit(res, 'strand:tool-error', { toolCallId, error: message })
          break
        }
      }

      emit(res, 'strand:done', {
        usage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput },
      })
      res.end()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      emit(res, 'strand:error', { code: 'server_error', message })
      res.end()
    }
  }
}
