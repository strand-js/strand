import type { Session, Message, ToolCall, TokenUsage, StreamingStatus } from './types'

export class SessionStateMachine {
  private _session: Session
  private _listeners = new Set<(session: Session) => void>()
  private _resetTimer: ReturnType<typeof setTimeout> | null = null

  constructor(sessionId?: string) {
    this._session = makeInitialSession(sessionId ?? generateId())
  }

  get session(): Readonly<Session> {
    return this._session
  }

  subscribe(listener: (session: Session) => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  private emit(): void {
    this._listeners.forEach(l => l(this._session))
  }

  transition(status: StreamingStatus, error?: Error): void {
    if (this._resetTimer !== null) {
      clearTimeout(this._resetTimer)
      this._resetTimer = null
    }

    this._session = { ...this._session, status, error: error ?? null }
    this.emit()

    if (status === 'done' || status === 'error') {
      this._resetTimer = setTimeout(() => {
        this._session = { ...this._session, status: 'idle' }
        this._resetTimer = null
        this.emit()
      }, 0)
    }
  }

  addUserMessage(content: string): void {
    const msg: Message = {
      id: generateId(),
      role: 'user',
      content,
      createdAt: new Date(),
    }
    this._session = { ...this._session, messages: [...this._session.messages, msg] }
    this.emit()
  }

  appendTextDelta(delta: string): void {
    const messages = [...this._session.messages]
    const last = messages.at(-1)

    if (last?.role === 'assistant') {
      messages[messages.length - 1] = { ...last, content: last.content + delta }
    } else {
      messages.push({
        id: generateId(),
        role: 'assistant',
        content: delta,
        createdAt: new Date(),
      })
    }

    this._session = { ...this._session, messages }
    this.emit()
  }

  beginToolCall(toolCallId: string, toolName: string): void {
    const messages = [...this._session.messages]
    const last = messages.at(-1)

    const toolCall: ToolCall = {
      id: toolCallId,
      name: toolName,
      input: {},
      output: null,
      status: 'pending',
      error: null,
    }

    if (last?.role === 'assistant') {
      messages[messages.length - 1] = {
        ...last,
        toolCalls: [...(last.toolCalls ?? []), toolCall],
      }
    } else {
      messages.push({
        id: generateId(),
        role: 'assistant',
        content: '',
        toolCalls: [toolCall],
        createdAt: new Date(),
      })
    }

    this._session = { ...this._session, messages }
    this.emit()
  }

  updateToolCall(toolCallId: string, update: Partial<Omit<ToolCall, 'id' | 'name'>>): void {
    const messages = this._session.messages.map(msg => {
      if (!msg.toolCalls) return msg
      const toolCalls = msg.toolCalls.map(tc =>
        tc.id === toolCallId ? { ...tc, ...update } : tc,
      )
      return { ...msg, toolCalls }
    })

    this._session = { ...this._session, messages }
    this.emit()
  }

  updateTokenUsage(usage: TokenUsage): void {
    this._session = { ...this._session, tokenUsage: usage }
    this.emit()
  }

  clear(): void {
    if (this._resetTimer !== null) {
      clearTimeout(this._resetTimer)
      this._resetTimer = null
    }
    this._session = makeInitialSession(this._session.id)
    this.emit()
  }
}

function makeInitialSession(id: string): Session {
  return {
    id,
    messages: [],
    status: 'idle',
    tokenUsage: { input: 0, output: 0, total: 0 },
    error: null,
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}
