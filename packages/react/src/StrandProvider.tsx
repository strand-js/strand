import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import type { StrandClient } from '@strand-js/core'
import { ToolCallStore } from '@strand-js/core'

interface StrandContextValue {
  client: StrandClient
  toolStore: ToolCallStore
}

const StrandContext = createContext<StrandContextValue | null>(null)

interface StrandProviderProps {
  client: StrandClient
  children: ReactNode
}

export function StrandProvider({ client, children }: StrandProviderProps) {
  const [toolStore] = useState(() => new ToolCallStore())
  const value = useMemo(() => ({ client, toolStore }), [client, toolStore])
  return <StrandContext.Provider value={value}>{children}</StrandContext.Provider>
}

// Returns the nearest provider context, or falls back to explicit client.
// When no provider exists, tool store is ephemeral — useToolCall won't share state.
export function useStrandContext(explicitClient?: StrandClient): StrandContextValue {
  const ctx = useContext(StrandContext)

  if (ctx) {
    return explicitClient ? { client: explicitClient, toolStore: ctx.toolStore } : ctx
  }

  if (explicitClient) {
    // No provider — stable tool store per hook instance is handled by caller
    return { client: explicitClient, toolStore: new ToolCallStore() }
  }

  throw new Error(
    '[strand] No StrandClient found. Wrap your app in <StrandProvider client={client}> or pass a client prop to the hook.',
  )
}
