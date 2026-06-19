import { describe, it, expect, beforeEach } from 'vitest'
import { processWireEvent } from '../wire-processor'
import { SessionStateMachine } from '../session'
import { ToolCallStore } from '../tool-store'

describe('processWireEvent', () => {
  let session: SessionStateMachine
  let toolStore: ToolCallStore

  beforeEach(() => {
    session = new SessionStateMachine('test-id')
    toolStore = new ToolCallStore()
  })

  describe('strand:start', () => {
    it('transitions session to submitting', () => {
      processWireEvent({ type: 'strand:start', sessionId: 'sid', requestId: 'rid' }, session, toolStore)
      expect(session.session.status).toBe('submitting')
    })
  })

  describe('strand:text-delta', () => {
    it('transitions to streaming and appends delta', () => {
      processWireEvent({ type: 'strand:text-delta', delta: 'Hello' }, session, toolStore)
      expect(session.session.status).toBe('streaming')
      expect(session.session.messages.at(-1)?.content).toBe('Hello')
    })

    it('stays streaming on subsequent deltas', () => {
      processWireEvent({ type: 'strand:text-delta', delta: 'Hello' }, session, toolStore)
      processWireEvent({ type: 'strand:text-delta', delta: ' world' }, session, toolStore)
      expect(session.session.status).toBe('streaming')
      expect(session.session.messages.at(-1)?.content).toBe('Hello world')
    })
  })

  describe('strand:tool-start', () => {
    it('begins a tool call on the session', () => {
      processWireEvent({ type: 'strand:tool-start', toolCallId: 'tc-1', toolName: 'get_weather' }, session, toolStore)
      const last = session.session.messages.at(-1)
      expect(last?.toolCalls?.at(-1)).toMatchObject({ id: 'tc-1', name: 'get_weather', status: 'pending' })
    })

    it('marks the tool as pending in the tool store', () => {
      processWireEvent({ type: 'strand:tool-start', toolCallId: 'tc-1', toolName: 'get_weather' }, session, toolStore)
      expect(toolStore.getState('get_weather').status).toBe('pending')
    })

    it('handles parallel tool calls for different tools', () => {
      processWireEvent({ type: 'strand:tool-start', toolCallId: 'tc-1', toolName: 'get_weather' }, session, toolStore)
      processWireEvent({ type: 'strand:tool-start', toolCallId: 'tc-2', toolName: 'search_web' }, session, toolStore)
      expect(toolStore.getState('get_weather').status).toBe('pending')
      expect(toolStore.getState('search_web').status).toBe('pending')
    })
  })

  describe('strand:tool-input-done', () => {
    it('marks tool as running with input', () => {
      processWireEvent({ type: 'strand:tool-start', toolCallId: 'tc-1', toolName: 'get_weather' }, session, toolStore)
      processWireEvent({ type: 'strand:tool-input-done', toolCallId: 'tc-1', input: { location: 'NYC' } }, session, toolStore)
      expect(toolStore.getState('get_weather')).toMatchObject({ status: 'running', input: { location: 'NYC' } })
      const tc = session.session.messages.at(-1)?.toolCalls?.find(t => t.id === 'tc-1')
      expect(tc?.status).toBe('running')
    })
  })

  describe('strand:tool-result', () => {
    it('marks tool as done with output', () => {
      processWireEvent({ type: 'strand:tool-start', toolCallId: 'tc-1', toolName: 'get_weather' }, session, toolStore)
      processWireEvent({ type: 'strand:tool-input-done', toolCallId: 'tc-1', input: {} }, session, toolStore)
      processWireEvent({ type: 'strand:tool-result', toolCallId: 'tc-1', result: { temp: 72 } }, session, toolStore)
      expect(toolStore.getState('get_weather')).toMatchObject({ status: 'done', output: { temp: 72 } })
      const tc = session.session.messages.at(-1)?.toolCalls?.find(t => t.id === 'tc-1')
      expect(tc?.status).toBe('done')
    })
  })

  describe('strand:tool-error', () => {
    it('marks tool as failed with error', () => {
      processWireEvent({ type: 'strand:tool-start', toolCallId: 'tc-1', toolName: 'get_weather' }, session, toolStore)
      processWireEvent({ type: 'strand:tool-error', toolCallId: 'tc-1', error: 'service unavailable' }, session, toolStore)
      expect(toolStore.getState('get_weather').status).toBe('failed')
      expect(toolStore.getState('get_weather').error?.message).toBe('service unavailable')
    })
  })

  describe('strand:done', () => {
    it('updates token usage and transitions to done', () => {
      processWireEvent({ type: 'strand:done', usage: { input: 100, output: 50, total: 150 } }, session, toolStore)
      expect(session.session.tokenUsage).toEqual({ input: 100, output: 50, total: 150 })
      expect(session.session.status).toBe('done')
    })

    it('resets all tool states', () => {
      processWireEvent({ type: 'strand:tool-start', toolCallId: 'tc-1', toolName: 'get_weather' }, session, toolStore)
      processWireEvent({ type: 'strand:done', usage: { input: 1, output: 1, total: 2 } }, session, toolStore)
      expect(toolStore.getState('get_weather').status).toBe('idle')
    })
  })

  describe('strand:error', () => {
    it('transitions session to error', () => {
      processWireEvent({ type: 'strand:error', code: 'rate_limit', message: 'Too many requests' }, session, toolStore)
      expect(session.session.status).toBe('error')
      expect(session.session.error?.message).toBe('Too many requests')
    })
  })
})
