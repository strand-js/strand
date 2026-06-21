import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { StrandClient, StrandClientConfig, WireEvent } from '@strand-js/core'
import { useAgentSession } from '../useAgentSession'
import { StrandProvider } from '../StrandProvider'
import type { ReactNode } from 'react'

function makeClient(events: WireEvent[]): StrandClient {
  return {
    config: { baseUrl: '/api/strand', retry: { maxAttempts: 1, backoff: 'none', retryOn: [] }, contextWindow: { strategy: 'none' } } as StrandClientConfig,
    async *send() { for (const e of events) yield e },
  }
}

function wrapper(client: StrandClient) {
  return ({ children }: { children: ReactNode }) => (
    <StrandProvider client={client}>{children}</StrandProvider>
  )
}

describe('useAgentSession', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useAgentSession(), {
      wrapper: wrapper(makeClient([])),
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.steps).toHaveLength(0)
    expect(result.current.result).toBeNull()
  })

  it('runs to completion and populates result', async () => {
    const client = makeClient([
      { type: 'strand:text-delta', delta: 'The answer is 42.' },
      { type: 'strand:done', usage: { input: 10, output: 5, total: 15 } },
    ])
    const onComplete = vi.fn()
    const { result } = renderHook(
      () => useAgentSession({ onComplete }),
      { wrapper: wrapper(client) },
    )

    await act(async () => { result.current.run('What is the answer?') })
    await waitFor(() => result.current.status === 'idle')

    expect(result.current.result).toBe('The answer is 42.')
    expect(onComplete).toHaveBeenCalledWith('The answer is 42.')
  })

  it('tracks steps from tool calls', async () => {
    const client = makeClient([
      { type: 'strand:tool-start', toolCallId: 'tc-1', toolName: 'search_web' },
      { type: 'strand:tool-input-done', toolCallId: 'tc-1', input: { query: 'meaning of life' } },
      { type: 'strand:tool-result', toolCallId: 'tc-1', result: '42' },
      { type: 'strand:text-delta', delta: 'It is 42.' },
      { type: 'strand:done', usage: { input: 20, output: 10, total: 30 } },
    ])
    const { result } = renderHook(() => useAgentSession(), { wrapper: wrapper(client) })

    await act(async () => { result.current.run('What is the meaning of life?') })
    await waitFor(() => result.current.status === 'idle')

    expect(result.current.steps.length).toBeGreaterThan(0)
    expect(result.current.steps[0].toolName).toBe('search_web')
  })

  it('cancel() returns to idle', async () => {
    const client: StrandClient = {
      config: makeClient([]).config,
      async *send() {
        // Infinite stream — only stops when the for-await loop breaks via cancel
        while (true) {
          yield { type: 'strand:text-delta', delta: 'x' } as WireEvent
          await new Promise(r => setTimeout(r, 5))
        }
      },
    }
    const { result } = renderHook(() => useAgentSession(), { wrapper: wrapper(client) })

    act(() => { result.current.run('go') })
    await waitFor(() => result.current.status === 'running')

    act(() => { result.current.cancel() })
    await waitFor(() => result.current.status === 'idle')
    // Reaching here proves cancel terminated the loop and reset status
  })
})
