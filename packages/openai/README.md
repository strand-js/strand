# @strand-js/openai

OpenAI provider adapter for [Strand](https://github.com/strand-js/strand) — AI state management for React.

## Install

```bash
npm install @strand-js/openai
```

## Usage

### Express / Fastify / Hono

```ts
import { createStrandHandler } from '@strand-js/openai'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
  system: 'You are a helpful assistant.',
}))
```

### Next.js App Router

```ts
// app/api/strand/route.ts
import { createStrandRoute } from '@strand-js/openai'

export const POST = createStrandRoute({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
})
```

## Production security checklist

Before going live, configure these options:

```ts
createStrandHandler({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',

  // 1. REQUIRED: authenticate every request
  // Without this, anyone can hit your endpoint and burn your API credits.
  authorize: async (request) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const user = await verifyToken(token)
    if (!user) throw new Error('Unauthorized') // returns 401, no LLM call is made
  },

  // 2. RECOMMENDED: built-in rate limiting by IP
  rateLimit: {
    windowMs: 60_000,   // 1 minute window
    maxRequests: 20,    // max 20 requests per IP per minute
  },

  // 3. RECOMMENDED: limit message size
  maxMessages: 50,
  maxMessageLength: 10_000,
})
```

**Also configure on your server (outside Strand):**
- **CORS** — restrict which origins can call your endpoint
- **HTTPS** — never run in production over HTTP

## What `authorize` is

`authorize` runs before any LLM call. If it throws, the request is rejected with a 401 and no API credits are used.

```ts
// JWT example
authorize: async (request) => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const user = await verifyJWT(token)
  if (!user) throw new Error('Unauthorized')
}
```

## Switching providers

Only the server changes — the React hooks are identical:

```diff
- import { createStrandHandler } from '@strand-js/anthropic'
+ import { createStrandHandler } from '@strand-js/openai'

  createStrandHandler({
-   apiKey: process.env.ANTHROPIC_API_KEY,
-   model: 'claude-sonnet-4-6',
+   apiKey: process.env.OPENAI_API_KEY,
+   model: 'gpt-4o',
  })
```

## Config reference

| Option | Type | Description |
|---|---|---|
| `apiKey` | `string` | Your OpenAI API key |
| `model` | `string` | Model ID, e.g. `'gpt-4o'` |
| `system` | `string \| (req) => string` | System prompt |
| `tools` | `ToolDefinition[]` | Tools available to the model |
| `onToolCall` | `async (name, args, ctx) => result` | Server-side tool execution |
| `authorize` | `async (req) => void` | Throw to reject with 401 |
| `rateLimit` | `{ windowMs, maxRequests }` | Built-in IP rate limiting |
| `maxMessages` | `number` | Max messages per request (default: 100) |
| `maxMessageLength` | `number` | Max chars per message (default: 50,000) |
| `maxSteps` | `number` | Max tool call rounds (default: 10) |

[Full documentation →](https://github.com/strand-js/strand)
