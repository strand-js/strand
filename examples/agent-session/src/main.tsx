import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createStrandClient } from '@strandjs/core'
import { StrandProvider } from '@strandjs/react'
import { App } from './App'

const client = createStrandClient({ baseUrl: '/api/strand' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StrandProvider client={client}>
      <App />
    </StrandProvider>
  </StrictMode>,
)
