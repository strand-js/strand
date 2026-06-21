import type { Message, ToolDefinition } from '@strand-js/core'
import { toolToJsonSchema } from '@strand-js/core'
import type Anthropic from '@anthropic-ai/sdk'

export function toolToAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
  const schema = toolToJsonSchema(tool)
  return {
    name: tool.name,
    description: tool.description,
    input_schema: schema as Anthropic.Tool['input_schema'],
  }
}

export function messagesToAnthropicMessages(
  messages: Message[],
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = []

  for (const msg of messages) {
    const hasContent = msg.content.trim().length > 0
    const hasToolCalls = (msg.toolCalls?.length ?? 0) > 0

    if (!hasContent && !hasToolCalls) continue

    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (hasContent && !hasToolCalls) {
      // Plain text assistant message — pass as string (simpler, both formats valid)
      result.push({ role: 'assistant', content: msg.content })
    } else {
      // Assistant message with tool calls — must use blocks array
      const blocks: Anthropic.ContentBlock[] = []

      if (hasContent) {
        blocks.push({ type: 'text', text: msg.content, citations: null })
      }

      for (const tc of msg.toolCalls ?? []) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input,
        })
      }

      result.push({ role: 'assistant', content: blocks })
    }
  }

  return result
}
