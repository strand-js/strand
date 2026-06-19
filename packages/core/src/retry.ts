import type { RetryConfig, RetryableError } from './types'

export class StrandError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, message: string, code: string) {
    super(message)
    this.name = 'StrandError'
    this.status = status
    this.code = code
  }
}

function isRetryable(error: unknown, retryOn: RetryableError[]): boolean {
  if (!(error instanceof StrandError)) return false
  return retryOn.includes(error.code as RetryableError)
}

function getDelay(backoff: RetryConfig['backoff'], attempt: number): number {
  const base = 1000
  if (backoff === 'none') return 0
  if (backoff === 'linear') return base
  // exponential: 1s, 2s, 4s, ...
  return base * Math.pow(2, attempt)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {
  const maxAttempts = config.maxAttempts ?? 3
  const backoff = config.backoff ?? 'exponential'
  const retryOn = config.retryOn ?? ['rate_limit', 'server_error']

  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (!isRetryable(error, retryOn)) throw error
      if (attempt === maxAttempts - 1) throw error

      const delay = getDelay(backoff, attempt)
      if (delay > 0) await sleep(delay)
    }
  }

  throw lastError
}
