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

### Switching from Anthropic

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

[Full documentation →](https://github.com/strand-js/strand)
