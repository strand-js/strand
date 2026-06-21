---
title: useStreamingText
description: Low-level primitive for rendering a ReadableStream<string> as reactive text state.
---

# useStreamingText

Low-level primitive for building custom streaming UIs. If you're using `useConversation`, you don't need this — the text is already in `messages`.

## When to use it

Use `useStreamingText` when you're building a custom hook on top of `@strand-js/core` and you have access to a raw `ReadableStream<string>`.

## Signature

```ts
const {
  text,        // string — accumulated text so far
  delta,       // string — most recent token chunk
  isDone,      // boolean — stream has closed
  isStreaming, // boolean — chunks are arriving
} = useStreamingText(stream)
```

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `stream` | `ReadableStream<string> \| null` | The stream to consume. Pass `null` for no-op. |

## Example

```tsx
function CustomStreamingDisplay({ stream }: { stream: ReadableStream<string> | null }) {
  const { text, isDone, isStreaming } = useStreamingText(stream)

  return (
    <div>
      <p>{text}</p>
      {isStreaming && <span className="cursor">▊</span>}
      {isDone && <span>Done</span>}
    </div>
  )
}
```
