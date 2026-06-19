import type { StrandClient, ToolCallStatus } from '@strand/core'

export interface ToolCallResult<TInput = unknown, TOutput = unknown> {
  status: ToolCallStatus
  input: TInput | null
  output: TOutput | null
  error: Error | null
  isRunning: boolean
}

export function useToolCall<TInput = unknown, TOutput = unknown>(
  _toolName: string,
  _options?: { client?: StrandClient },
): ToolCallResult<TInput, TOutput> {
  // Implementation in Task #5
  throw new Error('[strand] useToolCall: not yet implemented')
}
