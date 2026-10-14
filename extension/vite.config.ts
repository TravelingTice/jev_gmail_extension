import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const placeHtml = (): Plugin => ({
  name: 'place-html',
  enforce: 'post',
  generateBundle(_options, bundle) {
    for (const item of Object.values(bundle)) {
      if (item.type !== 'asset' || !item.fileName.endsWith('.html')) continue
      const source =
        typeof item.source === 'string'
          ? item.source
          : new TextDecoder().decode(item.source)
      if (item.fileName.includes('popup')) {
        item.fileName = 'popup.html'
        item.source = source.replaceAll('../', '')
      }
      if (item.fileName.includes('options')) {
        item.fileName = 'options.html'
        item.source = source.replaceAll('../', '')
      }
    }
  },
})

export default defineConfig({
  plugins: [react(), placeHtml()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve('src/ui/popup/index.html'),
        options: resolve('src/ui/options/index.html'),
        background: resolve('src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
