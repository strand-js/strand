import type { ToolDefinition } from './types'

export function tool(definition: ToolDefinition): ToolDefinition {
  if (!definition.name) throw new Error('[strand] tool: name is required')
  if (!definition.description) throw new Error('[strand] tool: description is required')
  if (!definition.parameters) throw new Error('[strand] tool: parameters schema is required')
  return definition
}
