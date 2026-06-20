import 'dotenv/config'
import express from 'express'
import { z } from 'zod'
import { createStrandHandler } from '@strand/anthropic'
import { tool } from '@strand/core'

const app = express()
app.use(express.json())

const searchTool = tool({
  name: 'search',
  description: 'Search the web for information on a topic.',
  parameters: z.object({ query: z.string().describe('Search query') }),
})

const calculatorTool = tool({
  name: 'calculator',
  description: 'Evaluate a mathematical expression.',
  parameters: z.object({ expression: z.string().describe('Math expression, e.g. "2 + 2 * 10"') }),
})

// Simulated implementations
async function simulateSearch(query: string) {
  await new Promise(r => setTimeout(r, 600))
  const results: Record<string, string> = {
    default: `Search results for "${query}": Found 3 relevant articles covering the topic in depth.`,
    population: 'World population in 2024: approximately 8.1 billion people.',
    gdp: 'Global GDP in 2024: approximately $105 trillion USD.',
    climate: 'Global average temperature has risen ~1.1°C since pre-industrial times.',
  }
  const key = Object.keys(results).find(k => query.toLowerCase().includes(k)) ?? 'default'
  return { query, results: results[key] }
}

function evaluateExpression(expression: string) {
  try {
    // Simple safe eval for demo — use a proper math library in production
    const result = Function(`'use strict'; return (${expression})`)() as number
    return { expression, result }
  } catch {
    return { expression, error: 'Could not evaluate expression' }
  }
}

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-6',
  system: 'You are a research assistant. Use tools to gather information and provide accurate, detailed answers. Think step by step.',
  tools: [searchTool, calculatorTool],
  maxSteps: 6,
  onToolCall: async (name, args) => {
    if (name === 'search') return simulateSearch(args.query as string)
    if (name === 'calculator') return evaluateExpression(args.expression as string)
  },
}))

app.listen(3001, () => console.log('Strand server running on http://localhost:3001'))
