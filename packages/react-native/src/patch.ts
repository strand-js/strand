// React Native's built-in fetch does not expose response.body as a ReadableStream.
// This module patches globalThis.fetch with an XHR-based implementation that
// delivers response body as a ReadableStream<Uint8Array>, enabling SSE streaming.
//
// Reference: https://github.com/nickvdyck/fetch-readablestream

const encoder = new TextEncoder()

function parseResponseHeaders(headersStr: string): HeadersInit {
  const headers: Record<string, string> = {}
  for (const line of headersStr.trim().split('\r\n')) {
    const idx = line.indexOf(': ')
    if (idx > 0) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 2)
  }
  return headers
}

export function createXHRStreamingFetch(): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url

    const method =
      init?.method ??
      (typeof input !== 'string' && !(input instanceof URL)
        ? (input as Request).method
        : 'GET')

    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(method, url, true)
      xhr.responseType = 'text'

      // Copy request headers
      const reqHeaders = init?.headers ? new Headers(init.headers) : new Headers()
      reqHeaders.forEach((value, key) => xhr.setRequestHeader(key, value))

      let resolved = false
      let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
      let processedLength = 0

      const readableStream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
        },
        cancel() {
          xhr.abort()
        },
      })

      function pushChunk() {
        const text = xhr.responseText
        const newText = text.slice(processedLength)
        processedLength = text.length
        if (newText && streamController) {
          streamController.enqueue(encoder.encode(newText))
        }
      }

      function resolveResponse() {
        if (!resolved) {
          resolved = true
          resolve(
            new Response(readableStream, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: parseResponseHeaders(xhr.getAllResponseHeaders()),
            }),
          )
        }
      }

      xhr.onprogress = () => {
        pushChunk()
        resolveResponse()
      }

      xhr.onload = () => {
        pushChunk()
        streamController?.close()
        resolveResponse()
      }

      xhr.onerror = () => {
        const err = new TypeError('Network request failed')
        streamController?.error(err)
        if (!resolved) reject(err)
      }

      xhr.onabort = () => {
        const err = new DOMException('Request aborted', 'AbortError')
        streamController?.error(err)
        if (!resolved) reject(err)
      }

      if (init?.signal) {
        init.signal.addEventListener('abort', () => xhr.abort())
      }

      xhr.send((init?.body as XMLHttpRequestBodyInit | null | undefined) ?? null)
    })
  }
}

let patched = false

export function applyStreamingFetchPatch(): void {
  if (patched) return
  patched = true

  // Only patch in environments where ReadableStream streaming from fetch is broken.
  // React Native is identified by the 'ReactNative' product string on the navigator.
  // In other environments (Node, browsers), the native fetch already supports streaming.
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { product?: string }) : null
  const isReactNative = nav?.product === 'ReactNative'

  if (isReactNative) {
    globalThis.fetch = createXHRStreamingFetch()
  }
}
