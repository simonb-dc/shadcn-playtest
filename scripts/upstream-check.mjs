// Usage: npm run sync:check
// 1. Re-add every component in figma-map.json from upstream shadcn (--overwrite) and show the diff.
// 2. Re-run scripts/measure.mjs (starts vite if nothing is listening).
// 3. Diff new measurements/{light,dark}.json against the committed ones, per component.
// Width/height/rect differences under 2px and measurements/shots are ignored in the diff output. Always exits 0. Nothing is staged; review with `git diff`, discard with `git checkout -- src measurements`.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173/shadcn-playtest'
const map = JSON.parse(fs.readFileSync('figma-map.json', 'utf8'))
const keys = Object.keys(map.components)

// --- (a) upstream components ---
console.log(`\n== (a) shadcn add (${keys.length} components, --overwrite) ==`)
const failed = []
for (const key of keys) {
  const r = spawnSync('npx', ['--yes', 'shadcn@latest', 'add', key, '--overwrite', '--yes'], { encoding: 'utf8' })
  const ok = r.status === 0
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${key}`)
  if (!ok) failed.push({ key, msg: ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-2).join(' ') })
}
if (failed.length) {
  console.log('\nNot updated (missing upstream, custom, or network error):')
  for (const f of failed) console.log(`  - ${f.key}: ${f.msg}`)
}
console.log('\n$ git diff --stat src/components/ui')
console.log(spawnSync('git', ['diff', '--stat', 'src/components/ui'], { encoding: 'utf8' }).stdout.trim() || '(no source changes)')

// --- (b) re-measure ---
console.log('\n== (b) measure ==')
const committed = {}
for (const t of ['light', 'dark']) {
  const r = spawnSync('git', ['show', `HEAD:measurements/${t}.json`], { encoding: 'utf8', maxBuffer: 1 << 30 })
  committed[t] = r.status === 0 ? JSON.parse(r.stdout) : {}
}
const up = async () => { try { await fetch(BASE); return true } catch { return false } }
let server
if (!(await up())) {
  console.log(`no server at ${BASE}; starting vite`)
  server = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'ignore' })
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 1000))
}
const m = spawnSync('node', ['scripts/measure.mjs', BASE], { stdio: 'inherit' })
server?.kill()
if (m.status !== 0) {
  console.log('measure.mjs failed; skipping diff.')
  process.exit(0)
}

// --- (c) diff ---
const BUCKETS = {
  sizes: ['width', 'height'],
  colours: ['background-color', 'color', 'border-top-color', 'box-shadow'],
  radius: ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
  padding: ['padding', 'margin', 'gap'],
  font: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-decoration-line'],
}
const TOL = 2 // px: ignore width/height/rect differences below this
const SIZE_PROPS = new Set(['width', 'height'])
const sameSize = (a, b) => {
  const x = parseFloat(a), y = parseFloat(b)
  return Number.isFinite(x) && Number.isFinite(y) ? Math.abs(x - y) < TOL : a === b
}
const bucketOf = (p) => Object.keys(BUCKETS).find((b) => BUCKETS[b].includes(p)) ?? 'other'
const measures = Object.entries(map.components).map(([k, c]) => [c.measure, k]).sort((a, b) => b[0].length - a[0].length)
const componentOf = (id) => {
  const prefix = id.split('/')[0]
  return (measures.find(([m]) => prefix === m || prefix.startsWith(m + '-')) ?? [, prefix])[1]
}
const flatten = (node, out = {}) => {
  out[node.path] = node
  for (const c of node.children ?? []) flatten(c, out)
  return out
}
const changes = {} // component -> lines
const add = (comp, line) => (changes[comp] ??= []).push(line)

for (const theme of ['light', 'dark']) {
  const oldD = committed[theme]
  const newD = JSON.parse(fs.readFileSync(`measurements/${theme}.json`, 'utf8'))
  for (const id of new Set([...Object.keys(oldD), ...Object.keys(newD)])) {
    const comp = componentOf(id)
    if (!(id in newD)) { add(comp, `[${theme}] ${id}: REMOVED`); continue }
    if (!(id in oldD)) { add(comp, `[${theme}] ${id}: ADDED`); continue }
    const o = flatten(oldD[id]), n = flatten(newD[id])
    for (const p of new Set([...Object.keys(o), ...Object.keys(n)])) {
      const where = `[${theme}] ${id} @${p}${(n[p] ?? o[p]).slot ? ` (${(n[p] ?? o[p]).slot})` : ''}`
      if (!o[p]) { add(comp, `${where}: node ADDED`); continue }
      if (!n[p]) { add(comp, `${where}: node REMOVED`); continue }
      const props = new Set([...Object.keys(o[p].style), ...Object.keys(n[p].style)])
      for (const prop of props) {
        const a = o[p].style[prop], b = n[p].style[prop]
        if (SIZE_PROPS.has(prop) ? !sameSize(a, b) : a !== b) add(comp, `${where} ${bucketOf(prop)}: ${prop} ${o[p].style[prop]} -> ${n[p].style[prop]}`)
      }
      for (const d of ['width', 'height']) {
        if (!sameSize(o[p].rect[d], n[p].rect[d]) && sameSize(o[p].style[d], n[p].style[d])) add(comp, `${where} sizes: rect.${d} ${o[p].rect[d]} -> ${n[p].rect[d]}`)
      }
    }
  }
}

console.log('\n== (c) measurement changes vs committed ==')
const names = Object.keys(changes).sort()
if (!names.length) console.log('no measurement changes')
for (const c of names) {
  const fig = map.components[c]?.figma
  console.log(`\n# ${c}${fig ? `  (Figma: ${Object.entries(fig).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`)
  for (const l of changes[c]) console.log('  ' + l)
}
console.log('\nChanges left unstaged. Review: git diff -- src measurements/light.json measurements/dark.json (measurements/shots/*.png also change; ignored here). Discard: git checkout -- src measurements')
process.exit(0)
