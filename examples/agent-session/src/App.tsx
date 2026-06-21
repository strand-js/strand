import { useState, useRef } from 'react'
import { useAgentSession } from '@strandjs/react'
import type { AgentStep } from '@strandjs/react'

const EXAMPLE_GOALS = [
  'What is the world population and what percentage lives in Asia?',
  'Research the global GDP and calculate what 5% of it would be.',
  'What is the current state of climate change?',
]

function StepCard({ step, isCurrent }: { step: AgentStep; isCurrent: boolean }) {
  const toolEmoji: Record<string, string> = { search: '🔍', calculator: '🧮' }
  const emoji = toolEmoji[step.toolName] ?? '🔧'

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 8,
      border: `1px solid ${isCurrent ? '#93c5fd' : step.status === 'done' ? '#bbf7d0' : '#e5e7eb'}`,
      background: isCurrent ? '#eff6ff' : step.status === 'done' ? '#f0fdf4' : '#fafafa',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span>{emoji}</span>
        <span style={{ fontWeight: 600, color: '#374151' }}>{step.toolName}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: isCurrent ? '#3b82f6' : step.status === 'done' ? '#16a34a' : '#6b7280' }}>
          {isCurrent ? '⏳ running' : step.status === 'done' ? '✓ done' : '…'}
        </span>
      </div>
      {step.input && (
        <div style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 12, background: '#f3f4f6', padding: '4px 8px', borderRadius: 4 }}>
          {JSON.stringify(step.input)}
        </div>
      )}
      {step.output && step.status === 'done' && (
        <div style={{ marginTop: 6, color: '#374151', fontSize: 12 }}>
          {typeof step.output === 'object' ? JSON.stringify(step.output) : String(step.output)}
        </div>
      )}
    </div>
  )
}

export function App() {
  const { status, steps, currentStep, result, error, run, cancel } = useAgentSession()
  const [goal, setGoal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isRunning = status === 'running'

  function handleRun() {
    const g = goal.trim() || inputRef.current?.value.trim()
    if (g) { run(g); setGoal('') }
  }

  return (
    <div style={{ width: 660, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>strand / agent-session</span>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            Give the agent a goal — it uses tools autonomously to find the answer.
          </p>
        </div>

        {/* Goal input */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              ref={inputRef}
              value={goal}
              onChange={e => setGoal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isRunning && handleRun()}
              disabled={isRunning}
              placeholder="Enter a research goal…"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }}
            />
            {isRunning
              ? <button onClick={cancel} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Stop</button>
              : <button onClick={handleRun} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Run</button>
            }
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EXAMPLE_GOALS.map(g => (
              <button
                key={g}
                onClick={() => { if (!isRunning) { run(g) } }}
                disabled={isRunning}
                style={{ fontSize: 11, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 20, padding: '4px 10px', cursor: 'pointer' }}
              >
                {g.slice(0, 48)}…
              </button>
            ))}
          </div>
        </div>

        {/* Steps */}
        {steps.length > 0 && (
          <div style={{ padding: '16px 20px', borderBottom: result ? '1px solid #f3f4f6' : 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, marginBottom: 10 }}>
              STEPS ({steps.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((step, i) => (
                <StepCard
                  key={i}
                  step={step}
                  isCurrent={currentStep?.index === step.index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 1, marginBottom: 8 }}>RESULT</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: '#111', whiteSpace: 'pre-wrap' }}>{result}</div>
          </div>
        )}

        {/* Running indicator */}
        {isRunning && steps.length === 0 && (
          <div style={{ padding: '20px', color: '#6b7280', fontSize: 13, textAlign: 'center' }}>Agent is thinking…</div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '16px 20px', color: '#dc2626', fontSize: 13 }}>Error: {error.message}</div>
        )}
      </div>
    </div>
  )
}
