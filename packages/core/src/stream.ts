import { createParser } from 'eventsource-parser'
import type { WireEvent } from './types'

const KNOWN_EVENT_TYPES = new Set([
  'strand:start',
  'strand:text-delta',
  'strand:tool-start',
  'strand:tool-input-delta',
  'strand:tool-input-done',
  'strand:tool-result',
  'strand:tool-error',
  'strand:done',
  'strand:error',
])

export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<WireEvent> {
  const decoder = new TextDecoder()
  const reader = body.getReader()

  // Buffer parsed events to yield them from the generator
  const pending: WireEvent[] = []
  let resolve: (() => void) | null = null

  const parser = createParser({
    onEvent(event) {
      if (!KNOWN_EVENT_TYPES.has(event.event ?? '')) return

      try {
        const data = JSON.parse(event.data)
        pending.push({ type: event.event, ...data } as WireEvent)
        resolve?.()
      } catch {
        // malformed JSON — skip silently
      }
    },
  })

  try {
    while (true) {
      if (signal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      parser.feed(decoder.decode(value, { stream: true }))

      while (pending.length > 0) {
        yield pending.shift()!
      }
    }

    // Flush any remaining decoded bytes
    parser.feed(decoder.decode())
    while (pending.length > 0) {
      yield pending.shift()!
    }
  } finally {
    reader.releaseLock()
  }
}
