import type { ToolDefinition, Session } from '@strand/core'

export interface StrandHandlerConfig {
  apiKey: string
  model: string
  system?: string | ((request: Request) => string | Promise<string>)
  tools?: ToolDefinition[]
  onToolCall?: (
    name: string,
    args: Record<string, unknown>,
    ctx: { request: Request },
  ) => Promise<unknown>
  maxSteps?: number
  onRequest?: (req: Request) => void
  onFinish?: (session: Session) => void
}

export function createStrandHandler(
  _config: StrandHandlerConfig,
): (req: unknown, res: unknown) => Promise<void> {
  // Implementation in Task #6
  throw new Error('[strand] createStrandHandler: not yet implemented')
}
