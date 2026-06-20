---
title: useAgentSession
description: Multi-step agentic flows with observable step-by-step state.
---

# useAgentSession

Multi-step agentic flows. Give the agent a goal — it uses tools autonomously until it has an answer or reaches `maxSteps`.

## Signature

```ts
const {
  status,       // 'idle' | 'running' | 'paused' | 'done' | 'failed'
  steps,        // AgentStep[]
  currentStep,  // AgentStep | null — the active step, if any
  stepCount,    // number
  run,          // (goal: string) => void
  pause,        // () => void
  resume,       // () => void (v2)
  cancel,       // () => void
  result,       // string | null — final answer when done
  error,        // Error | null
} = useAgentSession(options?)
```

## Options

```ts
interface AgentSessionOptions {
  system?: string
  maxSteps?: number
  tools?: ToolDefinition[]
  onToolCall?: (name, args) => Promise<unknown>
  onStep?: (step: AgentStep) => void
  onComplete?: (result: string) => void
  client?: StrandClient
}
```

## AgentStep

```ts
interface AgentStep {
  index: number
  toolName: string
  input: Record<string, unknown> | null
  output: unknown | null
  status: 'running' | 'done' | 'failed'
}
```

## Example

```tsx
function ResearchAgent() {
  const { status, steps, currentStep, result, run, cancel } = useAgentSession({
    system: 'You are a research assistant. Use tools to find accurate information.',
    maxSteps: 10,
  })

  return (
    <div>
      <button
        onClick={() => run('What is the current global CO₂ level and its trend?')}
        disabled={status === 'running'}
      >
        Research
      </button>

      {status === 'running' && (
        <div>
          <div>Step {steps.length}: {currentStep?.toolName}</div>
          <button onClick={cancel}>Cancel</button>
        </div>
      )}

      {steps.map((step, i) => (
        <div key={i}>
          {step.toolName}: {step.status}
        </div>
      ))}

      {result && <div>{result}</div>}
    </div>
  )
}
```

## Difference from useConversation

`useConversation` is for dialogue — the user sends messages, the assistant responds. `useAgentSession` is for autonomous tasks — you provide a goal, the agent works until complete. There's no back-and-forth.
