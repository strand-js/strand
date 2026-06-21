import { useRef, type KeyboardEvent } from 'react'
import { useConversation, useToolCall } from '@strand-js/react'

// WeatherStatus lives separately from Chat — demonstrates that useToolCall
// can subscribe to tool state anywhere in the component tree.
function WeatherStatus() {
  const { status, input, output, isRunning } = useToolCall<
    { location: string; unit: string },
    { location: string; temperature: number; unit: string; condition: string; humidity: string }
  >('get_weather')

  if (status === 'idle') return null

  return (
    <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13 }}>
      {isRunning && (
        <span style={{ color: '#92400e' }}>
          🌤 Checking weather{input?.location ? ` in ${input.location}` : ''}…
        </span>
      )}
      {status === 'done' && output && (
        <span style={{ color: '#065f46' }}>
          🌤 {output.location}: {output.temperature}°{output.unit === 'celsius' ? 'C' : 'F'}, {output.condition}, {output.humidity} humidity
        </span>
      )}
      {status === 'failed' && (
        <span style={{ color: '#991b1b' }}>Weather lookup failed</span>
      )}
    </div>
  )
}

export function App() {
  const { messages, send, isPending, isStreaming, cancel, clear } = useConversation()
  const inputRef = useRef<HTMLInputElement>(null)
  const isActive = isPending || isStreaming

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && inputRef.current?.value.trim()) {
      send(inputRef.current.value.trim())
      inputRef.current.value = ''
    }
  }

  return (
    <div style={{ width: 640, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>strand / tool-calling</span>
          <button onClick={clear} style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Clear</button>
        </div>

        {/* Tool status — rendered outside the chat list, shows cross-component state sharing */}
        <div style={{ padding: '0 16px' }}>
          <WeatherStatus />
        </div>

        {/* Messages */}
        <div style={{ padding: 20, minHeight: 300, maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 60 }}>
              Try: "What's the weather in Tokyo?"
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: msg.role === 'user' ? '#0070f3' : '#f4f4f5',
              color: msg.role === 'user' ? '#fff' : '#111',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          ))}
          {isPending && <div style={{ alignSelf: 'flex-start', color: '#999', fontSize: 13 }}>Thinking…</div>}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            onKeyDown={handleKeyDown}
            disabled={isActive}
            placeholder="Ask about the weather anywhere…"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }}
          />
          {isActive
            ? <button onClick={cancel} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Stop</button>
            : <button onClick={() => { const v = inputRef.current?.value.trim(); if (v) { send(v); inputRef.current!.value = '' } }} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#0070f3', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Send</button>
          }
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
        WeatherStatus component is a sibling of Chat — not nested inside it. useToolCall shares state via StrandProvider context.
      </p>
    </div>
  )
}
