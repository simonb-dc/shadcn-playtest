import { build } from 'esbuild'
import fs from 'node:fs'

const common = { bundle: true, target: 'es2019', logLevel: 'info', legalComments: 'none' }
await build({ ...common, entryPoints: ['src/code.ts'], outfile: 'code.js', format: 'iife' })
const ui = await build({ ...common, entryPoints: ['src/ui.ts'], write: false, format: 'iife', minify: true })
const js = ui.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
fs.writeFileSync('ui.html', fs.readFileSync('src/ui.html', 'utf8').replace('__UI_JS__', () => js))
console.log('built code.js + ui.html')
