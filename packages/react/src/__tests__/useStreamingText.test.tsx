import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreamingText } from '../useStreamingText'

function makeStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
        await new Promise(r => setTimeout(r, 0))
      }
      controller.close()
    },
  })
}

describe('useStreamingText', () => {
  it('returns idle state for null stream', () => {
    const { result } = renderHook(() => useStreamingText(null))
    expect(result.current).toMatchObject({ text: '', delta: '', isDone: false, isStreaming: false })
  })

  it('accumulates text from stream', async () => {
    const stream = makeStream(['Hello', ' world'])
    const { result } = renderHook(() => useStreamingText(stream))

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(result.current.text).toBe('Hello world')
    expect(result.current.isDone).toBe(true)
    expect(result.current.isStreaming).toBe(false)
  })

  it('exposes the most recent delta', async () => {
    const stream = makeStream(['chunk1', 'chunk2'])
    const { result } = renderHook(() => useStreamingText(stream))
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    // After completion delta holds the last chunk
    expect(result.current.delta).toBe('chunk2')
  })

  it('is streaming until stream closes', async () => {
    let streamClose: () => void
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('partial')
        streamClose = () => controller.close()
      },
    })

    const { result } = renderHook(() => useStreamingText(stream))
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.isStreaming).toBe(true)
    expect(result.current.text).toBe('partial')

    await act(async () => { streamClose(); await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.isDone).toBe(true)
  })
})
