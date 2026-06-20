---
title: useConversation
description: The main hook — manages a full conversation with streaming, tool calls, and history.
---

# useConversation

The main hook. Manages a full conversation with streaming, tool calls, and history.

## Signature

```ts
const {
  messages,       // Message[]
  send,           // (content: string) => void
  status,         // 'idle' | 'submitting' | 'streaming' | 'done' | 'error'
  isPending,      // true when request in-flight, no tokens yet
  isStreaming,    // true when tokens arriving
  isIdle,         // true when no active request
  isDone,         // true briefly after response completes (resets to idle)
  error,          // Error | null
  cancel,         // () => void
  clear,          // () => void — reset conversation history
  tokenUsage,     // { input: number, output: number, total: number }
} = useConversation(options?)
```

## Options

```ts
interface ConversationOptions {
  system?: string
  tools?: ToolDefinition[]
  onToolCall?: (name: string, args: Record<string, unknown>, output: unknown) => void
  context?: Record<string, unknown>
  sessionId?: string
  onFinish?: (message: Message) => void
  onError?: (error: Error) => void
  client?: StrandClient
}
```

### `system`
The system prompt. Sets the assistant's persona and instructions.

### `tools`
Tool definitions using Zod schemas. Define tools here if they execute on the client; for server-side tools, define them in `createStrandHandler`.

### `onToolCall`
Observer callback that fires when a tool result arrives. Use this for client-side side effects (navigation, updating local state). The return value is not sent back to the LLM.

### `context`
Per-request context attached to every call. No stale closure bugs — values are always current when the request fires.

```ts
const { send } = useConversation({
  context: {
    userId: user.id,       // always the latest value
    locale: settings.locale,
  },
})
```

### `sessionId`
Share or persist session state by ID. Two components with the same `sessionId` share messages, status, and token usage.

### `client`
Override the client from `StrandProvider`. Only needed if using multiple providers.

## Example

```tsx
function Chat() {
  const { messages, send, isPending, isStreaming, cancel, clear, tokenUsage } =
    useConversation({
      system: 'You are a helpful assistant.',
      onFinish: (msg) => console.log('Done:', msg.content),
    })

  return (
    <>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}

      {isPending && <div>Thinking…</div>}

      <button onClick={() => send('Hello')} disabled={isPending || isStreaming}>
        Send
      </button>

      {(isPending || isStreaming) && (
        <button onClick={cancel}>Stop</button>
      )}

      <button onClick={clear}>New conversation</button>

      <div>Tokens used: {tokenUsage.total}</div>
    </>
  )
}
```
