import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { Script } from 'node:vm'

const root = process.cwd()
const required = [
  'gas/appsscript.json',
  'gas/Code.gs',
  'gas/Schema.gs',
  'gas/Database.gs',
  'gas/Setup.gs',
  'gas/Security.gs',
  'gas/RequestService.gs',
  'gas/WorkflowService.gs',
  'gas/DriveService.gs',
  'gas/CatalogService.gs',
  'gas/Index.html',
  '.clasp.json.example',
]
const missing = required.filter((path) => !existsSync(resolve(root, path)))
if (missing.length) {
  console.error('Missing GAS files:', missing.join(', '))
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(resolve(root, 'gas/appsscript.json'), 'utf8'))
if (manifest.runtimeVersion !== 'V8' || manifest.webapp?.executeAs !== 'USER_DEPLOYING' ||
    manifest.webapp?.access !== 'ANYONE_ANONYMOUS') {
  throw new Error('Unexpected Apps Script runtime or Web App deployment identity.')
}
const scopes = manifest.oauthScopes || []
for (const scope of [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
]) {
  if (!scopes.includes(scope)) throw new Error('Missing OAuth scope: ' + scope)
}

// Parse all server files as one Apps Script V8 program. This is a syntax
// check only; Apps Script services are not available in the CI Node runtime.
const serverFiles = required.filter((path) => path.endsWith('.gs'))
const serverSource = serverFiles.map((path) =>
  '\n// ---- ' + path + ' ----\n' + readFileSync(resolve(root, path), 'utf8'),
).join('\n')
new Script(serverSource, { filename: 'JastipNisaAppsScriptBundle.gs' })

const htmlPath = resolve(root, 'gas/Index.html')
const html = readFileSync(htmlPath, 'utf8')
if (!html.includes('<base target="_top">')) throw new Error('Apps Script HTML is missing base target _top.')
// Ignore JavaScript string literals; inspect only document markup around scripts.
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
if (/<script\b[^>]*\bsrc=/i.test(markup)) throw new Error('Apps Script HTML still contains an external script reference.')
if (/<link\b[^>]*\bstylesheet[^>]*\bhref=/i.test(markup)) throw new Error('Apps Script HTML still contains an external stylesheet reference.')
if (!html.includes('JastipNisa')) throw new Error('Generated HTML does not contain the JastipNisa app shell.')
if (!html.includes('apiPublicGetCatalog') || !html.includes('apiAdminLogin')) {
  throw new Error('Generated HTML is missing required public/admin API bindings.')
}
if (html.includes('VITE_SUPABASE_URL') || html.includes('VITE_SUPABASE_ANON_KEY')) {
  throw new Error('Supabase environment identifiers must not be bundled in the GAS entrypoint.')
}

const bytes = statSync(htmlPath).size
console.log('GAS validation passed. Server syntax checked: ' + serverFiles.length + ' files. Bundle size: ' + Math.ceil(bytes / 1024) + ' KB')
