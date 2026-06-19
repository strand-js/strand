import type { ToolCallState } from './types'

function idleState(): ToolCallState {
  return { id: null, toolName: null, status: 'idle', input: null, output: null, error: null }
}

export class ToolCallStore {
  // toolCallId → toolName for reverse lookups
  private _idToName = new Map<string, string>()
  // toolName → current state (latest invocation wins)
  private _states = new Map<string, ToolCallState>()
  private _listeners = new Map<string, Set<(state: ToolCallState) => void>>()

  getState<TInput = unknown, TOutput = unknown>(toolName: string): ToolCallState<TInput, TOutput> {
    return (this._states.get(toolName) ?? idleState()) as ToolCallState<TInput, TOutput>
  }

  subscribe(toolName: string, listener: (state: ToolCallState) => void): () => void {
    if (!this._listeners.has(toolName)) this._listeners.set(toolName, new Set())
    this._listeners.get(toolName)!.add(listener)
    return () => this._listeners.get(toolName)?.delete(listener)
  }

  onToolStart(toolCallId: string, toolName: string): void {
    this._idToName.set(toolCallId, toolName)
    this._set(toolName, { id: toolCallId, toolName, status: 'pending', input: null, output: null, error: null })
  }

  onToolInputDone(toolCallId: string, input: Record<string, unknown>): void {
    const toolName = this._idToName.get(toolCallId)
    if (!toolName) return
    const current = this._states.get(toolName)
    if (current?.id !== toolCallId) return // stale — a newer call superseded this one
    this._set(toolName, { ...current, status: 'running', input })
  }

  onToolResult(toolCallId: string, result: unknown): void {
    const toolName = this._idToName.get(toolCallId)
    if (!toolName) return
    const current = this._states.get(toolName)
    if (current?.id !== toolCallId) return
    this._set(toolName, { ...current, status: 'done', output: result })
  }

  onToolError(toolCallId: string, error: Error): void {
    const toolName = this._idToName.get(toolCallId)
    if (!toolName) return
    const current = this._states.get(toolName)
    if (current?.id !== toolCallId) return
    this._set(toolName, { ...current, status: 'failed', error })
  }

  resetAll(): void {
    this._idToName.clear()
    for (const toolName of this._states.keys()) {
      this._set(toolName, idleState())
    }
  }

  private _set(toolName: string, state: ToolCallState): void {
    this._states.set(toolName, state)
    this._listeners.get(toolName)?.forEach(l => l(state))
  }
}
