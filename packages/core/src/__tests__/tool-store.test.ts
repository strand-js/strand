import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ToolCallStore } from '../tool-store'

describe('ToolCallStore', () => {
  let store: ToolCallStore

  beforeEach(() => {
    store = new ToolCallStore()
  })

  describe('initial state', () => {
    it('returns idle state for unknown tool', () => {
      const state = store.getState('get_weather')
      expect(state).toMatchObject({ id: null, toolName: null, status: 'idle', input: null, output: null, error: null })
    })
  })

  describe('onToolStart()', () => {
    it('transitions tool to pending', () => {
      store.onToolStart('tc-1', 'get_weather')
      expect(store.getState('get_weather')).toMatchObject({
        id: 'tc-1',
        toolName: 'get_weather',
        status: 'pending',
      })
    })

    it('tracks multiple tools independently', () => {
      store.onToolStart('tc-1', 'get_weather')
      store.onToolStart('tc-2', 'search_web')
      expect(store.getState('get_weather').status).toBe('pending')
      expect(store.getState('search_web').status).toBe('pending')
    })

    it('second call for same tool name overwrites first', () => {
      store.onToolStart('tc-1', 'get_weather')
      store.onToolStart('tc-2', 'get_weather')
      expect(store.getState('get_weather').id).toBe('tc-2')
    })
  })

  describe('onToolInputDone()', () => {
    it('transitions to running with resolved input', () => {
      store.onToolStart('tc-1', 'get_weather')
      store.onToolInputDone('tc-1', { location: 'NYC' })
      expect(store.getState('get_weather')).toMatchObject({
        status: 'running',
        input: { location: 'NYC' },
      })
    })

    it('ignores stale toolCallId (superseded by a newer call)', () => {
      store.onToolStart('tc-1', 'get_weather')
      store.onToolStart('tc-2', 'get_weather') // tc-2 is now active
      store.onToolInputDone('tc-1', { location: 'NYC' }) // stale
      expect(store.getState('get_weather').id).toBe('tc-2')
      expect(store.getState('get_weather').status).toBe('pending') // unchanged
    })

    it('ignores unknown toolCallId', () => {
      store.onToolInputDone('unknown-id', { foo: 'bar' })
      // no throw, no state change
    })
  })

  describe('onToolResult()', () => {
    it('transitions to done with output', () => {
      store.onToolStart('tc-1', 'get_weather')
      store.onToolInputDone('tc-1', { location: 'NYC' })
      store.onToolResult('tc-1', { temp: 72, unit: 'F' })
      expect(store.getState('get_weather')).toMatchObject({
        status: 'done',
        output: { temp: 72, unit: 'F' },
      })
    })

    it('ignores stale toolCallId', () => {
      store.onToolStart('tc-1', 'get_weather')
      store.onToolStart('tc-2', 'get_weather')
      store.onToolResult('tc-1', { temp: 72 }) // stale
      expect(store.getState('get_weather').status).toBe('pending')
    })
  })

  describe('onToolError()', () => {
    it('transitions to failed with error', () => {
      const err = new Error('service unavailable')
      store.onToolStart('tc-1', 'get_weather')
      store.onToolError('tc-1', err)
      expect(store.getState('get_weather')).toMatchObject({
        status: 'failed',
        error: err,
      })
    })
  })

  describe('resetAll()', () => {
    it('resets all tools to idle', () => {
      store.onToolStart('tc-1', 'get_weather')
      store.onToolStart('tc-2', 'search_web')
      store.resetAll()
      expect(store.getState('get_weather').status).toBe('idle')
      expect(store.getState('search_web').status).toBe('idle')
    })
  })

  describe('subscribe()', () => {
    it('notifies listener when tool state changes', () => {
      const listener = vi.fn()
      store.subscribe('get_weather', listener)
      store.onToolStart('tc-1', 'get_weather')
      expect(listener).toHaveBeenCalledOnce()
    })

    it('only notifies listeners for the subscribed tool', () => {
      const weatherListener = vi.fn()
      store.subscribe('get_weather', weatherListener)
      store.onToolStart('tc-1', 'search_web') // different tool
      expect(weatherListener).not.toHaveBeenCalled()
    })

    it('unsubscribes correctly', () => {
      const listener = vi.fn()
      const unsub = store.subscribe('get_weather', listener)
      unsub()
      store.onToolStart('tc-1', 'get_weather')
      expect(listener).not.toHaveBeenCalled()
    })

    it('calls listener with latest state', () => {
      const listener = vi.fn()
      store.subscribe('get_weather', listener)
      store.onToolStart('tc-1', 'get_weather')
      expect(listener).toHaveBeenCalledWith(store.getState('get_weather'))
    })
  })
})
