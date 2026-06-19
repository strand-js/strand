import { createContext, useContext, type ReactNode } from 'react'
import type { StrandClient } from '@strand/core'

interface StrandContextValue {
  client: StrandClient
}

const StrandContext = createContext<StrandContextValue | null>(null)

interface StrandProviderProps {
  client: StrandClient
  children: ReactNode
}

export function StrandProvider({ client, children }: StrandProviderProps) {
  return <StrandContext.Provider value={{ client }}>{children}</StrandContext.Provider>
}

export function useStrandClient(explicitClient?: StrandClient): StrandClient {
  const ctx = useContext(StrandContext)
  if (explicitClient) return explicitClient
  if (!ctx) {
    throw new Error(
      '[strand] No StrandClient found. Wrap your app in <StrandProvider client={client}> or pass client directly to the hook.',
    )
  }
  return ctx.client
}
