import { readFileSync, writeFileSync, existsSync } from 'fs'

const shebang = '#!/usr/bin/env node\n'
const files = ['dist/cli.js', 'dist/cli.cjs']

for (const file of files) {
  if (!existsSync(file)) continue
  const content = readFileSync(file, 'utf8')
  if (!content.startsWith('#!')) {
    writeFileSync(file, shebang + content)
    console.log(`Added shebang to ${file}`)
  }
}
