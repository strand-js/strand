---
title: OpenAI
description: Using @strandjs/openai to connect GPT models to your Strand app.
---

# OpenAI

`@strandjs/openai` provides server-side handlers that call the OpenAI API and stream wire events back to your client hooks.

## Install

```bash
npm install @strandjs/openai
```

## createStrandHandler

```ts
import { createStrandHandler } from '@strandjs/openai'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
  system: 'You are a helpful assistant.',
}))
```

## createStrandRoute (Next.js)

```ts
// app/api/strand/route.ts
import { createStrandRoute } from '@strandjs/openai'

export const POST = createStrandRoute({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
})
```

## With tools

```ts
import { z } from 'zod'
import { tool } from '@strandjs/core'

const searchTool = tool({
  name: 'search',
  description: 'Search the web',
  parameters: z.object({ query: z.string() }),
})

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
  tools: [searchTool],
  onToolCall: async (name, args) => {
    if (name === 'search') return webSearch(args.query)
  },
}))
```

## Switching providers

The client and all React hooks are identical regardless of provider. To switch from Anthropic to OpenAI, only the server changes:

```diff
- import { createStrandHandler } from '@strandjs/anthropic'
+ import { createStrandHandler } from '@strandjs/openai'

  app.post('/api/strand', createStrandHandler({
-   apiKey: process.env.ANTHROPIC_API_KEY,
-   model: 'claude-sonnet-4-6',
+   apiKey: process.env.OPENAI_API_KEY,
+   model: 'gpt-4o',
  }))
```

Zero changes on the frontend.
