import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { tool } from '@strand-js/core'
import { toolToGoogleTool, messagesToGoogleMessages } from '../format'
import type { Message } from '@strand-js/core'

describe('toolToGoogleTool()', () => {
  it('maps name and description', () => {
    const t = tool({ name: 'get_weather', description: 'Get weather', parameters: z.object({ city: z.string() }) })
    const result = toolToGoogleTool(t) as { functionDeclarations: Array<{ name: string; description: string; parameters: unknown }> }
    expect(result.functionDeclarations[0].name).toBe('get_weather')
    expect(result.functionDeclarations[0].description).toBe('Get weather')
  })

  it('includes parameters schema', () => {
    const t = tool({ name: 'search', description: 'Search', parameters: z.object({ query: z.string() }) })
    const result = toolToGoogleTool(t) as { functionDeclarations: Array<{ parameters: unknown }> }
    expect(result.functionDeclarations[0].parameters).toBeDefined()
  })
})

describe('messagesToGoogleMessages()', () => {
  function makeMsg(role: 'user' | 'assistant', content: string): Message {
    return { id: 'id', role, content, createdAt: new Date() }
  }

  it('converts user messages to user role', () => {
    const result = messagesToGoogleMessages([makeMsg('user', 'Hello')])
    expect(result[0]).toMatchObject({ role: 'user', parts: [{ text: 'Hello' }] })
  })

  it('converts assistant messages to model role', () => {
    const result = messagesToGoogleMessages([makeMsg('assistant', 'Hi there')])
    expect(result[0]).toMatchObject({ role: 'model', parts: [{ text: 'Hi there' }] })
  })

  it('filters out empty messages', () => {
    const result = messagesToGoogleMessages([makeMsg('user', 'hi'), makeMsg('assistant', '')])
    expect(result).toHaveLength(1)
  })

  it('Gemini requires alternating user/model turns — merges consecutive same-role messages', () => {
    const msgs = [makeMsg('user', 'first'), makeMsg('user', 'second')]
    const result = messagesToGoogleMessages(msgs)
    expect(result).toHaveLength(1)
    expect(result[0].parts).toHaveLength(2)
  })
})
