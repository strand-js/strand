import { describe, it, expect } from 'vitest'
import { applyContextWindow } from '../context-window'
import type { Message } from '../types'

function msg(content: string, role: 'user' | 'assistant' = 'user'): Message {
  return { id: 'id', role, content, createdAt: new Date() }
}

describe('applyContextWindow', () => {
  describe('strategy: none', () => {
    it('returns messages unchanged', () => {
      const msgs = [msg('a'), msg('b'), msg('c')]
      expect(applyContextWindow(msgs, { strategy: 'none' })).toEqual(msgs)
    })
  })

  describe('no maxTokens set', () => {
    it('returns messages unchanged regardless of strategy', () => {
      const msgs = [msg('hello'), msg('world')]
      expect(applyContextWindow(msgs, { strategy: 'truncate-oldest' })).toEqual(msgs)
      expect(applyContextWindow(msgs, { strategy: 'sliding-window' })).toEqual(msgs)
    })
  })

  describe('empty input', () => {
    it('returns empty array', () => {
      expect(applyContextWindow([], { strategy: 'truncate-oldest', maxTokens: 100 })).toEqual([])
    })
  })

  describe('strategy: truncate-oldest', () => {
    it('returns all messages when within token budget', () => {
      const msgs = [msg('hi'), msg('there')]
      const result = applyContextWindow(msgs, { strategy: 'truncate-oldest', maxTokens: 1000 })
      expect(result).toEqual(msgs)
    })

    it('removes oldest messages when over budget', () => {
      // each 'message N' is ~9 chars ≈ 3 tokens
      const msgs = [
        msg('message 1'),
        msg('message 2'),
        msg('message 3'),
        msg('message 4'),
        msg('message 5'),
      ]
      const result = applyContextWindow(msgs, { strategy: 'truncate-oldest', maxTokens: 5 })
      expect(result.length).toBeLessThan(msgs.length)
      // most recent message is always preserved
      expect(result.at(-1)).toBe(msgs.at(-1))
    })

    it('always preserves the most recent message even if it alone exceeds budget', () => {
      const msgs = [msg('short'), msg('this is a very long message that exceeds even a tiny budget')]
      const result = applyContextWindow(msgs, { strategy: 'truncate-oldest', maxTokens: 1 })
      expect(result.length).toBeGreaterThan(0)
      expect(result.at(-1)).toBe(msgs.at(-1))
    })

    it('preserves message order (oldest to newest)', () => {
      const msgs = [msg('a'), msg('b'), msg('c'), msg('d'), msg('e')]
      const result = applyContextWindow(msgs, { strategy: 'truncate-oldest', maxTokens: 5 })
      // result should be a contiguous tail of the original array
      const lastN = msgs.slice(msgs.length - result.length)
      expect(result).toEqual(lastN)
    })
  })

  describe('strategy: sliding-window', () => {
    it('returns all messages when within budget', () => {
      const msgs = [msg('hi'), msg('there')]
      const result = applyContextWindow(msgs, { strategy: 'sliding-window', maxTokens: 1000 })
      expect(result).toEqual(msgs)
    })

    it('keeps most recent messages within token budget', () => {
      const msgs = Array.from({ length: 10 }, (_, i) => msg(`message ${i}`))
      const result = applyContextWindow(msgs, { strategy: 'sliding-window', maxTokens: 10 })
      expect(result.length).toBeLessThan(msgs.length)
      expect(result.at(-1)).toBe(msgs.at(-1))
    })

    it('preserves message order', () => {
      const msgs = [msg('a'), msg('b'), msg('c'), msg('d'), msg('e')]
      const result = applyContextWindow(msgs, { strategy: 'sliding-window', maxTokens: 5 })
      const lastN = msgs.slice(msgs.length - result.length)
      expect(result).toEqual(lastN)
    })
  })
})
