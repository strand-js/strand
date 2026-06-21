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

### With auth

```ts
createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  authorize: async (request) => {
    const user = await verifyToken(request.headers.get('authorization'))
    if (!user) throw new Error('Unauthorized')
  },
})
```

[Full documentation →](https://github.com/strand-js/strand)
