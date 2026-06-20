---
title: Quick Start
description: Get a streaming AI chat running in 5 minutes.
---

import { Tabs, TabItem } from '@astrojs/starlight/components'

# Quick Start

Get a streaming chat app running in 5 minutes.

## Install

**Client:**
```bash
npm install @strand/core @strand/react zod
```

**Server:**
```bash
# Anthropic
npm install @strand/anthropic

# OpenAI
npm install @strand/openai
```

## 1. Set up the server endpoint

<Tabs>
<TabItem label="Express / Fastify / Hono">
```ts
import { createStrandHandler } from '@strand/anthropic'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
}))
```
</TabItem>
<TabItem label="Next.js App Router">
```ts
// app/api/strand/route.ts
import { createStrandRoute } from '@strand/anthropic'

export const POST = createStrandRoute({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
})
```
</TabItem>
</Tabs>

## 2. Configure the client

```tsx
// main.tsx
import { createStrandClient } from '@strand/core'
import { StrandProvider } from '@strand/react'

const client = createStrandClient({ baseUrl: '/api/strand' })

function App() {
  return (
    <StrandProvider client={client}>
      <YourApp />
    </StrandProvider>
  )
}
```

## 3. Use the hook

```tsx
import { useConversation } from '@strand/react'

function Chat() {
  const { messages, send, isPending, isStreaming, cancel } = useConversation({
    system: 'You are a helpful assistant.',
  })

  return (
    <div>
      {messages.map(m => (
        <div key={m.id} data-role={m.role}>
          {m.content}
        </div>
      ))}

      {isPending && <div>Waiting for first token…</div>}
      {isStreaming && <div>Streaming…</div>}

      <input
        disabled={isPending || isStreaming}
        onKeyDown={e => {
          if (e.key === 'Enter') send(e.currentTarget.value)
        }}
      />

      {(isPending || isStreaming) && (
        <button onClick={cancel}>Stop</button>
      )}
    </div>
  )
}
```

That's it. Your API key never leaves the server. The hooks handle streaming, error states, cancellation, and history.

## Next steps

- [Core Concepts](/guides/core-concepts) — understand sessions, streaming states, and tool calls
- [useConversation](/api/use-conversation) — full API reference
- [Tool Calling](/api/use-tool-call) — add tools to your conversations
