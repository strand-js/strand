---
title: Introduction
description: What Strand is, why it exists, and who it's for.
---

# Introduction

**Strand is AI state management for React.** It sits between your UI and your LLM provider, turning the raw streaming protocol into idiomatic React hooks.

Think of it as what RTK Query did for REST APIs — applied to LLM interactions.

## The problem Strand solves

Every time you add AI to a React app, you write the same boilerplate:

```ts
const [messages, setMessages] = useState([])
const [isLoading, setIsLoading] = useState(false)

async function send(text) {
  setIsLoading(true)
  const updated = [...messages, { role: 'user', content: text }]
  setMessages(updated)

  const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages: updated }) })
  const reader = res.body.getReader()

  // manually stream tokens
  // manually detect tool_use blocks
  // manually append tool_result messages and loop
  // manually handle errors, rate limits, timeouts
  // setIsLoading(false) — if you remembered
}
```

Strand eliminates this entirely.

## What Strand provides

- **`useConversation`** — full conversation with streaming, tool calls, and history
- **`useToolCall`** — real-time per-tool state observable anywhere in your tree
- **`useAgentSession`** — multi-step autonomous agent flows with step tracking
- **`useStreamingText`** — low-level streaming primitive for custom UIs
- **`@strand-js/anthropic`** — server-side Anthropic handler with agentic loop
- **`@strand-js/openai`** — same for OpenAI
- **`@strand-js/react-native`** — streaming fetch patch for React Native

## How it compares

| | Strand | Vercel AI SDK | Raw SDK |
|---|---|---|---|
| React Native | ✅ Day one | ❌ Broken by default | ❌ |
| Per-tool state (`useToolCall`) | ✅ | ❌ | ❌ |
| Streaming lifecycle (4 states) | ✅ | ⚠️ Known `isLoading` bugs | ❌ |
| Context window management | ✅ Built in | ❌ Explicitly excluded | ❌ |
| Stable context injection | ✅ | ❌ Stale closure footgun | ❌ |
| Retry / backoff | ✅ Built in | ❌ Third party only | ❌ |
| Framework agnostic | ✅ | ⚠️ NextJS-centric | ✅ |

## Who it's for

Strand is for teams who've outgrown the primitives — or who are starting fresh and don't want to rebuild the same boilerplate on every project.
