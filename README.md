# strand

**AI state management for React.** The layer between your UI and your LLM.

```
npm install @strand/core @strand/react @strand/anthropic
```

---

## The problem

Every time you add AI to a React app, you write the same 200 lines:

```ts
// You write this. Every time. In every project.
const [messages, setMessages] = useState([])
const [isLoading, setIsLoading] = useState(false)

async function send(text) {
  setIsLoading(true)
  setMessages(prev => [...prev, { role: 'user', content: text }])

  const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages }) })
  const reader = res.body.getReader()

  // manually stream tokens
  // manually detect tool_use blocks
  // manually append tool_result messages
  // manually loop until stop_reason === 'end_turn'
  // manually handle errors, rate limits, timeouts
  // setIsLoading(false) — if you remembered
}
```

Strand eliminates this. It is to LLM interactions what RTK Query is to REST APIs.

---

## How it works

Strand splits cleanly across your stack:

```
Browser                    Your Server               LLM Provider
─────────────────────      ──────────────────────    ─────────────
@strand/react              @strand/anthropic         Anthropic API
useConversation()    ───►  createStrandHandler() ───► claude-*
useToolCall()              (tool execution here)
useAgentSession()    ◄───  SSE stream ◄───────────── streaming tokens
```

Your API key never leaves your server. Your React hooks never touch raw HTTP.

---

## Quick start

### 1. Set up the server endpoint

```ts
// server.ts (Express / Fastify / Hono / any Node.js framework)
import { createStrandHandler } from '@strand/anthropic'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
}))
```

Next.js App Router:
```ts
// app/api/strand/route.ts
import { createStrandRoute } from '@strand/anthropic'

export const POST = createStrandRoute({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
})
```

### 2. Configure the client

```tsx
// main.tsx
import { createStrandClient } from '@strand/core'
import { StrandProvider } from '@strand/react'

const client = createStrandClient({ baseUrl: '/api/strand' })

function App() {
  return (
    <StrandProvider client={client}>
      <YourApp />
    </StrandProvider>
  )
}
```

### 3. Use the hooks

```tsx
import { useConversation } from '@strand/react'

function Chat() {
  const { messages, send, status, isPending, isStreaming, cancel } = useConversation({
    system: 'You are a helpful assistant.',
  })

  return (
    <div>
      {messages.map(m => (
        <div key={m.id} data-role={m.role}>
          {m.content}
        </div>
      ))}

      {isStreaming && <div>Thinking...</div>}

      <input
        disabled={isPending || isStreaming}
        onKeyDown={e => {
          if (e.key === 'Enter') send(e.currentTarget.value)
        }}
      />

      {(isPending || isStreaming) && (
        <button onClick={cancel}>Stop</button>
      )}
    </div>
  )
}
```

---

## Core concepts

### Streaming lifecycle

Strand tracks four distinct states. Other libraries collapse these into a single `isLoading` boolean — which is why they get stuck.

```
idle  →  submitting  →  streaming  →  done
                                  ↘  error
```

| State | Meaning | Hook properties |
|---|---|---|
| `idle` | No active request | `isIdle: true` |
| `submitting` | Request sent, waiting for first token | `isPending: true` |
| `streaming` | Tokens arriving | `isStreaming: true` |
| `done` | Response complete | `isIdle: true` |
| `error` | Something failed | `error: Error` |

### Sessions

A session is more than a messages array. It has identity, token budget tracking, and a lifecycle.

```ts
interface Session {
  id: string
  messages: Message[]
  status: 'idle' | 'submitting' | 'streaming' | 'done' | 'error'
  tokenUsage: { input: number; output: number; total: number }
  error: Error | null
}
```

Sessions are isolated by default. Pass a `sessionId` to share state across components or persist across mounts.

### Tool call state

Every tool call has an observable lifecycle — not just a flat array at the end.

```
pending  →  running  →  done
                     ↘  failed
```

