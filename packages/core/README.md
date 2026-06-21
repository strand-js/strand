# @strand-js/core

Core types, client, and state primitives for [Strand](https://github.com/strand-js/strand) — AI state management for React.

## Install

```bash
npm install @strand-js/core zod
```

## What's in here

- `createStrandClient(config)` — creates the HTTP client used by all React hooks
- `SessionStateMachine` — 4-state streaming lifecycle (`idle → submitting → streaming → done`)
- `ToolCallStore` — per-tool observable state for parallel tool call tracking
- `processWireEvent` — routes SSE wire events to session and tool state
- `validateMessages` — input sanitization for server handlers
- `tool(definition)` — Zod-typed tool definition helper
- All shared TypeScript types (`Session`, `Message`, `ToolCall`, `WireEvent`, etc.)

## Usage

```ts
import { createStrandClient } from '@strand-js/core'

const client = createStrandClient({
  baseUrl: '/api/strand',
  retry: { maxAttempts: 3, backoff: 'exponential' },
  contextWindow: { strategy: 'truncate-oldest', maxTokens: 100_000 },
})
```

## Part of Strand

| Package | Description |
|---|---|
| `@strand-js/core` | Core types and client |
| `@strand-js/react` | React hooks |
| `@strand-js/anthropic` | Anthropic server handler |
| `@strand-js/openai` | OpenAI server handler |
| `@strand-js/react-native` | React Native streaming patch |

[Full documentation →](https://github.com/strand-js/strand)
