---
title: Anthropic
description: Using @strand/anthropic to connect Claude to your Strand app.
---

# Anthropic

`@strand/anthropic` provides server-side handlers that call the Anthropic API and stream wire events back to your client hooks.

## Install

```bash
npm install @strand/anthropic
```

## createStrandHandler

For Express, Fastify, Hono, or any Node.js HTTP framework:

```ts
import { createStrandHandler } from '@strand/anthropic'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  system: 'You are a helpful assistant.',
}))
```

### With tools

```ts
import { z } from 'zod'
import { tool } from '@strand/core'

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
import { createStrandRoute } from '@strand/anthropic'

export const POST = createStrandRoute({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
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
| `maxSteps` | `number` | Max tool call rounds per request (default: 10) |
| `onRequest` | `(req) => void` | Inspect incoming requests |
| `onFinish` | `(session) => void` | Called after response completes |
