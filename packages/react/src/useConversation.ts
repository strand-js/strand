import { useState, useCallback, useRef, useEffect } from 'react'
import type { Message, ToolDefinition, TokenUsage, StrandClient, StreamingStatus, Session } from '@strand/core'
import { SessionStateMachine, processWireEvent } from '@strand/core'
import { useStrandContext } from './StrandProvider'

export interface ConversationOptions {
  system?: string
  tools?: ToolDefinition[]
  onToolCall?: (name: string, args: Record<string, unknown>, output: unknown) => void
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

export function useConversation(options: ConversationOptions = {}): ConversationResult {
  const { client, toolStore } = useStrandContext(options.client)

  // Stable session machine — created once per hook instance
  const machineRef = useRef<SessionStateMachine | null>(null)
  if (!machineRef.current) {
    machineRef.current = new SessionStateMachine(options.sessionId)
  }
  const machine = machineRef.current

  // React state — synced from machine via subscription
  const [session, setSession] = useState<Session>(() => ({ ...machine.session }))

  useEffect(() => {
    // Sync any state set before mount, then subscribe
    setSession({ ...machine.session })
    return machine.subscribe(s => setSession({ ...s }))
  }, [machine])

  // Options ref — avoids stale closures in send callback
  const optionsRef = useRef(options)
  useEffect(() => { optionsRef.current = options })

  // Abort controller ref
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback((content: string) => {
    const { context, onFinish, onError, onToolCall } = optionsRef.current

    machine.addUserMessage(content)
    machine.transition('submitting')

    const abort = new AbortController()
    abortRef.current = abort

    // Run the async generator in the background — no awaiting at call site
    ;(async () => {
      try {
        const generator = client.send(machine.session.messages, {
          context,
          signal: abort.signal,
        })

        for await (const event of generator) {
          if (abort.signal.aborted) break
          processWireEvent(event, machine, toolStore)

          // Observer callback for tool results
          if (event.type === 'strand:tool-result' && onToolCall) {
            const tc = machine.session.messages
              .flatMap(m => m.toolCalls ?? [])
              .find(t => t.id === event.toolCallId)
            if (tc) onToolCall(tc.name, tc.input, event.result)
          }
        }

        // Generator returned normally — check if it was due to abort
        if (abort.signal.aborted) {
          machine.transition('idle')
          return
        }

        if (onFinish) {
          const last = machine.session.messages.at(-1)
          if (last?.role === 'assistant') onFinish(last)
        }
      } catch (err) {
        if (abort.signal.aborted) {
          machine.transition('idle')
          return
        }
        const error = err instanceof Error ? err : new Error(String(err))
        machine.transition('error', error)
        onError?.(error)
      }
    })()
  }, [client, machine, toolStore])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clear = useCallback(() => {
    machine.clear()
    toolStore.resetAll()
  }, [machine, toolStore])

  return {
    messages: session.messages,
    status: session.status,
    isPending: session.status === 'submitting',
    isStreaming: session.status === 'streaming',
    isIdle: session.status === 'idle',
    isDone: session.status === 'done',
    error: session.error,
    tokenUsage: session.tokenUsage,
    send,
    cancel,
    clear,
  }
}
