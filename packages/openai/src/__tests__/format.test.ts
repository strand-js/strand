import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { tool } from '@strand/core'
import { toolToOpenAITool, messagesToOpenAIMessages } from '../format'
import type { Message } from '@strand/core'

describe('toolToOpenAITool()', () => {
  it('wraps in function type', () => {
    const t = tool({ name: 'get_weather', description: 'Get weather', parameters: z.object({ city: z.string() }) })
    const result = toolToOpenAITool(t)
    expect(result.type).toBe('function')
    expect(result.function.name).toBe('get_weather')
    expect(result.function.description).toBe('Get weather')
  })

  it('includes parameters schema', () => {
    const t = tool({ name: 'test', description: 'test', parameters: z.object({ city: z.string() }) })
    const result = toolToOpenAITool(t)
    expect((result.function.parameters as Record<string, unknown>).type).toBe('object')
  })
})

describe('messagesToOpenAIMessages()', () => {
  function makeMsg(role: 'user' | 'assistant', content: string): Message {
    return { id: 'id', role, content, createdAt: new Date() }
  }

  it('converts user messages', () => {
    const result = messagesToOpenAIMessages([makeMsg('user', 'Hello')])
    expect(result[0]).toMatchObject({ role: 'user', content: 'Hello' })
  })

  it('converts plain assistant messages', () => {
    const result = messagesToOpenAIMessages([makeMsg('assistant', 'Hi')])
    expect(result[0]).toMatchObject({ role: 'assistant', content: 'Hi' })
  })

  it('filters empty messages with no tool calls', () => {
    const result = messagesToOpenAIMessages([makeMsg('user', 'hi'), makeMsg('assistant', '')])
    expect(result).toHaveLength(1)
  })
})
