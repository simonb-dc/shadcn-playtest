import { build } from 'esbuild'
import fs from 'node:fs'
import assert from 'node:assert/strict'
await build({ entryPoints: ['src/shared.ts'], bundle: true, format: 'esm', outfile: '.test-shared.mjs', logLevel: 'error' })
const s = await import('./.test-shared.mjs')
const map = JSON.parse(fs.readFileSync('../figma-map.json', 'utf8'))
const light = JSON.parse(fs.readFileSync('../measurements/light.json', 'utf8'))
assert.equal(s.resolveKey('button', map.components.button.variantMap, { Variant: 'Default', Size: 'sm', State: 'Focus' }).key, 'button/default/sm/focus-visible')
assert.equal(s.resolveKey('toggle', map.components.toggle.variantMap, { variant: 'outline', size: 'lg', state: 'On' }).key, 'toggle/outline/lg/pressed')
assert.equal(s.resolveKey('card', map.components.card.variantMap, { size: 'sm', footer: 'false' }).key, 'card/default/sm/header-only')
assert.equal(s.resolveKey('avatar', map.components.avatar.variantMap, { type: 'image', size: 'lg', badge: 'true' }).key, 'avatar/image/lg/badge')
assert.equal(s.resolveKey('badge', map.components.badge.variantMap, { variant: 'Secondary' }).key, 'badge/secondary/default/default')
assert.equal(s.resolveKey('alert', map.components.alert.variantMap, { variant: 'destructive' }).key, 'alert/destructive/default/title-description')
// every resolvable key pattern exists in the measurements
let miss = []
const combos = { button: ['default','secondary','destructive','outline','ghost','link'] }
for (const [name, c] of Object.entries(map.components)) {
  if (!c.variantMap) continue
  const keys = Object.keys(light).filter((k) => k.startsWith(c.measure + '/'))
  for (const k of keys) { const m = s.measureCode(light[k]); if (!m) miss.push(k) }
  console.log(name, keys.length, 'keys measured')
}
assert.equal(miss.length, 0, miss.join())
const btn = s.measureCode(light['button/default/default/default'])
assert.equal(s.toHex(btn.fill), '#171717')
assert.equal(btn.fontSize, 14); assert.equal(btn.fontWeight, 500); assert.equal(btn.lineHeight, 20)
assert.deepEqual(btn.padding, [0, 10, 0, 10]); assert.equal(btn.gap, 6)
assert.equal(s.toHex(s.parseColor('oklch(0.985 0 0)')), '#fafafa')
assert.equal(s.toHex(s.parseColor('rgba(0, 0, 0, 0)')), 'none')
console.log('all tests passed')
fs.unlinkSync('.test-shared.mjs')
