export interface RequestValidationConfig {
  maxMessages?: number       // default: 100
  maxMessageLength?: number  // default: 50_000 chars per message
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

export function validateMessages(
  messages: unknown,
  config: RequestValidationConfig = {},
): ValidationResult {
  if (!Array.isArray(messages)) {
    return { ok: false, status: 400, error: 'messages must be an array' }
  }

  const maxMessages = config.maxMessages ?? 100
  if (messages.length > maxMessages) {
    return { ok: false, status: 400, error: `Too many messages — max ${maxMessages}` }
  }

  const maxLen = config.maxMessageLength ?? 50_000

  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null) {
      return { ok: false, status: 400, error: 'Each message must be an object' }
    }

    const { role, content } = msg as Record<string, unknown>

    if (!['user', 'assistant'].includes(role as string)) {
      return { ok: false, status: 400, error: `Invalid message role: "${role}". Must be "user" or "assistant"` }
    }

    if (typeof content !== 'string') {
      return { ok: false, status: 400, error: 'Message content must be a string' }
    }

    if (content.length > maxLen) {
      return {
        ok: false,
        status: 400,
        error: `Message content exceeds max length of ${maxLen} characters`,
      }
    }
  }

  return { ok: true }
}
