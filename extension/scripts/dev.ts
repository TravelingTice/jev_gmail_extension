import { build } from 'vite'

await Promise.all([
  build({ configFile: 'vite.config.ts', build: { watch: {} } }),
  build({ configFile: 'vite.content.config.ts', build: { watch: {} } }),
])
