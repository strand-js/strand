import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { tool } from '../tool'
import { toolToJsonSchema } from '../schema'

describe('toolToJsonSchema()', () => {
  it('converts a simple string property', () => {
    const t = tool({ name: 'test', description: 'test', parameters: z.object({ city: z.string() }) })
    const schema = toolToJsonSchema(t)
    expect(schema.type).toBe('object')
    expect(schema.properties).toMatchObject({ city: { type: 'string' } })
  })

  it('marks required fields', () => {
    const t = tool({
      name: 'test',
      description: 'test',
      parameters: z.object({ city: z.string(), unit: z.string().optional() }),
    })
    const schema = toolToJsonSchema(t)
    expect(schema.required).toContain('city')
    expect(schema.required).not.toContain('unit')
  })

  it('converts enum values', () => {
    const t = tool({
      name: 'test',
      description: 'test',
      parameters: z.object({ unit: z.enum(['celsius', 'fahrenheit']) }),
    })
    const schema = toolToJsonSchema(t)
    expect(schema.properties?.unit).toMatchObject({ enum: ['celsius', 'fahrenheit'] })
  })

  it('converts number type', () => {
    const t = tool({
      name: 'test',
      description: 'test',
      parameters: z.object({ limit: z.number() }),
    })
    const schema = toolToJsonSchema(t)
    expect(schema.properties?.limit).toMatchObject({ type: 'number' })
  })

  it('converts nested objects', () => {
    const t = tool({
      name: 'test',
      description: 'test',
      parameters: z.object({ location: z.object({ city: z.string(), country: z.string() }) }),
    })
    const schema = toolToJsonSchema(t)
    expect(schema.properties?.location).toMatchObject({ type: 'object' })
  })
})
