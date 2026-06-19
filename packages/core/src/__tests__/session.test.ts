import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionStateMachine } from '../session'

describe('SessionStateMachine', () => {
  let machine: SessionStateMachine

  beforeEach(() => {
    machine = new SessionStateMachine('test-id')
  })

  describe('initial state', () => {
    it('starts idle', () => {
      expect(machine.session.status).toBe('idle')
    })

    it('starts with empty messages', () => {
      expect(machine.session.messages).toHaveLength(0)
    })

    it('starts with zero token usage', () => {
      expect(machine.session.tokenUsage).toEqual({ input: 0, output: 0, total: 0 })
    })

    it('uses the provided session id', () => {
      expect(machine.session.id).toBe('test-id')
    })

    it('generates a unique id when none provided', () => {
      const a = new SessionStateMachine()
      const b = new SessionStateMachine()
      expect(a.session.id).not.toBe(b.session.id)
    })
  })

  describe('transition()', () => {
    it('transitions to submitting', () => {
      machine.transition('submitting')
      expect(machine.session.status).toBe('submitting')
    })

    it('transitions to streaming', () => {
      machine.transition('streaming')
      expect(machine.session.status).toBe('streaming')
    })

    it('transitions to error and stores the error', () => {
      const err = new Error('boom')
      machine.transition('error', err)
      expect(machine.session.status).toBe('error')
      expect(machine.session.error).toBe(err)
    })

    it('clears error when transitioning away from error', () => {
      machine.transition('error', new Error('boom'))
      machine.transition('idle')
      expect(machine.session.error).toBeNull()
    })
  })

  describe('addUserMessage()', () => {
    it('appends a user message', () => {
      machine.addUserMessage('Hello')
      expect(machine.session.messages).toHaveLength(1)
      expect(machine.session.messages[0]).toMatchObject({ role: 'user', content: 'Hello' })
    })

    it('assigns a unique id to each message', () => {
      machine.addUserMessage('a')
      machine.addUserMessage('b')
      const ids = machine.session.messages.map(m => m.id)
      expect(new Set(ids).size).toBe(2)
    })
  })

  describe('appendTextDelta()', () => {
    it('creates an assistant message on first delta', () => {
      machine.appendTextDelta('Hi')
      expect(machine.session.messages).toHaveLength(1)
      expect(machine.session.messages[0]).toMatchObject({ role: 'assistant', content: 'Hi' })
    })

    it('accumulates deltas into a single message', () => {
      machine.appendTextDelta('Hello')
      machine.appendTextDelta(' world')
      expect(machine.session.messages).toHaveLength(1)
      expect(machine.session.messages[0].content).toBe('Hello world')
    })

    it('creates a new assistant message if last message is from user', () => {
      machine.addUserMessage('hi')
      machine.appendTextDelta('Hey there')
      expect(machine.session.messages).toHaveLength(2)
      expect(machine.session.messages[1].role).toBe('assistant')
    })
  })

  describe('beginToolCall()', () => {
    it('adds a tool call to the last assistant message', () => {
      machine.appendTextDelta('I will check weather')
      machine.beginToolCall('tc-1', 'get_weather')
      const last = machine.session.messages.at(-1)
      expect(last?.toolCalls).toHaveLength(1)
      expect(last?.toolCalls?.[0]).toMatchObject({
        id: 'tc-1',
        name: 'get_weather',
        status: 'pending',
        input: {},
        output: null,
      })
    })

    it('creates a new assistant message if none exists', () => {
      machine.addUserMessage('what is the weather?')
      machine.beginToolCall('tc-1', 'get_weather')
      expect(machine.session.messages).toHaveLength(2)
      expect(machine.session.messages[1].toolCalls).toHaveLength(1)
    })
  })

  describe('updateToolCall()', () => {
    beforeEach(() => {
      machine.appendTextDelta('')
      machine.beginToolCall('tc-1', 'get_weather')
    })

    it('updates tool call status', () => {
      machine.updateToolCall('tc-1', { status: 'running' })
      const tc = machine.session.messages.at(-1)?.toolCalls?.[0]
      expect(tc?.status).toBe('running')
    })

    it('sets input when resolved', () => {
      machine.updateToolCall('tc-1', { input: { location: 'NYC' }, status: 'running' })
      const tc = machine.session.messages.at(-1)?.toolCalls?.[0]
      expect(tc?.input).toEqual({ location: 'NYC' })
    })

    it('sets output when done', () => {
      machine.updateToolCall('tc-1', { status: 'done', output: { temp: 72 } })
      const tc = machine.session.messages.at(-1)?.toolCalls?.[0]
      expect(tc?.output).toEqual({ temp: 72 })
      expect(tc?.status).toBe('done')
    })

    it('sets error when failed', () => {
      const err = new Error('tool failed')
      machine.updateToolCall('tc-1', { status: 'failed', error: err })
      const tc = machine.session.messages.at(-1)?.toolCalls?.[0]
      expect(tc?.status).toBe('failed')
      expect(tc?.error).toBe(err)
    })
  })

  describe('updateTokenUsage()', () => {
    it('updates token usage', () => {
      machine.updateTokenUsage({ input: 100, output: 50, total: 150 })
      expect(machine.session.tokenUsage).toEqual({ input: 100, output: 50, total: 150 })
    })
  })

  describe('subscribe()', () => {
    it('calls listener on state change', () => {
      const listener = vi.fn()
      machine.subscribe(listener)
      machine.addUserMessage('hello')
      expect(listener).toHaveBeenCalledOnce()
    })

    it('calls listener with the current session', () => {
      const listener = vi.fn()
      machine.subscribe(listener)
      machine.addUserMessage('hello')
      expect(listener).toHaveBeenCalledWith(machine.session)
    })

    it('stops calling listener after unsubscribe', () => {
      const listener = vi.fn()
      const unsub = machine.subscribe(listener)
      unsub()
      machine.addUserMessage('hello')
      expect(listener).not.toHaveBeenCalled()
    })

    it('supports multiple listeners', () => {
      const a = vi.fn()
      const b = vi.fn()
      machine.subscribe(a)
      machine.subscribe(b)
      machine.transition('submitting')
      expect(a).toHaveBeenCalledOnce()
      expect(b).toHaveBeenCalledOnce()
    })
  })

  describe('clear()', () => {
    it('resets messages', () => {
      machine.addUserMessage('hi')
      machine.appendTextDelta('hello')
      machine.clear()
      expect(machine.session.messages).toHaveLength(0)
    })

    it('resets token usage', () => {
      machine.updateTokenUsage({ input: 100, output: 50, total: 150 })
      machine.clear()
      expect(machine.session.tokenUsage).toEqual({ input: 0, output: 0, total: 0 })
    })

    it('resets status to idle', () => {
      machine.transition('streaming')
      machine.clear()
      expect(machine.session.status).toBe('idle')
    })

    it('preserves the session id', () => {
      machine.clear()
      expect(machine.session.id).toBe('test-id')
    })
  })
})
