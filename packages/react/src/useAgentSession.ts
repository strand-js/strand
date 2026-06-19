import type { AgentStep, ToolDefinition, StrandClient, AgentStatus } from '@strand/core'

export interface AgentSessionOptions {
  system?: string
  maxSteps?: number
  tools?: ToolDefinition[]
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown>
  onStep?: (step: AgentStep) => void
  onComplete?: (result: string) => void
  client?: StrandClient
}

export interface AgentSessionResult {
  status: AgentStatus
  steps: AgentStep[]
  currentStep: AgentStep | null
  stepCount: number
  run: (goal: string) => void
  pause: () => void
  resume: () => void
  cancel: () => void
  result: string | null
  error: Error | null
}

export function useAgentSession(_options: AgentSessionOptions = {}): AgentSessionResult {
  // Implementation in Task #7
  throw new Error('[strand] useAgentSession: not yet implemented')
}
