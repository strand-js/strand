---
title: useToolCall
description: Subscribe to the real-time state of a specific tool call from anywhere in your component tree.
---

# useToolCall

Subscribe to the real-time state of a specific tool call. Scoped to the nearest `StrandProvider` in the tree.

## Signature

```ts
const {
  status,     // 'idle' | 'pending' | 'running' | 'done' | 'failed'
  input,      // TInput | null — resolved when streaming input completes
  output,     // TOutput | null — result when done
  error,      // Error | null
  isRunning,  // boolean — shorthand for status === 'running'
} = useToolCall<TInput, TOutput>(toolName, options?)
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `toolName` | `string` | The name of the tool to subscribe to |
| `options.client` | `StrandClient` | Override the provider client |

## Tool call lifecycle

```
idle  →  pending  →  running  →  done
                              ↘  failed
```

- `pending` — tool call detected in the stream, input is being streamed
- `running` — input fully received, executing
- `done` — result available in `output`
- `failed` — execution error available in `error`

After `strand:done` fires (the full LLM response completes), all tool states reset to `idle`.

## Example

Show live tool progress anywhere in your tree — not just inside the component that called `send()`:

```tsx
function WeatherStatus() {
  const { status, input, output } = useToolCall<
    { location: string },
    { temp: number; unit: string }
  >('get_weather')

  if (status === 'idle') return null
  if (status === 'pending') return <span>Locating {input?.location}…</span>
  if (status === 'running') return <span>Checking weather in {input?.location}…</span>
  if (status === 'done') return <span>{output?.temp}°{output?.unit} in {input?.location}</span>
  if (status === 'failed') return <span>Weather lookup failed</span>
}
```

## Parallel tool calls

When the model fires multiple tool calls simultaneously, each tool name is tracked independently. `useToolCall('tool_a')` and `useToolCall('tool_b')` update separately and don't interfere.

If the model fires the same tool twice simultaneously, the most recent invocation takes precedence.
