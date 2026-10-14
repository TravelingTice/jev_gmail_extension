import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { buildManifest } from './manifest'

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

export const verifyDist = async (): Promise<void> => {
  const manifest = JSON.parse(
    readFileSync('dist/manifest.json', 'utf8'),
  ) as ReturnType<typeof buildManifest>
  if (manifest.name !== 'GmailClass') throw new Error('manifest name')
  if (
    manifest.description !==
    'GmailClass - Gmail Email Classifier Powered By Jev'
  )
    throw new Error('manifest description')
  if (manifest.manifest_version !== 3) throw new Error('manifest version')
  const serialized = JSON.stringify(manifest)
  if (serialized.includes('127.0.0.1') || serialized.includes('<all_urls>')) {
    throw new Error('production manifest contains a test or broad host')
  }
  const files = walk('dist')
  for (const file of files) {
    if (file.endsWith('.png')) continue
    const text = readFileSync(file, 'utf8')
    if (
      text.includes('TYPESAFE_API_KEY') ||
      text.includes('your_jev_api_key_here')
    ) {
      throw new Error(`secret-like string in ${file}`)
    }
    if (/<script[^>]+src=["']https?:/i.test(text))
      throw new Error(`remote script in ${file}`)
  }
  for (const size of [16, 32, 48, 128]) {
    const image = sharp(`dist/icons/icon${size}.png`)
    const meta = await image.metadata()
    if (meta.width !== size || meta.height !== size)
      throw new Error(`icon ${size} has the wrong dimensions`)
  }
}
