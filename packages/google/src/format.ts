import type { Message, ToolDefinition } from '@strand-js/core'
import { toolToJsonSchema } from '@strand-js/core'
import type { Content, Part } from '@google/generative-ai'

// Use a loose type for the tool to avoid strict SDK schema type requirements
export function toolToGoogleTool(tool: ToolDefinition): Record<string, unknown> {
  const schema = toolToJsonSchema(tool)
  return {
    functionDeclarations: [
      {
        name: tool.name,
        description: tool.description,
        parameters: schema,
      },
    ],
  }
}

export function messagesToGoogleMessages(messages: Message[]): Content[] {
  const result: Content[] = []

  for (const msg of messages) {
    if (!msg.content.trim() && !msg.toolCalls?.length) continue

    // Gemini uses 'user' and 'model' (not 'assistant')
    const role = msg.role === 'assistant' ? 'model' : 'user'
    const parts: Part[] = []

    if (msg.content.trim()) {
      parts.push({ text: msg.content })
    }

    // Add function call parts for tool calls
    for (const tc of msg.toolCalls ?? []) {
      parts.push({
        functionCall: { name: tc.name, args: tc.input as Record<string, unknown> },
      })
    }

    // Gemini requires strictly alternating user/model turns.
    // If the last message has the same role, merge parts into it.
    const last = result.at(-1)
    if (last && last.role === role) {
      last.parts.push(...parts)
    } else {
      result.push({ role, parts })
    }
  }

  return result
}
