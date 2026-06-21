# @strand-js/google

Google Gemini provider adapter for [Strand](https://github.com/strand-js/strand) — AI state management for React.

## Install

```bash
npm install @strand-js/google
```

## Usage

### Express / Fastify / Hono

```ts
import { createStrandHandler } from '@strand-js/google'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.0-flash',
  system: 'You are a helpful assistant.',
}))
```

### Next.js App Router

```ts
// app/api/strand/route.ts
import { createStrandRoute } from '@strand-js/google'

export const POST = createStrandRoute({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.0-flash',
})
```

## Get a Google API key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key**
3. Create a new key or use an existing project

## Supported models

| Model | Notes |
|---|---|
| `gemini-2.0-flash` | Fastest, recommended for most use cases |
| `gemini-2.5-pro` | Most capable |
| `gemini-1.5-pro` | Previous generation |
| `gemini-1.5-flash` | Previous generation, fast |

## Switching from Anthropic

Only the server changes — the React hooks are identical:

```diff
- import { createStrandHandler } from '@strand-js/anthropic'
+ import { createStrandHandler } from '@strand-js/google'

  createStrandHandler({
-   apiKey: process.env.ANTHROPIC_API_KEY,
-   model: 'claude-sonnet-4-6',
+   apiKey: process.env.GOOGLE_API_KEY,
+   model: 'gemini-2.0-flash',
  })
```

## Production security

```ts
createStrandHandler({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.0-flash',
  authorize: async (request) => {
    const user = await verifyToken(request.headers.get('authorization'))
    if (!user) throw new Error('Unauthorized')
  },
  rateLimit: { windowMs: 60_000, maxRequests: 20 },
  maxMessages: 50,
  maxMessageLength: 10_000,
})
```

## Config reference

| Option | Type | Description |
|---|---|---|
| `apiKey` | `string` | Your Google AI API key |
| `model` | `string` | Model ID, e.g. `'gemini-2.0-flash'` |
| `system` | `string \| (req) => string` | System prompt |
| `tools` | `ToolDefinition[]` | Tools available to the model |
| `onToolCall` | `async (name, args, ctx) => result` | Server-side tool execution |
| `authorize` | `async (req) => void` | Throw to reject with 401 |
| `rateLimit` | `{ windowMs, maxRequests }` | Built-in IP rate limiting |
| `maxMessages` | `number` | Max messages per request (default: 100) |
| `maxMessageLength` | `number` | Max chars per message (default: 50,000) |
| `maxSteps` | `number` | Max tool call rounds (default: 10) |

[Full documentation →](https://github.com/strand-js/strand)
