import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { WireEvent, StrandClient, StrandClientConfig } from '@strand/core'
import { useConversation } from '../useConversation'
import { StrandProvider } from '../StrandProvider'
import type { ReactNode } from 'react'

// ── Mock client factory ────────────────────────────────────────────────────

function makeClient(events: WireEvent[]): StrandClient {
  return {
    config: {
      baseUrl: '/api/strand',
      retry: { maxAttempts: 3, backoff: 'exponential', retryOn: ['rate_limit'] },
      contextWindow: { strategy: 'truncate-oldest', maxTokens: 100_000 },
    } as StrandClientConfig,
    async *send() {
      for (const event of events) yield event
    },
  }
}

function wrapper(client: StrandClient) {
  return ({ children }: { children: ReactNode }) => (
    <StrandProvider client={client}>{children}</StrandProvider>
  )
}

// ─────────────────────────────────────────────────────────────────────────

describe('useConversation', () => {
  describe('initial state', () => {
    it('starts idle with no messages', () => {
      const client = makeClient([])
      const { result } = renderHook(() => useConversation(), { wrapper: wrapper(client) })
      expect(result.current.status).toBe('idle')
      expect(result.current.messages).toHaveLength(0)
      expect(result.current.isIdle).toBe(true)
      expect(result.current.isPending).toBe(false)
      expect(result.current.isStreaming).toBe(false)
    })
  })

  describe('send() — plain text response', () => {
    it('adds user message and receives assistant response', async () => {
      const client = makeClient([
        { type: 'strand:start', sessionId: 'sid', requestId: 'rid' },
        { type: 'strand:text-delta', delta: 'Hello ' },
        { type: 'strand:text-delta', delta: 'world!' },
        { type: 'strand:done', usage: { input: 10, output: 5, total: 15 } },
      ])

      const { result } = renderHook(() => useConversation(), { wrapper: wrapper(client) })

      await act(async () => { result.current.send('Hi') })

      await waitFor(() => expect(result.current.status).toBe('idle'))

      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Hi' })
      expect(result.current.messages[1]).toMatchObject({ role: 'assistant', content: 'Hello world!' })
    })

    it('tracks token usage', async () => {
      const client = makeClient([
        { type: 'strand:done', usage: { input: 100, output: 50, total: 150 } },
      ])
      const { result } = renderHook(() => useConversation(), { wrapper: wrapper(client) })
      await act(async () => { result.current.send('Hi') })
      await waitFor(() => expect(result.current.status).toBe('idle'))
      expect(result.current.tokenUsage).toEqual({ input: 100, output: 50, total: 150 })
    })

    it('ends idle with correct message structure after full cycle', async () => {
      const client = makeClient([
        { type: 'strand:start', sessionId: 'sid', requestId: 'rid' },
        { type: 'strand:text-delta', delta: 'Hi' },
        { type: 'strand:done', usage: { input: 1, output: 1, total: 2 } },
      ])
      const { result } = renderHook(() => useConversation(), { wrapper: wrapper(client) })
      await act(async () => { result.current.send('Hello') })
      await waitFor(() => result.current.isIdle)
      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[1].content).toBe('Hi')
    })
  })

  describe('cancel()', () => {
    it('aborts the in-flight request and returns to idle', async () => {
      let aborted = false
      const client: StrandClient = {
        config: makeClient([]).config,
        async *send(_msgs, opts) {
          while (true) {
            if (opts?.signal?.aborted) { aborted = true; return }
            yield { type: 'strand:text-delta', delta: 'x' } as WireEvent
            await new Promise(r => setTimeout(r, 10))
          }
        },
      }

      const { result } = renderHook(() => useConversation(), { wrapper: wrapper(client) })

      act(() => { result.current.send('Hi') })
      await waitFor(() => expect(result.current.isStreaming).toBe(true))

      act(() => { result.current.cancel() })
      await waitFor(() => expect(result.current.isIdle).toBe(true))
      expect(aborted).toBe(true)
    })
  })

  describe('clear()', () => {
    it('resets messages and status to idle', async () => {
      const client = makeClient([
        { type: 'strand:text-delta', delta: 'Hello' },
        { type: 'strand:done', usage: { input: 1, output: 1, total: 2 } },
      ])
      const { result } = renderHook(() => useConversation(), { wrapper: wrapper(client) })
      await act(async () => { result.current.send('Hi') })
      await waitFor(() => expect(result.current.status).toBe('idle'))
      act(() => { result.current.clear() })
      expect(result.current.messages).toHaveLength(0)
    })
  })

  describe('onFinish callback', () => {
    it('fires when response completes', async () => {
      const client = makeClient([
        { type: 'strand:text-delta', delta: 'Done' },
        { type: 'strand:done', usage: { input: 1, output: 1, total: 2 } },
      ])
      const onFinish = vi.fn()
      const { result } = renderHook(
        () => useConversation({ onFinish }),
        { wrapper: wrapper(client) },
      )
      await act(async () => { result.current.send('Hi') })
      await waitFor(() => expect(result.current.status).toBe('idle'))
      expect(onFinish).toHaveBeenCalledOnce()
      expect(onFinish.mock.calls[0][0]).toMatchObject({ role: 'assistant', content: 'Done' })
    })
  })

  describe('error handling', () => {
    it('transitions to error on send failure', async () => {
      const client: StrandClient = {
        config: makeClient([]).config,
        async *send() { throw new Error('network failure') },
      }
      const { result } = renderHook(() => useConversation(), { wrapper: wrapper(client) })
      await act(async () => { result.current.send('Hi') })
      await waitFor(() => expect(result.current.error?.message).toBe('network failure'))
    })
  })
})
