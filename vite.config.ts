import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = dirname(fileURLToPath(import.meta.url))

function appsScriptSingleHtmlPlugin(): Plugin {
  return {
    name: 'jastipnisa-apps-script-single-html',
    apply: 'build',
    generateBundle(_options, bundle) {
      const htmlEntry = Object.values(bundle).find(
        (item) => item.type === 'asset' && item.fileName === 'index.gas.html',
      )
      if (!htmlEntry || htmlEntry.type !== 'asset' || typeof htmlEntry.source !== 'string') {
        this.error('index.gas.html was not emitted by Vite.')
      }

      const entryChunk = Object.values(bundle).find(
        (item) => item.type === 'chunk' && item.isEntry,
      )
      if (!entryChunk || entryChunk.type !== 'chunk') {
        this.error('A single JavaScript entry chunk is required for the Apps Script build.')
      }

      let html = htmlEntry.source
      const cssAssets = Object.values(bundle).filter(
        (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
      )
      const cssText = cssAssets.map((asset) => {
        const source = typeof asset.source === 'string'
          ? asset.source
          : new TextDecoder().decode(asset.source)
        return source.replace(/<\\/style/gi, '<\\\\/style')
      }).join('\\n')

      const script = entryChunk.code.replace(/<\\/script/gi, '<\\\\/script')
      const scriptTag = '<script>' + script + '</script>'
      html = html.replace(
        /<script\\b[^>]*src=(["'])[^"']+\\1[^>]*>\\s*<\\/script>/i,
        scriptTag,
      )
      if (!html.includes(scriptTag)) {
        this.error('Could not inline the Vite JavaScript entry into the Apps Script HTML.')
      }

      html = html.replace(
        /<link\\b[^>]*href=(["'])[^"']+\\.css(?:\\?[^"']*)?\\1[^>]*>/gi,
        '',
      )
      if (cssText) {
        html = html.replace('</head>', '<style>' + cssText + '</style>\\n</head>')
      }
      if (!/<base\\b/i.test(html)) {
        html = html.replace('<head>', '<head>\\n<base target="_top">')
      }

      htmlEntry.fileName = 'Index.html'
      htmlEntry.source = html
      delete bundle['index.gas.html']

      for (const file of Object.values(bundle)) {
        if (file.fileName !== 'Index.html') delete bundle[file.fileName]
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const isGas = mode === 'gas'
  return {
    plugins: [react(), ...(isGas ? [appsScriptSingleHtmlPlugin()] : [])],
    publicDir: isGas ? false : 'public',
    base: './',
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    build: isGas
      ? {
          outDir: '.gas-build',
          emptyOutDir: true,
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          sourcemap: false,
          rollupOptions: {
            input: resolve(projectRoot, 'index.gas.html'),
            output: {
              format: 'iife',
              name: 'JastipNisaBundle',
              inlineDynamicImports: true,
            },
          },
        }
      : undefined,
  }
})
