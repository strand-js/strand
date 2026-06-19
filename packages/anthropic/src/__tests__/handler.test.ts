import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { tool } from '@strand/core'

// ── Mock Anthropic SDK ─────────────────────────────────────────────────────

// Helper: build a mock async stream that yields Anthropic events then finalMessage
function makeAnthropicStream(events: object[], finalMsg: object) {
  const iter = (async function* () {
    for (const e of events) yield e
  })()

  return Object.assign(iter, {
    finalMessage: vi.fn().mockResolvedValue(finalMsg),
  })
}

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

// ── Import handler AFTER mock is set up ───────────────────────────────────
const { createStrandHandler } = await import('../handler')

// ── SSE capture helper ────────────────────────────────────────────────────
function makeMockResponse() {
  const written: string[] = []
  return {
    res: {
      setHeader: vi.fn(),
      write: (chunk: string) => written.push(chunk),
      end: vi.fn(),
    },
    events() {
      return written
        .join('')
        .split('\n\n')
        .filter(Boolean)
        .map(block => {
          const lines = block.split('\n')
          const type = lines.find(l => l.startsWith('event: '))?.slice(7) ?? ''
          const data = JSON.parse(lines.find(l => l.startsWith('data: '))?.slice(6) ?? '{}')
          return { type, ...data }
        })
    },
  }
}

function makeReq(body: object) {
  return { body, headers: {} } as unknown as Parameters<typeof createStrandHandler>[0] extends (...args: infer A) => unknown ? A[0] : never
}

// ─────────────────────────────────────────────────────────────────────────

describe('createStrandHandler', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('emits strand:start and strand:done for a plain text response', async () => {
    mockCreate.mockReturnValue(
      makeAnthropicStream(
        [
          { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
          { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello!' } },
          { type: 'content_block_stop', index: 0 },
          { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
          { type: 'message_stop' },
        ],
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hello!' }], usage: { input_tokens: 10, output_tokens: 5 } },
      ),
    )

    const handler = createStrandHandler({ apiKey: 'sk-test', model: 'claude-sonnet-4-6' })
    const { res, events } = makeMockResponse()
    await handler({ body: { messages: [{ role: 'user', content: 'Hi' }] } } as never, res as never)

    const evs = events()
    expect(evs[0].type).toBe('strand:start')
    expect(evs.some(e => e.type === 'strand:text-delta' && e.delta === 'Hello!')).toBe(true)
    expect(evs.at(-1)?.type).toBe('strand:done')
    expect(res.end).toHaveBeenCalled()
  })

  it('executes a tool call and continues the conversation', async () => {
    // First call: model requests a tool
    mockCreate
      .mockReturnValueOnce(
        makeAnthropicStream(
          [
            { type: 'message_start', message: { usage: { input_tokens: 20, output_tokens: 0 } } },
            { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tc-1', name: 'get_weather', input: {} } },
            { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"location":"NYC"}' } },
            { type: 'content_block_stop', index: 0 },
            { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 10 } },
            { type: 'message_stop' },
          ],
          {
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', id: 'tc-1', name: 'get_weather', input: { location: 'NYC' } }],
            usage: { input_tokens: 20, output_tokens: 10 },
          },
        ),
      )
      // Second call: model responds after tool result
      .mockReturnValueOnce(
        makeAnthropicStream(
          [
            { type: 'message_start', message: { usage: { input_tokens: 30, output_tokens: 0 } } },
            { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
            { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'It is 72°F in NYC.' } },
            { type: 'content_block_stop', index: 0 },
            { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 15 } },
            { type: 'message_stop' },
          ],
          { stop_reason: 'end_turn', content: [{ type: 'text', text: 'It is 72°F in NYC.' }], usage: { input_tokens: 30, output_tokens: 15 } },
        ),
      )

    const weatherTool = tool({
      name: 'get_weather',
      description: 'Get weather',
      parameters: z.object({ location: z.string() }),
    })

    const onToolCall = vi.fn().mockResolvedValue({ temp: 72, unit: 'F' })

    const handler = createStrandHandler({
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-6',
      tools: [weatherTool],
      onToolCall,
    })

    const { res, events } = makeMockResponse()
    await handler({ body: { messages: [{ role: 'user', content: 'Weather in NYC?' }] } } as never, res as never)

    const evs = events()
    expect(onToolCall).toHaveBeenCalledWith('get_weather', { location: 'NYC' }, expect.any(Object))
    expect(evs.some(e => e.type === 'strand:tool-start' && e.toolName === 'get_weather')).toBe(true)
    expect(evs.some(e => e.type === 'strand:tool-result')).toBe(true)
    expect(evs.some(e => e.type === 'strand:text-delta' && e.delta === 'It is 72°F in NYC.')).toBe(true)
    expect(evs.at(-1)?.type).toBe('strand:done')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('emits strand:error when Anthropic call throws', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))

    const handler = createStrandHandler({ apiKey: 'sk-test', model: 'claude-sonnet-4-6' })
    const { res, events } = makeMockResponse()
    await handler({ body: { messages: [{ role: 'user', content: 'Hi' }] } } as never, res as never)

    const evs = events()
    expect(evs.some(e => e.type === 'strand:error')).toBe(true)
    expect(res.end).toHaveBeenCalled()
  })

  it('resolves dynamic system prompt', async () => {
    mockCreate.mockReturnValue(
      makeAnthropicStream(
        [{ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }],
        { stop_reason: 'end_turn', content: [], usage: { input_tokens: 5, output_tokens: 1 } },
      ),
    )

    const handler = createStrandHandler({
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-6',
      system: async () => 'You are a test assistant.',
    })

    const { res } = makeMockResponse()
    await handler({ body: { messages: [{ role: 'user', content: 'Hi' }] } } as never, res as never)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.system).toBe('You are a test assistant.')
  })
})
