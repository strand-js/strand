import type { Message, ToolDefinition, TokenUsage, StrandClient, StreamingStatus } from '@strand/core'

export interface ConversationOptions {
  system?: string
  tools?: ToolDefinition[]
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown>
  context?: Record<string, unknown>
  sessionId?: string
  onFinish?: (message: Message) => void
  onError?: (error: Error) => void
  client?: StrandClient
}

export interface ConversationResult {
  messages: Message[]
  send: (content: string) => void
  status: StreamingStatus
  isPending: boolean
  isStreaming: boolean
  isIdle: boolean
  isDone: boolean
  error: Error | null
  cancel: () => void
  clear: () => void
  tokenUsage: TokenUsage
}

export function useConversation(_options: ConversationOptions = {}): ConversationResult {
  // Implementation in Task #4
  throw new Error('[strand] useConversation: not yet implemented')
}
