import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(npm, ['exec', '--', 'vite', 'build', '--mode', 'gas'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  process.exit(result.status || 1)
}

const generatedHtml = resolve(root, '.gas-build', 'Index.html')
const destination = resolve(root, 'gas', 'Index.html')
if (!existsSync(generatedHtml)) {
  throw new Error('Vite GAS build did not create .gas-build/Index.html')
}

mkdirSync(resolve(root, 'gas'), { recursive: true })
copyFileSync(generatedHtml, destination)
const size = statSync(destination).size
console.log('Apps Script HTML generated: gas/Index.html (' + Math.ceil(size / 1024) + ' KB)')
