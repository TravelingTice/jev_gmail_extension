import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { build } from 'vite'
import { buildManifest } from './manifest'
import { verifyDist } from './verify-dist'

const mode =
  process.argv.includes('--mode') &&
  process.argv[process.argv.indexOf('--mode') + 1] === 'test'
    ? 'test'
    : 'production'

await build({ configFile: 'vite.config.ts', mode })
await build({ configFile: 'vite.content.config.ts', mode })
mkdirSync('dist/icons', { recursive: true })
cpSync('public/icons', 'dist/icons', { recursive: true })
writeFileSync(
  'dist/manifest.json',
  `${JSON.stringify(buildManifest(mode), null, 2)}\n`,
)
if (mode === 'production') await verifyDist()
