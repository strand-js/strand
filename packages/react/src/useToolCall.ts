import { useState, useEffect } from 'react'
import type { ToolCallState, StrandClient } from '@strandjs/core'
import { useStrandContext } from './StrandProvider'

export interface ToolCallResult<TInput = unknown, TOutput = unknown> {
  status: 'idle' | 'pending' | 'running' | 'done' | 'failed'
  input: TInput | null
  output: TOutput | null
  error: Error | null
  isRunning: boolean
}

export function useToolCall<TInput = unknown, TOutput = unknown>(
  toolName: string,
  options?: { client?: StrandClient },
): ToolCallResult<TInput, TOutput> {
  const { toolStore } = useStrandContext(options?.client)

  const [state, setState] = useState<ToolCallState<TInput, TOutput>>(
    () => toolStore.getState<TInput, TOutput>(toolName),
  )

  useEffect(() => {
    // Sync on mount in case state changed before effect ran
    setState(toolStore.getState<TInput, TOutput>(toolName))
    return toolStore.subscribe(toolName, s => setState(s as ToolCallState<TInput, TOutput>))
  }, [toolStore, toolName])

  return {
    status: state.status,
    input: state.input,
    output: state.output,
    error: state.error,
    isRunning: state.status === 'running',
  }
}
