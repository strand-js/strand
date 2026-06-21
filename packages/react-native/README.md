# @strand-js/react-native

React Native transport adapter for [Strand](https://github.com/strand-js/strand).

React Native's built-in `fetch` does not support streaming response bodies. This package patches it transparently so all Strand hooks work identically to web.

## Install

```bash
npm install @strand-js/react-native
```

## Usage

```ts
// App.tsx — must be the first import
import '@strand-js/react-native'

// Everything else works as normal
import { StrandProvider } from '@strand-js/react'
```

That's it. All hooks (`useConversation`, `useToolCall`, `useAgentSession`) work identically after this import.

## Compatibility

| Platform | Status |
|---|---|
| React Native 0.73+ | ✅ |
| Expo SDK 50+ | ✅ |
| Expo Web | ✅ (no-op) |
| Node.js | ✅ (no-op) |
| Browsers | ✅ (no-op) |

[Full documentation →](https://github.com/strand-js/strand)
