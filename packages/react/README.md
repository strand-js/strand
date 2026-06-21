# @strand-js/react

React hooks for [Strand](https://github.com/strand-js/strand) — AI state management for React.

## Install

```bash
npm install @strand-js/core @strand-js/react zod
```

## Hooks

### `useConversation` — streaming chat with tool calls

```tsx
import { useConversation } from '@strand-js/react'

function Chat() {
  const { messages, send, isPending, isStreaming, cancel } = useConversation({
    system: 'You are a helpful assistant.',
  })

  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      {isPending && <div>Thinking...</div>}
      <input onKeyDown={e => e.key === 'Enter' && send(e.currentTarget.value)} />
      {(isPending || isStreaming) && <button onClick={cancel}>Stop</button>}
    </div>
  )
}
```

### `useToolCall` — per-tool observable state

```tsx
const { status, input, output } = useToolCall('get_weather')
// status: 'idle' | 'pending' | 'running' | 'done' | 'failed'
```

### `useAgentSession` — multi-step autonomous agents

```tsx
const { status, steps, result, run, cancel } = useAgentSession({ maxSteps: 10 })
run('Research the latest AI developments')
```

### `useStreamingText` — low-level streaming primitive

```tsx
const { text, isDone, isStreaming } = useStreamingText(readableStream)
```

## Setup

```tsx
import { createStrandClient } from '@strand-js/core'
import { StrandProvider } from '@strand-js/react'

const client = createStrandClient({ baseUrl: '/api/strand' })

function App() {
  return (
    <StrandProvider client={client}>
      <YourApp />
    </StrandProvider>
  )
}
```

## Why Strand?

- `isPending` and `isStreaming` are separate — fixes the `isLoading` design flaw in other libraries
- `useToolCall` works from any component in the tree — not just where `send()` was called
- Stable context injection — no stale closure bugs
- Built-in retry, context window management, and React Native support

[Full documentation →](https://github.com/strand-js/strand)
