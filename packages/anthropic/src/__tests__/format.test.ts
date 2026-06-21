import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { tool } from '@strandjs/core'
import { toolToAnthropicTool, messagesToAnthropicMessages } from '../format'
import type { Message } from '@strandjs/core'

describe('toolToAnthropicTool()', () => {
  it('maps name and description', () => {
    const t = tool({ name: 'get_weather', description: 'Get weather', parameters: z.object({ city: z.string() }) })
    const result = toolToAnthropicTool(t)
    expect(result.name).toBe('get_weather')
    expect(result.description).toBe('Get weather')
  })

  it('produces a valid input_schema', () => {
    const t = tool({ name: 'get_weather', description: 'Get weather', parameters: z.object({ city: z.string() }) })
    const result = toolToAnthropicTool(t)
    expect(result.input_schema.type).toBe('object')
    expect(result.input_schema.properties).toMatchObject({ city: { type: 'string' } })
  })
})

describe('messagesToAnthropicMessages()', () => {
  function makeMsg(role: 'user' | 'assistant', content: string): Message {
    return { id: 'id', role, content, createdAt: new Date() }
  }

  it('converts user messages', () => {
    const msgs = [makeMsg('user', 'Hello')]
    const result = messagesToAnthropicMessages(msgs)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ role: 'user', content: 'Hello' })
  })

  it('converts assistant messages', () => {
    const msgs = [makeMsg('assistant', 'Hi there')]
    const result = messagesToAnthropicMessages(msgs)
    expect(result[0]).toMatchObject({ role: 'assistant', content: 'Hi there' })
  })

  it('filters out messages with empty content and no tool calls', () => {
    const msgs = [makeMsg('user', 'hi'), makeMsg('assistant', '')]
    const result = messagesToAnthropicMessages(msgs)
    expect(result).toHaveLength(1)
  })
})
