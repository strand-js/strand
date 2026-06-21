---
title: StrandProvider
description: React context provider that makes the client available to all hooks in the subtree.
---

# StrandProvider

React context provider that makes the `StrandClient` (and the shared `ToolCallStore`) available to all Strand hooks in the subtree.

## Usage

```tsx
import { createStrandClient } from '@strand-js/core'
import { StrandProvider } from '@strand-js/react'

const client = createStrandClient({ baseUrl: '/api/strand' })

function App() {
  return (
    <StrandProvider client={client}>
      {/* All hooks in here can omit the client prop */}
      <Chat />
      <WeatherWidget />
    </StrandProvider>
  )
}
```

## Props

| Prop | Type | Description |
|---|---|---|
| `client` | `StrandClient` | Required. Created with `createStrandClient`. |
| `children` | `ReactNode` | Your app. |

## What it provides

`StrandProvider` creates and manages:

1. **`StrandClient`** — the HTTP client that calls your strand server endpoint
2. **`ToolCallStore`** — the observable store that `useToolCall` subscribes to

Both are shared across the entire subtree. This is what allows `useToolCall('get_weather')` to see updates from `useConversation` even when they're in different components.

## Multiple providers

Use multiple providers to create independent AI sessions — for example, two chat panels that don't share state:

```tsx
<div style={{ display: 'flex' }}>
  <StrandProvider client={clientA}>
    <ChatPanel />
    {/* useToolCall here subscribes to clientA's tools */}
  </StrandProvider>

  <StrandProvider client={clientB}>
    <ChatPanel />
    {/* useToolCall here subscribes to clientB's tools */}
  </StrandProvider>
</div>
```
