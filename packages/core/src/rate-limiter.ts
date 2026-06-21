export interface RateLimitConfig {
  windowMs: number       // time window in milliseconds
  maxRequests: number    // max requests per IP per window
  keyExtractor?: (identifier: string) => string  // custom key function
}

export interface RateLimitResult {
  retryAfter: number     // seconds until the window resets
}

interface WindowEntry {
  count: number
  windowStart: number
}

export class RateLimiter {
  private readonly config: Required<RateLimitConfig>
  private readonly store = new Map<string, WindowEntry>()

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      keyExtractor: config.keyExtractor ?? ((id) => id),
    }
  }

  // Returns null if allowed, or { retryAfter } if blocked
  check(identifier: string): RateLimitResult | null {
    const key = this.config.keyExtractor(identifier)
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      this.store.set(key, { count: 1, windowStart: now })
      return null
    }

    if (entry.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((this.config.windowMs - (now - entry.windowStart)) / 1000)
      return { retryAfter }
    }

    entry.count++
    return null
  }
}
