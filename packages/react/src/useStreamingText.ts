export interface StreamingTextResult {
  text: string
  delta: string
  isDone: boolean
  isStreaming: boolean
}

export function useStreamingText(_stream: ReadableStream<string> | null): StreamingTextResult {
  // Implementation in Task #7
  throw new Error('[strand] useStreamingText: not yet implemented')
}
