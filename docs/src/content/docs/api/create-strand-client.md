---
title: createStrandClient
description: Create the client instance that connects your React hooks to your server endpoint.
---

# createStrandClient

Creates the client instance that connects React hooks to your strand server endpoint.

## Signature

```ts
const client = createStrandClient(config)
```

## Config

```ts
interface StrandClientConfig {
  baseUrl: string
  retry?: {
    maxAttempts?: number            // default: 3
    backoff?: 'exponential' | 'linear' | 'none'  // default: 'exponential'
    retryOn?: Array<'rate_limit' | 'server_error' | 'timeout'>
  }
  contextWindow?: {
    strategy?: 'truncate-oldest' | 'sliding-window' | 'none'  // default: 'truncate-oldest'
    maxTokens?: number              // default: 100_000
  }
}
```

### `baseUrl`
**Required.** The URL of your strand server endpoint. Typically `/api/strand`.

### `retry`
Configure automatic retry behavior for transient failures.

- `maxAttempts` — total attempts including the first (default: 3)
- `backoff` — delay strategy between retries. `exponential` = 1s, 2s, 4s…; `linear` = 1s flat; `none` = immediate
- `retryOn` — which error codes trigger a retry

### `contextWindow`
Automatically trim conversation history before sending to stay within token limits.

- `truncate-oldest` (default) — removes oldest messages first, always keeps the most recent
- `sliding-window` — keeps the most recent messages that fit within `maxTokens`
- `none` — send full history, no trimming

## Example

```ts
import { createStrandClient } from '@strand-js/core'

const client = createStrandClient({
  baseUrl: '/api/strand',
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    retryOn: ['rate_limit', 'server_error'],
  },
  contextWindow: {
    strategy: 'truncate-oldest',
    maxTokens: 100_000,
  },
})
```
