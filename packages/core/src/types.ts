import type { ZodSchema } from 'zod'

export type StreamingStatus = 'idle' | 'submitting' | 'streaming' | 'done' | 'error'

export type ToolCallStatus = 'idle' | 'pending' | 'running' | 'done' | 'failed'

export type AgentStatus = 'idle' | 'running' | 'paused' | 'done' | 'failed'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  output: unknown | null
  status: ToolCallStatus
  error: Error | null
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  createdAt: Date
}

export interface TokenUsage {
  input: number
  output: number
  total: number
}

export interface Session {
  id: string
  messages: Message[]
  status: StreamingStatus
  tokenUsage: TokenUsage
  error: Error | null
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: ZodSchema
}

export type RetryableError = 'rate_limit' | 'server_error' | 'timeout'

export interface RetryConfig {
  maxAttempts?: number
  backoff?: 'exponential' | 'linear' | 'none'
  retryOn?: RetryableError[]
}

export type ContextWindowStrategy = 'truncate-oldest' | 'sliding-window' | 'none'

export interface ContextWindowConfig {
  strategy?: ContextWindowStrategy
  maxTokens?: number
}

export interface StrandClientConfig {
  baseUrl: string
  retry?: RetryConfig
  contextWindow?: ContextWindowConfig
}

export interface SendOptions {
  context?: Record<string, unknown>
  signal?: AbortSignal
}

export interface StrandClient {
  readonly config: StrandClientConfig
  send(messages: Message[], options?: SendOptions): AsyncGenerator<WireEvent>
}

export interface AgentStep {
  index: number
  description: string
  toolCalls: ToolCall[]
  output: string | null
  status: 'running' | 'done' | 'failed'
}

// SSE wire protocol events emitted by the server handler
export type WireEvent =
  | { type: 'strand:start'; sessionId: string; requestId: string }
  | { type: 'strand:text-delta'; delta: string }
  | { type: 'strand:tool-start'; toolCallId: string; toolName: string }
  | { type: 'strand:tool-input-delta'; toolCallId: string; delta: string }
  | { type: 'strand:tool-input-done'; toolCallId: string; input: Record<string, unknown> }
  | { type: 'strand:tool-result'; toolCallId: string; result: unknown }
  | { type: 'strand:tool-error'; toolCallId: string; error: string }
  | { type: 'strand:done'; usage: TokenUsage }
  | { type: 'strand:error'; code: string; message: string; retryAfter?: number }
