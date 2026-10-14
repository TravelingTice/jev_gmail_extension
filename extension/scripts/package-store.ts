import { execFileSync } from 'node:child_process'
import { buildManifest } from './manifest'
import { verifyDist } from './verify-dist'

await verifyDist()
const manifest = buildManifest('production')
if (JSON.stringify(manifest).includes('127.0.0.1'))
  throw new Error('refusing to package a test manifest')
execFileSync('zip', ['-r', '../gmail-email-classifier.zip', '.'], {
  cwd: 'dist',
  stdio: 'inherit',
})
