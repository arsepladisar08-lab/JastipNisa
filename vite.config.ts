import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const gasHtmlTemplatePath = resolve(projectRoot, 'index.gas.html')

function appsScriptSingleHtmlPlugin(): Plugin {
  return {
    name: 'jastipnisa-apps-script-single-html',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entryChunk = Object.values(bundle).find(
        (item) => item.type === 'chunk' && item.isEntry,
      )
      if (!entryChunk || entryChunk.type !== 'chunk') {
        this.error('A single JavaScript entry chunk is required for the Apps Script build.')
      }

      let html = readFileSync(gasHtmlTemplatePath, 'utf8')
      const cssAssets = Object.values(bundle).filter(
        (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
      )
      const cssText = cssAssets.map((asset) => {
        const source = typeof asset.source === 'string'
          ? asset.source
          : new TextDecoder().decode(asset.source)
        return source.replace(/<\/style/gi, '<\\/style')
      }).join('\n')

      const script = entryChunk.code.replace(/<\/script/gi, '<\\/script')
      const scriptTag = '<script>' + script + '</script>'
      html = html.replace(
        /<script\b[^>]*src=(["'])[^"']+\1[^>]*>\s*<\/script>/i,
        scriptTag,
      )
      if (!html.includes(scriptTag)) {
        this.error('Could not inline the React entry into the Apps Script HTML template.')
      }

      if (cssText) {
        html = html.replace('</head>', '<style>' + cssText + '</style>\n</head>')
      }
      if (!/<base\b/i.test(html)) {
        html = html.replace('<head>', '<head>\n<base target="_top">')
      }

      for (const fileName of Object.keys(bundle)) {
        delete bundle[fileName]
      }
      this.emitFile({
        type: 'asset',
        fileName: 'Index.html',
        source: html,
      })
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
            input: resolve(projectRoot, 'src/gas/main.tsx'),
            output: {
              format: 'iife',
              name: 'JastipNisaBundle',
            },
          },
        }
      : undefined,
  }
})
