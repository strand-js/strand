import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createStrandClient } from '@strand/core'
import { StrandProvider } from '@strand/react'
import { App } from './App'

const client = createStrandClient({ baseUrl: '/api/strand' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StrandProvider client={client}>
      <App />
    </StrandProvider>
  </StrictMode>,
)