Use `useToolCall` to subscribe to a specific tool's state anywhere in your component tree.

---

## API reference

### `createStrandClient(config)`

Creates the client instance. Pass it to `<StrandProvider>` or directly to any hook.

```ts
const client = createStrandClient({
  baseUrl: '/api/strand',       // required — your backend endpoint
  retry: {
    maxAttempts: 3,             // default: 3
    backoff: 'exponential',     // 'exponential' | 'linear' | 'none'
    retryOn: ['rate_limit', 'server_error'],
  },
  contextWindow: {
    strategy: 'truncate-oldest', // 'truncate-oldest' | 'sliding-window' | 'none'
    maxTokens: 100_000,
  },
})
```

---

### `<StrandProvider client={client}>`

Provides the client to all hooks in the tree. If you only have one client, wrap your app once and omit the `client` prop from every hook.

```tsx
<StrandProvider client={client}>
  <App />
</StrandProvider>
```

---

### `useConversation(options)`

The main hook. Manages a full conversation with streaming, tool calls, and history.

```ts
const {
  messages,       // Message[] — full conversation history
  send,           // (content: string, options?: SendOptions) => void
  status,         // 'idle' | 'submitting' | 'streaming' | 'done' | 'error'
  isPending,      // true when request is in-flight, no tokens yet
  isStreaming,    // true when tokens are arriving
  isIdle,         // true when no active request
  error,          // Error | null
  cancel,         // () => void — abort the active request
  clear,          // () => void — reset conversation history
  tokenUsage,     // { input: number, output: number, total: number }
} = useConversation({
  system,         // string — system prompt
  tools,          // ToolDefinition[] — tool schemas (Zod)
  onToolCall,     // async (name, args) => result — client-side tool execution
  context,        // Record<string, unknown> — stable per-request context, no stale closures
  sessionId,      // string — share state across components or persist across mounts
  onFinish,       // (message: Message) => void
  onError,        // (error: Error) => void
  client,         // StrandClient — omit if using StrandProvider
})
```

**Tool definitions** use Zod schemas for type-safe input:

```ts
import { z } from 'zod'
import { tool } from '@strand/core'

const weatherTool = tool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name or coordinates'),
    unit: z.enum(['celsius', 'fahrenheit']).default('fahrenheit'),
  }),
})

const { messages, send } = useConversation({
  tools: [weatherTool],
  onToolCall: async (name, args) => {
    if (name === 'get_weather') {
      return fetchWeather(args.location, args.unit)
    }
  },
})
```

**Stable context** — attach dynamic values to every request without stale closure bugs:

```ts
// These update correctly on every request, even as state changes
const { send } = useConversation({
  context: {
    userId: user.id,
    locale: settings.locale,
    featureFlags: flags,
  },
})
```

---

### `useToolCall(toolName, options?)`

Subscribe to the real-time state of a specific tool call. Renders tool-in-progress UI anywhere in your tree.

```ts
const {
  status,     // 'idle' | 'pending' | 'running' | 'done' | 'failed'
  input,      // T | null — resolved input when available
  output,     // R | null — result when done
  error,      // Error | null
  isRunning,  // boolean
} = useToolCall<WeatherInput, WeatherResult>('get_weather')
```

Example — show a spinner while a specific tool runs:

```tsx
function WeatherToolStatus() {
  const { status, input, output } = useToolCall('get_weather')

  if (status === 'running') return <Spinner label={`Checking weather in ${input?.location}...`} />
  if (status === 'done') return <WeatherCard data={output} />
  return null
}
```

---

### `useAgentSession(options)`

Multi-step agentic flows with observable step-by-step state.

```ts
const {
  status,       // 'idle' | 'running' | 'paused' | 'done' | 'failed'
  steps,        // AgentStep[] — full step history
  currentStep,  // AgentStep | null — active step
  stepCount,    // number
  run,          // (goal: string) => void
  pause,        // () => void
  resume,       // () => void
  cancel,       // () => void
  result,       // string | null — final output when done
  error,        // Error | null
} = useAgentSession({
  maxSteps: 10,
  tools: [...],
  onToolCall: async (name, args) => myTools[name](args),
  onStep: (step) => console.log('Step:', step),
  onComplete: (result) => console.log('Done:', result),
  client,       // omit if using StrandProvider
})
```

