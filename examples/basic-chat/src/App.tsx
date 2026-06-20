import { useRef, type KeyboardEvent } from 'react'
import { useConversation } from '@strand/react'

export function App() {
  const { messages, send, isPending, isStreaming, isDone, cancel, clear, tokenUsage } =
    useConversation({ system: 'You are a helpful assistant. Be concise.' })

  const inputRef = useRef<HTMLInputElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && inputRef.current?.value.trim()) {
      send(inputRef.current.value.trim())
      inputRef.current.value = ''
    }
  }

  const isActive = isPending || isStreaming

  return (
    <div style={{ width: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.08)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>strand / basic-chat</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tokenUsage.total > 0 && (
            <span style={{ fontSize: 12, color: '#999' }}>
              {tokenUsage.total.toLocaleString()} tokens
            </span>
          )}
          <button onClick={clear} style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 40 }}>
            Send a message to start chatting.
          </div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: msg.role === 'user' ? '#0070f3' : '#f4f4f5',
              color: msg.role === 'user' ? '#fff' : '#111',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.content}
          </div>
        ))}
        {isPending && (
          <div style={{ alignSelf: 'flex-start', color: '#999', fontSize: 13, padding: '4px 0' }}>
            Thinking…
          </div>
        )}
        {isDone && (
          <div style={{ alignSelf: 'center', color: '#bbb', fontSize: 11 }}>✓</div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          disabled={isActive}
          placeholder={isActive ? 'Streaming…' : 'Message (Enter to send)'}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none', background: isActive ? '#fafafa' : '#fff' }}
        />
        {isActive ? (
          <button onClick={cancel} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            Stop
          </button>
        ) : (
          <button
            onClick={() => {
              const val = inputRef.current?.value.trim()
              if (val) { send(val); inputRef.current!.value = '' }
            }}
            style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#0070f3', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
