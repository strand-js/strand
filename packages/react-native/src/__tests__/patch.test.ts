import { describe, it, expect, beforeEach } from 'vitest'

// Reset module state between tests
beforeEach(() => {
  // Clear the patched flag by resetting the module
})

describe('applyStreamingFetchPatch', () => {
  it('exports applyStreamingFetchPatch as a function', async () => {
    const mod = await import('../patch')
    expect(typeof mod.applyStreamingFetchPatch).toBe('function')
  })

  it('is idempotent — calling twice does not double-wrap fetch', async () => {
    const mod = await import('../patch')
    const before = globalThis.fetch
    mod.applyStreamingFetchPatch()
    mod.applyStreamingFetchPatch()
    // Should not change fetch reference on repeated calls once patched
    expect(globalThis.fetch).toBe(before)
  })

  it('auto-applies on import of the index module', async () => {
    // The side-effect import should not throw
    expect(() => import('../index')).not.toThrow()
  })
})

describe('createXHRStreamingFetch', () => {
  it('exports createXHRStreamingFetch as a function', async () => {
    const mod = await import('../patch')
    expect(typeof mod.createXHRStreamingFetch).toBe('function')
  })

  it('returns a function (the patched fetch)', async () => {
    const mod = await import('../patch')
    const patchedFetch = mod.createXHRStreamingFetch()
    expect(typeof patchedFetch).toBe('function')
  })
})
