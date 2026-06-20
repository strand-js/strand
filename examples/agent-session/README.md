# agent-session

Shows `useAgentSession` — a multi-step autonomous agent with observable step-by-step state.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## What it shows

- `useAgentSession` — fire a goal, watch the agent work autonomously
- `steps` — each tool call round is a visible step with input/output
- `currentStep` — highlights the active step in real time
- `cancel()` — stop mid-run
- `result` — final answer when done
