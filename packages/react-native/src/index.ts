// Side-effect import — patches React Native's fetch to support ReadableStream streaming.
// Must be the first import in App.tsx before any Strand hooks are used.
//
// Usage: import '@strandjs/react-native'

export { applyStreamingFetchPatch, createXHRStreamingFetch } from './patch'

import { applyStreamingFetchPatch } from './patch'
applyStreamingFetchPatch()
