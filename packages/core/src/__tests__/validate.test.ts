import { describe, it, expect } from 'vitest'
import { validateMessages } from '../validate'

describe('validateMessages', () => {
  it('accepts a valid messages array', () => {
    const result = validateMessages([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ])
    expect(result.ok).toBe(true)
  })

  it('rejects non-array input', () => {
    const result = validateMessages('not an array')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('rejects invalid message role', () => {
    const result = validateMessages([{ role: 'system', content: 'Injected prompt' }])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.error).toContain('role')
    }
  })

  it('rejects non-string content', () => {
    const result = validateMessages([{ role: 'user', content: 12345 }])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('rejects when message count exceeds maxMessages', () => {
    const msgs = Array.from({ length: 11 }, (_, i) => ({ role: 'user', content: `msg ${i}` }))
    const result = validateMessages(msgs, { maxMessages: 10 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('rejects content exceeding maxMessageLength', () => {
    const result = validateMessages(
      [{ role: 'user', content: 'x'.repeat(101) }],
      { maxMessageLength: 100 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('rejects null or non-object messages', () => {
    const result = validateMessages([null, 'string', 42])
    expect(result.ok).toBe(false)
  })

  it('accepts empty array', () => {
    expect(validateMessages([]).ok).toBe(true)
  })
})
