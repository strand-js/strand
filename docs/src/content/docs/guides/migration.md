---
title: Migration from Vercel AI SDK
description: How to move from @ai-sdk/react to @strandjs/react.
---

# Migration from Vercel AI SDK

This guide covers moving from `@ai-sdk/react` to `@strandjs/react`.

## Why migrate?

You might want Strand if you need:
- React Native support (Vercel AI SDK doesn't stream in RN)
- Per-tool observable state (`useToolCall`)
- Context window management (explicitly excluded from Vercel AI SDK)
- Stable context injection (Vercel AI SDK has a stale closure footgun)
- Framework-agnostic server handlers (not tied to Next.js)

You might NOT want to migrate if you're deep in Next.js App Router and the existing SDK works for you.

## Server side

### Before (Vercel AI SDK + Next.js)
```ts
// app/api/chat/route.ts
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(req: Request) {
  const { messages } = await req.json()
  const result = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
  })
  return result.toDataStreamResponse()
}
```

### After (Strand)
```ts
// app/api/strand/route.ts
import { createStrandRoute } from '@strandjs/anthropic'

export const POST = createStrandRoute({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
})
```

Works with Express, Fastify, Hono, or any Node.js framework via `createStrandHandler`.

## Client side

### Before
```tsx
import { useChat } from '@ai-sdk/react'

function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat()

  return (
    <form onSubmit={handleSubmit}>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      <input value={input} onChange={handleInputChange} />
      <button type="submit" disabled={isLoading}>Send</button>
      {isLoading && <button onClick={stop}>Stop</button>}
    </form>
  )
}
```

### After
```tsx
import { useConversation } from '@strandjs/react'

function Chat() {
  const { messages, send, isPending, isStreaming, cancel } = useConversation()
  
  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      <input
        disabled={isPending || isStreaming}
        onKeyDown={e => { if (e.key === 'Enter') send(e.currentTarget.value) }}
      />
      {(isPending || isStreaming) && <button onClick={cancel}>Stop</button>}
    </div>
  )
}
```

## Key differences

| | Vercel AI SDK | Strand |
|---|---|---|
| Input management | `input` + `handleInputChange` props | Uncontrolled — you manage the input |
| Loading state | Single `isLoading` | `isPending` (no tokens) + `isStreaming` (tokens arriving) |
| Stop/cancel | `stop()` | `cancel()` |
| Tool state | Not available | `useToolCall('tool_name')` |
| Context window | Not managed | Automatic with `truncate-oldest` |

## Tool calling

### Before (Vercel AI SDK)
```tsx
// Server only — no client visibility into tool state
const result = await streamText({
  model: anthropic(...),
  tools: { get_weather: { ... } },
})
```

### After (Strand)
```tsx
// Server — define tools here for execution
createStrandRoute({
  tools: [weatherTool],
  onToolCall: async (name, args) => fetchWeather(args.location),
})

// Client — subscribe to tool state anywhere
function WeatherStatus() {
  const { status, input, output } = useToolCall('get_weather')
  if (status === 'running') return <div>Checking {input?.location}…</div>
  if (status === 'done') return <div>{output?.temp}°F</div>
  return null
}
```
