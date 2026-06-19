import type { Message, ToolDefinition } from '@strand/core'
import { toolToJsonSchema } from '@strand/core'
import type OpenAI from 'openai'

export function toolToOpenAITool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
  const schema = toolToJsonSchema(tool)
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: schema as Record<string, unknown>,
    },
  }
}

export function messagesToOpenAIMessages(
  messages: Message[],
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = []

  for (const msg of messages) {
    const hasContent = msg.content.trim().length > 0
    const hasToolCalls = (msg.toolCalls?.length ?? 0) > 0

    if (!hasContent && !hasToolCalls) continue

    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content })
    } else if (hasContent && !hasToolCalls) {
      result.push({ role: 'assistant', content: msg.content })
    } else {
      const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = (msg.toolCalls ?? []).map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      }))
      result.push({
        role: 'assistant',
        content: hasContent ? msg.content : null,
        tool_calls: toolCalls,
      })
    }
  }

  return result
}
