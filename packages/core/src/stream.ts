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

// Parses SSE messages from a buffer string.
// Returns an array of { event, data } pairs and the leftover unparsed buffer.
function parseSSEBuffer(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const messages = buffer.split('\n\n')
  const rest = messages.pop() ?? ''
  const events: Array<{ event: string; data: string }> = []

  for (const message of messages) {
    if (!message.trim()) continue
    let event = ''
    let data = ''
    for (const line of message.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim()
      else if (line.startsWith('data: ')) data = line.slice(6)
    }
    if (event && data) events.push({ event, data })
  }

  return { events, rest }
}

export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<WireEvent> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const { events, rest } = parseSSEBuffer(buffer)
      buffer = rest

      for (const { event, data } of events) {
        if (!KNOWN_EVENT_TYPES.has(event)) continue
        try {
          const parsed = JSON.parse(data)
          yield { type: event, ...parsed } as WireEvent
        } catch {
          // malformed JSON — skip silently
        }
      }
    }

    // Flush remaining decoder bytes and check for any final complete message
    buffer += decoder.decode()
    const { events } = parseSSEBuffer(buffer + '\n\n')
    for (const { event, data } of events) {
      if (!KNOWN_EVENT_TYPES.has(event)) continue
      try {
        const parsed = JSON.parse(data)
        yield { type: event, ...parsed } as WireEvent
      } catch {
        // skip
      }
    }
  } finally {
    reader.releaseLock()
  }
}
