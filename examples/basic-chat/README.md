# basic-chat

A minimal Vite + React chat app using `@strandjs/react` and `@strandjs/anthropic`.

## Setup

```bash
pnpm install
cp .env.example .env          # add your ANTHROPIC_API_KEY
pnpm dev
```

## What it shows

- `useConversation` — streaming chat with live token-by-token rendering
- `isPending` / `isStreaming` — correct 4-state lifecycle (no stuck loading states)
- `cancel()` — abort mid-stream
- `clear()` — reset conversation
- `tokenUsage` — input/output token display
