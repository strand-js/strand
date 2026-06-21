---
title: React Native
description: Using Strand in React Native and Expo with streaming fetch support.
---

# React Native

React Native's built-in `fetch` does not support streaming response bodies. `@strandjs/react-native` patches this transparently so all Strand hooks work identically.

## Install

```bash
npm install @strandjs/react-native
```

## Setup

Import as the first line of `App.tsx`:

```ts
// App.tsx — must be first
import '@strandjs/react-native'

// Everything else...
import { StrandProvider } from '@strandjs/react'
```

That's it. All hooks work as normal.

## How it works

The patch detects the React Native environment (`navigator.product === 'ReactNative'`) and replaces `globalThis.fetch` with an XHR-based implementation that:

1. Uses `XMLHttpRequest` instead of native fetch
2. Captures response chunks via `xhr.onprogress`
3. Feeds them into a `ReadableStream<Uint8Array>` controller
4. Returns a standard `Response` object with a streaming body

The patch is idempotent — calling it multiple times has no effect.

## Compatibility

| Platform | Status |
|---|---|
| React Native 0.73+ | ✅ |
| Expo SDK 50+ | ✅ |
| Expo Web | ✅ (patch is no-op, native fetch used) |
| Node.js | ✅ (patch is no-op, native fetch used) |
| Browsers | ✅ (patch is no-op, native fetch used) |
