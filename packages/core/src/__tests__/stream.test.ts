import { describe, it, expect } from 'vitest'
import { parseSSEStream } from '../stream'
import type { WireEvent } from '../types'

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function sseChunk(eventType: string, data: object): string {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<WireEvent[]> {
  const events: WireEvent[] = []
  for await (const event of parseSSEStream(stream)) {
    events.push(event)
  }
  return events
}

describe('parseSSEStream', () => {
  it('parses a strand:start event', async () => {
    const stream = makeStream([
      sseChunk('strand:start', { sessionId: 'sid', requestId: 'rid' }),
    ])
    const events = await collect(stream)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'strand:start', sessionId: 'sid', requestId: 'rid' })
  })

  it('parses strand:text-delta events', async () => {
    const stream = makeStream([
      sseChunk('strand:text-delta', { delta: 'Hello' }),
      sseChunk('strand:text-delta', { delta: ' world' }),
    ])
    const events = await collect(stream)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'strand:text-delta', delta: 'Hello' })
    expect(events[1]).toEqual({ type: 'strand:text-delta', delta: ' world' })
  })

  it('parses strand:done event with token usage', async () => {
    const stream = makeStream([
      sseChunk('strand:done', { usage: { input: 100, output: 50, total: 150 } }),
    ])
    const events = await collect(stream)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'strand:done',
      usage: { input: 100, output: 50, total: 150 },
    })
  })

  it('parses strand:tool-start event', async () => {
    const stream = makeStream([
      sseChunk('strand:tool-start', { toolCallId: 'tc-1', toolName: 'get_weather' }),
    ])
    const events = await collect(stream)
    expect(events[0]).toEqual({
      type: 'strand:tool-start',
      toolCallId: 'tc-1',
      toolName: 'get_weather',
    })
  })

  it('parses strand:tool-result event', async () => {
    const stream = makeStream([
      sseChunk('strand:tool-result', { toolCallId: 'tc-1', result: { temp: 72 } }),
    ])
    const events = await collect(stream)
    expect(events[0]).toEqual({
      type: 'strand:tool-result',
      toolCallId: 'tc-1',
      result: { temp: 72 },
    })
  })

  it('parses strand:error event', async () => {
    const stream = makeStream([
      sseChunk('strand:error', { code: 'rate_limit', message: 'Too many requests' }),
    ])
    const events = await collect(stream)
    expect(events[0]).toEqual({
      type: 'strand:error',
      code: 'rate_limit',
      message: 'Too many requests',
    })
  })

  it('handles multiple events in a single chunk', async () => {
    const combined =
      sseChunk('strand:text-delta', { delta: 'Hi' }) +
      sseChunk('strand:text-delta', { delta: ' there' })
    const stream = makeStream([combined])
    const events = await collect(stream)
    expect(events).toHaveLength(2)
  })

  it('handles events split across multiple chunks', async () => {
    const full = sseChunk('strand:text-delta', { delta: 'hello' })
    const mid = Math.floor(full.length / 2)
    const stream = makeStream([full.slice(0, mid), full.slice(mid)])
    const events = await collect(stream)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'strand:text-delta', delta: 'hello' })
  })

  it('skips unknown event types silently', async () => {
    const stream = makeStream([
      sseChunk('unknown:event', { foo: 'bar' }),
      sseChunk('strand:done', { usage: { input: 1, output: 1, total: 2 } }),
    ])
    const events = await collect(stream)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('strand:done')
  })

  it('returns no events for an empty stream', async () => {
    const stream = makeStream([])
    const events = await collect(stream)
    expect(events).toHaveLength(0)
  })
})
