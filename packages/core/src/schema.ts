import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ToolDefinition } from './types'

export interface JsonSchema {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

export function toolToJsonSchema(tool: ToolDefinition): JsonSchema {
  const schema = zodToJsonSchema(tool.parameters, { target: 'openApi3' })
  // zodToJsonSchema wraps in a root schema — extract the inner definition
  const inner = (schema as Record<string, unknown>)
  // Remove $schema field added by zodToJsonSchema
  delete inner['$schema']
  return inner as JsonSchema
}
