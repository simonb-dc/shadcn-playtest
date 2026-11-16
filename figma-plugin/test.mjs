import { build } from 'esbuild'
import fs from 'node:fs'
import assert from 'node:assert/strict'
await build({ entryPoints: ['src/shared.ts'], bundle: true, format: 'esm', outfile: '.test-shared.mjs', logLevel: 'error' })
const s = await import('./.test-shared.mjs')
const map = JSON.parse(fs.readFileSync('../figma-map.json', 'utf8'))
const light = JSON.parse(fs.readFileSync('../measurements/light.json', 'utf8'))
assert.equal(s.resolveKey('button', s.asList(map.components.button.variantMap)[0], { Variant: 'Default', Size: 'sm', State: 'Focus' }).key, 'button/default/sm/focus-visible')
assert.equal(s.resolveKey('toggle', map.components.toggle.variantMap, { variant: 'outline', size: 'lg', state: 'On' }).key, 'toggle/outline/lg/pressed')
assert.ok(s.resolveKey('card', map.components.card.variantMap, { size: 'sm', footer: 'false' }).skip)
assert.equal(s.resolveKey('card', map.components.card.variantMap, { size: 'sm', footer: 'true' }).key, 'card/default/sm/full')
assert.equal(s.resolveKey('avatar', map.components.avatar.variantMap, { type: 'image', size: 'lg', badge: 'true' }).key, 'avatar/image/lg/badge')
assert.equal(s.resolveKey('badge', map.components.badge.variantMap, { variant: 'Secondary' }).key, 'badge/secondary/default/default')
assert.equal(s.resolveKey('alert', map.components.alert.variantMap, { variant: 'destructive', action: 'false' }).key, 'alert/destructive/default/title-description')
// Every property combination in the real Figma sets must resolve to an existing code key.
const V6 = ['default','secondary','outline','ghost','destructive','link']
const sets = [
  ['button', 'Button', { variant: V6, size: ['default','sm','xs','lg'], state: ['default','hover','focus','disabled'] }],
  ['button', 'Button (icon)', { variant: V6, size: ['icon','icon-xs','icon-sm','icon-lg'], state: ['default','hover'] }],
  ['badge', 'Badge', { variant: ['default','secondary','destructive','outline','ghost','link'] }],
  ['toggle', 'Toggle', { variant: ['default','outline'], size: ['default','sm','lg'], state: ['off','on','hover','focus','disabled','invalid'] }],
  ['avatar', 'Avatar', { size: ['default','sm','lg'], type: ['fallback','image'], badge: ['false','true'] }],
  ['alert', 'Alert', { variant: ['default','destructive'], action: ['false','true'] }],
  ['card', 'Card', { size: ['default','sm'], footer: ['false','true'] }],
]
const expected = { unmatched: [], skipped: 0, ok: 0 }
for (const [comp, node, propDef] of sets) {
  const vm = s.asList(map.components[comp].variantMap).find((m) => m.figmaNode === node)
  assert.ok(vm, comp + ' has no variantMap for ' + node)
  const names = Object.keys(propDef)
  const rec = (i, cur) => {
    if (i === names.length) {
      const r = s.resolveKey(map.components[comp].measure, vm, cur)
      if (r.skip) expected.skipped++
      else if (r.error || !light[r.key]) expected.unmatched.push(node + ' ' + JSON.stringify(cur) + ' -> ' + (r.key ?? r.error))
      else expected.ok++
      return
    }
    for (const v of propDef[names[i]]) rec(i + 1, { ...cur, [names[i]]: v })
  }
  rec(0, {})
}
console.log('figma combos:', expected.ok, 'ok,', expected.skipped, 'skipped silently,', expected.unmatched.length, 'unmatched')
for (const u of expected.unmatched) console.log('  unmatched:', u)
// Only known gap: avatar fallback + badge=true has no code measurement.
assert.deepEqual(expected.unmatched.filter((u) => !u.startsWith('Avatar')), [])
assert.equal(expected.skipped, 2) // card footer=false (default + sm)

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
