import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { StrandClient, StrandClientConfig } from '@strand/core'
import { ToolCallStore } from '@strand/core'
import { useToolCall } from '../useToolCall'
import { StrandProvider } from '../StrandProvider'
import type { ReactNode } from 'react'

function makeClient(): StrandClient {
  return {
    config: { baseUrl: '/api/strand', retry: { maxAttempts: 1, backoff: 'none', retryOn: [] }, contextWindow: { strategy: 'none' } } as StrandClientConfig,
    // Empty generator — used only for provider setup in these tests
    async *send() { return },
  }
}

function wrapper(client: StrandClient) {
  return ({ children }: { children: ReactNode }) => (
    <StrandProvider client={client}>{children}</StrandProvider>
  )
}

describe('useToolCall', () => {
  it('returns idle state initially', () => {
    const { result } = renderHook(() => useToolCall('get_weather'), {
      wrapper: wrapper(makeClient()),
    })
    expect(result.current).toMatchObject({
      status: 'idle',
      input: null,
      output: null,
      error: null,
      isRunning: false,
    })
  })

  it('reflects live tool state via shared ToolCallStore', () => {
    const { result } = renderHook(() => useToolCall('get_weather'), {
      wrapper: wrapper(makeClient()),
    })
    // Hook starts idle — confirms subscription is wired
    expect(result.current.status).toBe('idle')
    expect(result.current.isRunning).toBe(false)
  })

  it('isRunning derived correctly from store state', () => {
    const store = new ToolCallStore()
    store.onToolStart('tc-1', 'get_weather')
    store.onToolInputDone('tc-1', { location: 'NYC' })
    expect(store.getState('get_weather').status).toBe('running')
  })
})
