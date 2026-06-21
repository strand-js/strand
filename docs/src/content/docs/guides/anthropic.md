---
title: Anthropic
description: Using @strand-js/anthropic to connect Claude to your Strand app.
---

# Anthropic

`@strand-js/anthropic` provides server-side handlers that call the Anthropic API and stream wire events back to your client hooks.

## Install

```bash
npm install @strand-js/anthropic
```

## createStrandHandler

For Express, Fastify, Hono, or any Node.js HTTP framework:

```ts
import { createStrandHandler } from '@strand-js/anthropic'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  system: 'You are a helpful assistant.',
}))
```

### With tools

```ts
import { z } from 'zod'
import { tool } from '@strand-js/core'

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get weather for a city',
  parameters: z.object({ location: z.string() }),
})

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  tools: [weatherTool],
  onToolCall: async (name, args) => {
    if (name === 'get_weather') return fetchWeather(args.location)
  },
}))
```

### Dynamic system prompts

```ts
createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  system: async (request) => {
    const user = await getUser(request)
    return `You are a helpful assistant for ${user.company}.`
  },
})
```

## createStrandRoute

For Next.js App Router:

```ts
// app/api/strand/route.ts
import { createStrandRoute } from '@strand-js/anthropic'

export const POST = createStrandRoute({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
})
```

## Authorization

The `/api/strand` endpoint should be protected before going to production. Use the `authorize` callback — it runs before any LLM calls and before SSE headers are set:

```ts
createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  authorize: async (request) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = await verifyToken(token)
    if (!user) throw new Error('Unauthorized') // returns 401 to caller
    return user // available in ctx if needed
  },
})
```

If `authorize` throws, the handler returns `401` with a JSON error body — no SSE stream is opened and no API credits are used.

## Input validation

Messages are validated automatically before any LLM call:
- Only `'user'` and `'assistant'` roles are accepted — `'system'` role injection from the client is blocked
- Message count and content length limits are enforced

Configure limits:
```ts
createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  maxMessages: 50,          // default: 100
  maxMessageLength: 10_000, // default: 50_000 chars per message
})
```

## Config options

| Option | Type | Description |
|---|---|---|
| `apiKey` | `string` | Your Anthropic API key |
| `model` | `string` | Model ID, e.g. `'claude-sonnet-4-6'` |
| `system` | `string \| (req) => string` | System prompt (static or dynamic) |
| `tools` | `ToolDefinition[]` | Tools available to the model |
| `onToolCall` | `async (name, args, ctx) => result` | Tool execution handler |
| `authorize` | `async (req) => void` | Throw to reject with 401. Runs before any LLM call. |
| `maxMessages` | `number` | Max messages per request (default: 100) |
| `maxMessageLength` | `number` | Max chars per message (default: 50,000) |
| `maxSteps` | `number` | Max tool call rounds per request (default: 10) |
| `onRequest` | `(req) => void` | Inspect incoming requests |
| `onFinish` | `(session) => void` | Called after response completes |
