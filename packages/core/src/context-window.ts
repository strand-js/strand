import type { Message, ContextWindowConfig } from './types'

// Rough token estimate — 4 chars per token is standard approximation.
// Real token counts require a tokenizer; this is close enough for windowing.
function estimateTokens(msg: Message): number {
  return Math.max(1, Math.ceil(msg.content.length / 4))
}

export function applyContextWindow(messages: Message[], config: ContextWindowConfig): Message[] {
  if (!messages.length) return []
  if (!config.maxTokens || config.strategy === 'none') return messages

  if (config.strategy === 'truncate-oldest') {
    return truncateOldest(messages, config.maxTokens)
  }

  if (config.strategy === 'sliding-window') {
    return slidingWindow(messages, config.maxTokens)
  }

  return messages
}

function truncateOldest(messages: Message[], maxTokens: number): Message[] {
  let total = messages.reduce((sum, m) => sum + estimateTokens(m), 0)
  let start = 0

  // Always keep at least the last message
  while (total > maxTokens && start < messages.length - 1) {
    total -= estimateTokens(messages[start])
    start++
  }

  return messages.slice(start)
}

function slidingWindow(messages: Message[], maxTokens: number): Message[] {
  const result: Message[] = []
  let total = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(messages[i])
    if (total + tokens > maxTokens && result.length > 0) break
    result.unshift(messages[i])
    total += tokens
  }

  return result
}
