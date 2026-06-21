import { useState, useCallback, useRef, useEffect } from 'react'
import type { ToolDefinition, StrandClient } from '@strand-js/core'
import { SessionStateMachine, processWireEvent } from '@strand-js/core'
import { useStrandContext } from './StrandProvider'

export interface AgentStep {
  index: number
  toolName: string
  input: Record<string, unknown> | null
  output: unknown | null
  status: 'running' | 'done' | 'failed'
}

export type AgentStatus = 'idle' | 'running' | 'paused' | 'done' | 'failed'

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

export function useAgentSession(options: AgentSessionOptions = {}): AgentSessionResult {
  const { client, toolStore } = useStrandContext(options.client)

  const machineRef = useRef<SessionStateMachine | null>(null)
  if (!machineRef.current) machineRef.current = new SessionStateMachine()
  const machine = machineRef.current

  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const optionsRef = useRef(options)
  useEffect(() => { optionsRef.current = options })

  // Track active step index keyed by toolCallId
  const activeStepsRef = useRef<Map<string, number>>(new Map())

  const run = useCallback((goal: string) => {
    setAgentStatus('running')
    setSteps([])
    setResult(null)
    setError(null)
    activeStepsRef.current.clear()
    machine.clear()
    machine.addUserMessage(goal)

    const abort = new AbortController()
    abortRef.current = abort

    ;(async () => {
      try {
        const generator = client.send(machine.session.messages, {
          context: undefined,
          signal: abort.signal,
        })

        for await (const event of generator) {
          if (abort.signal.aborted) break
          processWireEvent(event, machine, toolStore)

          if (event.type === 'strand:tool-start') {
            const idx = activeStepsRef.current.size
            activeStepsRef.current.set(event.toolCallId, idx)
            const step: AgentStep = {
              index: idx,
              toolName: event.toolName,
              input: null,
              output: null,
              status: 'running',
            }
            setSteps(prev => {
              const next = [...prev]
              next[idx] = step
              return next
            })
            optionsRef.current.onStep?.(step)
          }

          if (event.type === 'strand:tool-input-done') {
            const idx = activeStepsRef.current.get(event.toolCallId)
            if (idx !== undefined) {
              setSteps(prev => {
                const next = [...prev]
                next[idx] = { ...next[idx], input: event.input }
                return next
              })
            }
          }

          if (event.type === 'strand:tool-result') {
            const idx = activeStepsRef.current.get(event.toolCallId)
            if (idx !== undefined) {
              setSteps(prev => {
                const next = [...prev]
                next[idx] = { ...next[idx], output: event.result, status: 'done' }
                return next
              })
            }
          }
        }

        if (abort.signal.aborted) {
          setAgentStatus('idle')
          return
        }

        // Extract final text output from session messages
        const finalText = machine.session.messages
          .filter(m => m.role === 'assistant' && m.content)
          .map(m => m.content)
          .join('')

        setResult(finalText)
        setAgentStatus('idle')
        optionsRef.current.onComplete?.(finalText)
      } catch (err) {
        if (abort.signal.aborted) { setAgentStatus('idle'); return }
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        setAgentStatus('failed')
      }
    })()
  }, [client, machine, toolStore])

  const cancel = useCallback(() => { abortRef.current?.abort() }, [])
  const pause = useCallback(() => { abortRef.current?.abort(); setAgentStatus('paused') }, [])
  const resume = useCallback(() => {}, []) // v2: resume from checkpoint

  const currentStep = steps.find(s => s.status === 'running') ?? null

  return { status: agentStatus, steps, currentStep, stepCount: steps.length, run, pause, resume, cancel, result, error }
}
