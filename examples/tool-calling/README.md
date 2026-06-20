# tool-calling

Shows `useToolCall` — real-time per-tool state anywhere in the component tree.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## What it shows

- `useToolCall('get_weather')` — live status (`pending → running → done`) visible in a separate component from `useConversation`
- Tool input streams in character by character, then resolves
- Tool result displayed inline in the assistant message
- Server-side tool execution (API key stays on server)
