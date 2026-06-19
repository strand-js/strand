import type { StrandClient, StrandClientConfig } from './types'

export function createStrandClient(config: StrandClientConfig): StrandClient {
  if (!config.baseUrl) throw new Error('[strand] createStrandClient: baseUrl is required')

  return {
    config: {
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
    },
  }
}
