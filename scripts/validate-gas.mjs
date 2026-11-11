import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

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

const htmlPath = resolve(root, 'gas/Index.html')
const html = readFileSync(htmlPath, 'utf8')
if (!html.includes('<base target="_top">')) throw new Error('Apps Script HTML is missing base target _top.')
if (/<script\b[^>]*\bsrc=/i.test(html)) throw new Error('Apps Script HTML still contains an external script reference.')
if (/<link\b[^>]*\bstylesheet[^>]*\bhref=/i.test(html)) throw new Error('Apps Script HTML still contains an external stylesheet reference.')
if (!html.includes('JastipNisa')) throw new Error('Generated HTML does not contain the JastipNisa app shell.')
if (html.includes('VITE_SUPABASE_URL') || html.includes('VITE_SUPABASE_ANON_KEY')) {
  throw new Error('Supabase environment identifiers must not be bundled in the GAS entrypoint.')
}

const bytes = statSync(htmlPath).size
console.log('GAS validation passed. Bundle size: ' + Math.ceil(bytes / 1024) + ' KB')
