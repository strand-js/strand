import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry, StrandError } from '../retry'

describe('StrandError', () => {
  it('stores status and code', () => {
    const err = new StrandError(429, 'Too Many Requests', 'rate_limit')
    expect(err.status).toBe(429)
    expect(err.code).toBe('rate_limit')
    expect(err.message).toBe('Too Many Requests')
  })

  it('is an instance of Error', () => {
    expect(new StrandError(500, 'Internal Server Error', 'server_error')).toBeInstanceOf(Error)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns result immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, backoff: 'none', retryOn: ['rate_limit'] })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('retries on a retryable error and succeeds', async () => {
    const err = new StrandError(429, 'rate limited', 'rate_limit')
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, backoff: 'none', retryOn: ['rate_limit'] })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry on a non-retryable error', async () => {
    const err = new StrandError(400, 'Bad Request', 'client_error')
    const fn = vi.fn().mockRejectedValue(err)
    await expect(
      withRetry(fn, { maxAttempts: 3, backoff: 'none', retryOn: ['rate_limit'] }),
    ).rejects.toThrow('Bad Request')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('throws after exhausting maxAttempts', async () => {
    const err = new StrandError(429, 'rate limited', 'rate_limit')
    const fn = vi.fn().mockRejectedValue(err)
    await expect(
      withRetry(fn, { maxAttempts: 3, backoff: 'none', retryOn: ['rate_limit'] }),
    ).rejects.toThrow('rate limited')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not retry non-StrandError (unexpected errors)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network failure'))
    await expect(
      withRetry(fn, { maxAttempts: 3, backoff: 'none', retryOn: ['rate_limit'] }),
    ).rejects.toThrow('network failure')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('applies delay between retries with linear backoff', async () => {
    const err = new StrandError(429, 'rate limited', 'rate_limit')
    const fn = vi.fn().mockRejectedValue(err)

    // Attach rejects handler BEFORE advancing timers so the rejection is handled
    const retryPromise = withRetry(fn, { maxAttempts: 3, backoff: 'linear', retryOn: ['rate_limit'] })
    const expectPromise = expect(retryPromise).rejects.toThrow('rate limited')

    await vi.runAllTimersAsync()
    await expectPromise

    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('applies exponential backoff', async () => {
    const err = new StrandError(500, 'server error', 'server_error')
    const fn = vi.fn().mockRejectedValue(err)

    const retryPromise = withRetry(fn, {
      maxAttempts: 3,
      backoff: 'exponential',
      retryOn: ['server_error'],
    })
    const expectPromise = expect(retryPromise).rejects.toThrow('server error')

    await vi.runAllTimersAsync()
    await expectPromise

    expect(fn).toHaveBeenCalledTimes(3)
  })
})
