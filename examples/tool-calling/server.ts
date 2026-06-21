import 'dotenv/config'
import express from 'express'
import { z } from 'zod'
import { createStrandHandler } from '@strandjs/anthropic'
import { tool } from '@strandjs/core'

const app = express()
app.use(express.json())

const getWeatherTool = tool({
  name: 'get_weather',
  description: 'Get current weather conditions for a city.',
  parameters: z.object({
    location: z.string().describe('City name, e.g. "New York"'),
    unit: z.enum(['celsius', 'fahrenheit']).default('fahrenheit'),
  }),
})

// Simulated weather data — replace with a real API in production
async function fetchWeather(location: string, unit: string) {
  await new Promise(r => setTimeout(r, 800)) // simulate network delay
  const temp = unit === 'celsius' ? 22 : 72
  return { location, temperature: temp, unit, condition: 'Partly cloudy', humidity: '65%' }
}

app.post('/api/strand', createStrandHandler({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-6',
  system: 'You are a weather assistant. Use the get_weather tool to answer questions.',
  tools: [getWeatherTool],
  onToolCall: async (name, args) => {
    if (name === 'get_weather') {
      return fetchWeather(args.location as string, (args.unit as string) ?? 'fahrenheit')
    }
  },
}))

app.listen(3001, () => console.log('Strand server running on http://localhost:3001'))
