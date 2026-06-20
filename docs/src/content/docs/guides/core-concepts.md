---
title: Core Concepts
description: Sessions, streaming lifecycle, the wire protocol, and tool call state.
---

# Core Concepts

## How Strand works

Strand splits cleanly across your stack:

```
Browser                    Your Server               LLM Provider
─────────────────────      ──────────────────────    ─────────────
@strand/react              @strand/anthropic         Anthropic API
useConversation()    ───►  createStrandHandler() ───► claude-*
useToolCall()              (tool execution here)
useAgentSession()    ◄───  SSE stream ◄───────────── streaming tokens
```

Your API key never leaves the server. The React hooks never touch raw HTTP.

## Sessions

A session is more than a messages array. It carries identity, token tracking, and a lifecycle:

```ts
interface Session {
  id: string
  messages: Message[]
  status: 'idle' | 'submitting' | 'streaming' | 'done' | 'error'
  tokenUsage: { input: number; output: number; total: number }
  error: Error | null
}
```

Sessions are created automatically by `useConversation`. Pass a `sessionId` to share state across components.

## Streaming lifecycle

Strand tracks **four distinct states**. Other libraries collapse these into `isLoading` — which is why they get stuck.

```
idle  →  submitting  →  streaming  →  done  →  idle
                                  ↘  error →  idle
```

| State | Meaning | Hook properties |
|---|---|---|
| `idle` | No active request | `isIdle: true` |
| `submitting` | Request sent, no tokens yet | `isPending: true` |
| `streaming` | Tokens arriving | `isStreaming: true` |
| `done` | Response complete (resets next tick) | `isDone: true` |
| `error` | Request failed | `error: Error` |

`isPending` and `isStreaming` are not the same thing. `isPending` is the window between sending and receiving the first token. Use it to show a "waiting…" state distinct from the streaming animation.

## The Message type

```ts
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string          // accumulates during streaming
  toolCalls?: ToolCall[]   // present when the model used tools
  createdAt: Date
}
```

## Tool call state

Every tool call has an observable lifecycle:

```
pending  →  running  →  done
                     ↘  failed
```

Use `useToolCall('tool_name')` to subscribe to a specific tool's state anywhere in your component tree — not just inside the component that called `send()`.

## StrandProvider and context

`StrandProvider` creates a `ToolCallStore` that's shared across the entire subtree. This is what makes `useToolCall` work from any component:

```tsx
<StrandProvider client={client}>
  <Chat />           {/* uses useConversation */}
  <WeatherWidget />  {/* uses useToolCall('get_weather') — just works */}
</StrandProvider>
```

## Context window management

Strand automatically manages the context window so long conversations don't exceed token limits. Configure it on the client:

```ts
const client = createStrandClient({
  baseUrl: '/api/strand',
  contextWindow: {
    strategy: 'truncate-oldest',  // 'truncate-oldest' | 'sliding-window' | 'none'
    maxTokens: 100_000,
  },
})
```

`truncate-oldest` (default) removes the oldest messages when the conversation exceeds `maxTokens`. The most recent message is always preserved.

## Retry and backoff

Transient failures (rate limits, server errors) are retried automatically:

```ts
const client = createStrandClient({
  baseUrl: '/api/strand',
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',            // 1s, 2s, 4s…
    retryOn: ['rate_limit', 'server_error'],
  },
})
```
