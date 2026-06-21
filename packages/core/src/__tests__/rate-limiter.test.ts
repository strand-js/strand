import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RateLimiter } from '../rate-limiter'

describe('RateLimiter', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('allows requests within the limit', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })
    expect(limiter.check('ip1')).toBeNull()
    expect(limiter.check('ip1')).toBeNull()
    expect(limiter.check('ip1')).toBeNull()
  })

  it('blocks when limit is exceeded', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 2 })
    limiter.check('ip1')
    limiter.check('ip1')
    const result = limiter.check('ip1')
    expect(result).not.toBeNull()
    expect(result?.retryAfter).toBeGreaterThan(0)
  })

  it('tracks different IPs independently', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })
    expect(limiter.check('ip1')).toBeNull()
    expect(limiter.check('ip2')).toBeNull()
    expect(limiter.check('ip1')).not.toBeNull()
    expect(limiter.check('ip2')).not.toBeNull()
  })

  it('resets after window expires', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })
    limiter.check('ip1')
    expect(limiter.check('ip1')).not.toBeNull()
    vi.advanceTimersByTime(60_001)
    expect(limiter.check('ip1')).toBeNull()
  })

  it('returns correct retryAfter seconds', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })
    limiter.check('ip1')
    vi.advanceTimersByTime(30_000)
    const result = limiter.check('ip1')
    expect(result?.retryAfter).toBeCloseTo(30, 0)
  })

  it('uses custom key extractor', () => {
    const limiter = new RateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      keyExtractor: () => 'global',
    })
    limiter.check('anything')
    expect(limiter.check('anything-else')).not.toBeNull()
  })
})
