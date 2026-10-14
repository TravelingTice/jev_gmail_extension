import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import sharp from 'sharp'

const source = 'assets/brand/g-class-logo.png'
const trimmed = await sharp(source).trim().png().toBuffer()
const meta = await sharp(trimmed).metadata()
const pad = Math.round(Math.max(meta.width ?? 0, meta.height ?? 0) * 0.08)
const master = await sharp(trimmed)
  .extend({
    top: pad,
    bottom: pad,
    left: pad,
    right: pad,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .resize(1024, 1024, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer()

const sizes = [16, 32, 48, 128, 256, 1024]
for (const size of sizes) {
  const path =
    size === 1024
      ? 'assets/brand/logo-1024.png'
      : size === 256
        ? 'assets/brand/logo-ui.png'
        : `public/icons/icon${size}.png`
  mkdirSync(dirname(path), { recursive: true })
  await sharp(master).resize(size, size).png().toFile(path)
}
