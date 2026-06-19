// Side-effect import — patches React Native's fetch to support streaming.
// Must be the first import in App.tsx before any Strand hooks are used.

let patched = false

export function applyStreamingFetchPatch(): void {
  if (patched || typeof globalThis === 'undefined') return

  // React Native's fetch does not natively support ReadableStream bodies.
  // Implementation in Task #8: patches globalThis.fetch to use a streaming
  // polyfill (e.g., react-native-fetch-api) when the response body is consumed
  // as a ReadableStream, enabling SSE-based streaming from Strand handlers.

  patched = true
}

// Auto-apply on import so users just need: import '@strand/react-native'
applyStreamingFetchPatch()
