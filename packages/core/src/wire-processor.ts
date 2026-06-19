import type { WireEvent } from './types'
import type { SessionStateMachine } from './session'
import type { ToolCallStore } from './tool-store'
import { StrandError } from './retry'

export function processWireEvent(
  event: WireEvent,
  session: SessionStateMachine,
  toolStore: ToolCallStore,
): void {
  switch (event.type) {
    case 'strand:start':
      session.transition('submitting')
      break

    case 'strand:text-delta':
      if (session.session.status !== 'streaming') session.transition('streaming')
      session.appendTextDelta(event.delta)
      break

    case 'strand:tool-start':
      session.beginToolCall(event.toolCallId, event.toolName)
      toolStore.onToolStart(event.toolCallId, event.toolName)
      break

    case 'strand:tool-input-delta':
      // Input is streamed as JSON fragments — the server sends tool-input-done
      // with the fully assembled input, so deltas are informational only.
      break

    case 'strand:tool-input-done':
      session.updateToolCall(event.toolCallId, { input: event.input, status: 'running' })
      toolStore.onToolInputDone(event.toolCallId, event.input)
      break

    case 'strand:tool-result':
      session.updateToolCall(event.toolCallId, { output: event.result, status: 'done' })
      toolStore.onToolResult(event.toolCallId, event.result)
      break

    case 'strand:tool-error': {
      const error = new Error(event.error)
      session.updateToolCall(event.toolCallId, { error, status: 'failed' })
      toolStore.onToolError(event.toolCallId, error)
      break
    }

    case 'strand:done':
      session.updateTokenUsage(event.usage)
      session.transition('done')
      toolStore.resetAll()
      break

    case 'strand:error': {
      const error = new StrandError(0, event.message, event.code)
      session.transition('error', error)
      break
    }
  }
}
