# @strand-js/anthropic

Anthropic provider adapter for [Strand](https://github.com/strand-js/strand) — AI state management for React.

## Install

```bash
npm install @strand-js/anthropic
```

## Usage

### Express / Fastify / Hono

```ts
import { createStrandHandler } from '@strand-js/anthropic'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  system: 'You are a helpful assistant.',
}))
```

### Next.js App Router

```ts
// app/api/strand/route.ts
import { createStrandRoute } from '@strand-js/anthropic'

export const POST = createStrandRoute({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
})
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

createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  tools: [weatherTool],
  onToolCall: async (name, args) => fetchWeather(args.location),
})
```

## Production security checklist

Before going live, configure these options:

```ts
createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',

  // 1. REQUIRED: authenticate every request
  // Without this, anyone can hit your endpoint and burn your API credits.
  authorize: async (request) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = await verifyToken(token)
    if (!user) throw new Error('Unauthorized') // returns 401, no LLM call is made
  },

  // 2. RECOMMENDED: built-in rate limiting by IP
  // Prevents a single user from spamming your endpoint.
  rateLimit: {
    windowMs: 60_000,   // 1 minute window
    maxRequests: 20,    // max 20 requests per IP per minute
  },

  // 3. RECOMMENDED: limit message size
  // Prevents oversized payloads from reaching the LLM.
  maxMessages: 50,
  maxMessageLength: 10_000,
})
```

**Also configure on your server (outside Strand):**
- **CORS** — restrict which origins can call your endpoint
- **HTTPS** — never run in production over HTTP

## What `authorize` is

`authorize` is a function you provide that runs before any LLM call. Strand calls it with the incoming request. If it throws, the request is rejected with a 401 and no API credits are used. If it resolves, the request continues.

```ts
// JWT example
authorize: async (request) => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const user = await verifyJWT(token)
  if (!user) throw new Error('Unauthorized')
}

// Simple shared secret example
authorize: async (request) => {
  if (request.headers.get('x-api-key') !== process.env.MY_SECRET)
    throw new Error('Unauthorized')
}
```

## Config reference

| Option | Type | Description |
|---|---|---|
| `apiKey` | `string` | Your Anthropic API key |
| `model` | `string` | Model ID, e.g. `'claude-sonnet-4-6'` |
| `system` | `string \| (req) => string` | System prompt (static or dynamic) |
| `tools` | `ToolDefinition[]` | Tools available to the model |
| `onToolCall` | `async (name, args, ctx) => result` | Server-side tool execution |
| `authorize` | `async (req) => void` | Throw to reject with 401 |
| `rateLimit` | `{ windowMs, maxRequests }` | Built-in IP rate limiting |
| `maxMessages` | `number` | Max messages per request (default: 100) |
| `maxMessageLength` | `number` | Max chars per message (default: 50,000) |
| `maxSteps` | `number` | Max tool call rounds (default: 10) |
| `onFinish` | `(session) => void` | Called after response completes |

[Full documentation →](https://github.com/strand-js/strand)