---

### `useStreamingText(stream)`

Low-level primitive for building custom streaming UIs.

```ts
const {
  text,        // string — accumulated text so far
  delta,       // string — most recent token chunk
  isDone,      // boolean
  isStreaming, // boolean
} = useStreamingText(readableStream)
```

---

## Server-side setup

### Tool execution on the server

For tools that need database access, secrets, or server-only APIs — define them in the handler, not the hook:

```ts
import { createStrandHandler } from '@strand/anthropic'
import { z } from 'zod'
import { tool } from '@strand/core'

const searchDatabaseTool = tool({
  name: 'search_database',
  description: 'Search internal records',
  parameters: z.object({ query: z.string() }),
})

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-6',
  tools: [searchDatabaseTool],
  onToolCall: async (name, args, { session, request }) => {
    if (name === 'search_database') {
      return db.search(args.query)
    }
  },
}))
```

### `createStrandHandler(config)` options

```ts
{
  apiKey: string
  model: string
  tools?: ToolDefinition[]
  onToolCall?: async (name, args, ctx) => result
  system?: string | ((request: Request) => string)
  maxSteps?: number           // default: 10 — max tool call rounds per request
  onRequest?: (req) => void   // inspect/log incoming requests
  onFinish?: (session) => void
}
```

---

## React Native

Strand works in React Native out of the box with the `@strand/react-native` transport adapter. React Native's `fetch` doesn't support streaming — this package patches it transparently.

```ts
npm install @strand/react-native
```

```ts
// App.tsx — import before anything else
import '@strand/react-native'

// That's it. All hooks work as normal.
```

Works with Expo and bare React Native.

---

## OpenAI

```ts
npm install @strand/openai
```

```ts
import { createStrandHandler } from '@strand/openai'

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
}))
```

The client and all React hooks are identical regardless of provider.

---

## Why Strand?

| | Strand | Vercel AI SDK | LangChain.js |
|---|---|---|---|
| React Native | ✅ Day one | ❌ Broken by default | ❌ |
| Per-tool state (`useToolCall`) | ✅ | ❌ | ❌ |
| Streaming lifecycle (4 states) | ✅ | ⚠️ `isLoading` bugs | ✅ |
| Context window management | ✅ Built in | ❌ Explicitly excluded | ✅ |
| Stable context injection | ✅ No stale closures | ❌ Known footgun | ✅ |
| Retry / backoff | ✅ Built in | ❌ Third party only | ✅ |
| Framework agnostic | ✅ | ⚠️ NextJS-centric | ✅ |
| Bundle size | Small | Medium | Large |
| Stable versioning | ✅ Committed | ❌ Major churn | ⚠️ |
| Parallel tool calls | ✅ | ⚠️ Open bug | ⚠️ |

Strand is not a Vercel AI SDK replacement for every use case. If you're deep in the Next.js App Router ecosystem and don't need tool call state, stick with what you have. Strand is for teams who've outgrown the primitives.

---

## Roadmap

### v1 (current)
- `@strand/core`, `@strand/react`, `@strand/anthropic`, `@strand/openai`, `@strand/react-native`
- `useConversation`, `useToolCall`, `useAgentSession`, `useStreamingText`
- Context window management, retry, parallel tool calls

### v2
- Conversation branching (fork from any message)
- Durable sessions (survive disconnects, reconnect from checkpoint)
- Parallel sub-agent orchestration

---

## Contributing

Strand is early. If you hit a bug or have a use case the API doesn't serve, [open an issue](https://github.com/strand-js/strand/issues). Real-world feedback shapes v1 more than anything else.

---

## License

MIT
