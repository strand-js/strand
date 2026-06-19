import type { StrandClient, StrandClientConfig, Message, SendOptions, WireEvent } from './types'
import { applyContextWindow } from './context-window'
import { withRetry, StrandError } from './retry'
import { parseSSEStream } from './stream'

class StrandClientImpl implements StrandClient {
  readonly config: Required<StrandClientConfig>

  constructor(config: StrandClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      retry: {
        maxAttempts: config.retry?.maxAttempts ?? 3,
        backoff: config.retry?.backoff ?? 'exponential',
        retryOn: config.retry?.retryOn ?? ['rate_limit', 'server_error'],
      },
      contextWindow: {
        strategy: config.contextWindow?.strategy ?? 'truncate-oldest',
        maxTokens: config.contextWindow?.maxTokens ?? 100_000,
      },
    }
  }

  async *send(messages: Message[], options: SendOptions = {}): AsyncGenerator<WireEvent> {
    const { signal, context } = options

    const windowedMessages = applyContextWindow(messages, this.config.contextWindow)

    const body = JSON.stringify({
      messages: windowedMessages.map(m => ({ role: m.role, content: m.content })),
      ...(context ? { context } : {}),
    })

    const response = await withRetry(
      () =>
        fetch(this.config.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body,
          signal,
        }),
      this.config.retry,
    )

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      const code = response.status === 429 ? 'rate_limit' : 'server_error'
      throw new StrandError(response.status, text, code)
    }

    if (!response.body) {
      throw new StrandError(0, 'Response body is null', 'server_error')
    }

    yield* parseSSEStream(response.body, signal)
  }
}

export function createStrandClient(config: StrandClientConfig): StrandClient {
  if (!config.baseUrl) throw new Error('[strand] createStrandClient: baseUrl is required')
  return new StrandClientImpl(config)
}
