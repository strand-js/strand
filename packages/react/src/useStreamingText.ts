import { useState, useEffect, useRef } from 'react'

export interface StreamingTextResult {
  text: string
  delta: string
  isDone: boolean
  isStreaming: boolean
}

export function useStreamingText(stream: ReadableStream<string> | null): StreamingTextResult {
  const [state, setState] = useState<StreamingTextResult>({
    text: '',
    delta: '',
    isDone: false,
    isStreaming: false,
  })

  const streamRef = useRef(stream)

  useEffect(() => {
    streamRef.current = stream
    if (!stream) return

    let cancelled = false

    setState({ text: '', delta: '', isDone: false, isStreaming: true })

    ;(async () => {
      const reader = stream.getReader()
      let accumulated = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (cancelled) break
          if (done) {
            setState(s => ({ ...s, isDone: true, isStreaming: false }))
            break
          }
          accumulated += value
          setState({ text: accumulated, delta: value, isDone: false, isStreaming: true })
        }
      } catch {
        if (!cancelled) setState(s => ({ ...s, isDone: true, isStreaming: false }))
      } finally {
        reader.releaseLock()
      }
    })()

    return () => { cancelled = true }
  }, [stream])

  return state
}
