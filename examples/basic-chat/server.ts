import 'dotenv/config'
import express from 'express'
import { createStrandHandler } from '@strand-js/anthropic'

const app = express()
app.use(express.json())

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-6',
  system: 'You are a helpful assistant. Be concise.',
}))

app.listen(3001, () => console.log('Strand server running on http://localhost:3001'))
