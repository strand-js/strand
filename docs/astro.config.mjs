import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  integrations: [
    starlight({
      title: 'Strand',
      description: 'AI state management for React. The layer between your UI and your LLM.',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: false,
      },
      social: {
        github: 'https://github.com/strand-js/strand',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'guides/introduction' },
            { label: 'Quick Start', slug: 'guides/quick-start' },
            { label: 'Core Concepts', slug: 'guides/core-concepts' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'useConversation', slug: 'api/use-conversation' },
            { label: 'useToolCall', slug: 'api/use-tool-call' },
            { label: 'useAgentSession', slug: 'api/use-agent-session' },
            { label: 'useStreamingText', slug: 'api/use-streaming-text' },
            { label: 'createStrandClient', slug: 'api/create-strand-client' },
            { label: 'StrandProvider', slug: 'api/strand-provider' },
          ],
        },
        {
          label: 'Providers',
          items: [
            { label: 'Anthropic', slug: 'guides/anthropic' },
            { label: 'OpenAI', slug: 'guides/openai' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'React Native', slug: 'guides/react-native' },
            { label: 'Migration from Vercel AI SDK', slug: 'guides/migration' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
})
