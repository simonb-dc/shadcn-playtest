// Usage: npm run dev (or preview) in another shell, then: node scripts/measure.mjs [baseUrl]
// Writes measurements/{light,dark}.json and measurements/shots/*.png (light only).
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173/shadcn-playtest'
const OUT = 'measurements'
const MAX_DEPTH = 4
const PROPS = [
  'padding', 'margin', 'gap',
  'border-top-width', 'border-top-style', 'border-top-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'background-color', 'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'text-decoration-line', 'opacity', 'box-shadow', 'width', 'height',
]

// Runs in the page. Returns { id: {...} } for every [data-demo] element.
function collect({ props, maxDepth }) {
  const style = (el) => {
    const cs = getComputedStyle(el)
    return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]))
  }
  const describe = (el, depth, p) => {
    const r = el.getBoundingClientRect()
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
    const node = {
      path: p,
      tag: el.tagName.toLowerCase(),
      slot: el.getAttribute('data-slot') || undefined,
      rect: { width: r.width, height: r.height },
      style: style(el),
    }
    if (own.length) node.text = el.textContent.trim().slice(0, 40)
    if (depth < maxDepth) {
      node.children = [...el.children].map((c, i) => describe(c, depth + 1, `${p}.${i}`))
    }
    return node
  }
  const out = {}
  for (const el of document.querySelectorAll('[data-demo]')) {
    out[el.getAttribute('data-demo')] = describe(el, 0, '0')
  }
  return out
}

async function forceStates(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-force]' })
  for (const nodeId of nodeIds) {
    const { attributes } = await cdp.send('DOM.getAttributes', { nodeId })
    const state = attributes[attributes.indexOf('data-force') + 1]
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [state] })
  }
  return nodeIds.length
}

// Prefer an explicit/preinstalled Chromium (no Playwright browser download needed); else Playwright's default.
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, '/opt/pw-browsers/chromium']
  .find((p) => p && fs.existsSync(p))
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {})
const sizes = {}
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true })

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const result = {}
  const urls = [
    ['/demo', ''],
    ['/demo?dialog=default', 'dialog'],
    ['/demo?dialog=sm', 'dialog'],
    ...['top', 'right', 'bottom', 'left'].map((side) => [`/demo?tooltip=${side}`, 'tooltip']),
  ]
  for (const [u, kind] of urls) {
    const sep = u.includes('?') ? '&' : '?'
    await page.goto(`${BASE}${u}${theme === 'dark' ? `${sep}theme=dark` : ''}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-demo]')
    await page.evaluate(() => document.fonts.ready)
    const forced = await forceStates(page)
    await page.waitForTimeout(500)
    // Settle animations deterministically: finite ones run to the end, infinite ones (e.g. shimmer) are cancelled to their base style.
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        const it = a.effect?.getComputedTiming().iterations
        if (it === Infinity) a.cancel()
        else a.finish()
      }
    })
    const data = await page.evaluate(collect, { props: PROPS, maxDepth: MAX_DEPTH })
    const ids = Object.keys(data).filter((id) => !(id in result))
    for (const id of ids) result[id] = data[id]
    console.log(`${theme} ${u}: ${Object.keys(data).length} items, ${ids.length} new, ${forced} forced`)
    if (theme === 'light') {
      for (const id of ids) {
        const file = path.join(OUT, 'shots', id.replaceAll('/', '__') + '.png')
        await page.locator(`[data-demo="${id}"]`).first().screenshot({ path: file, animations: 'disabled' })
      }
    }
  }
  const file = path.join(OUT, `${theme}.json`)
  fs.writeFileSync(file, JSON.stringify(result, null, 1))
  sizes[file] = fs.statSync(file).size
  console.log(`${file}: ${Object.keys(result).length} items`)
  await ctx.close()
}
await browser.close()

const shots = fs.readdirSync(path.join(OUT, 'shots'))
const shotBytes = shots.reduce((n, f) => n + fs.statSync(path.join(OUT, 'shots', f)).size, 0)
for (const [f, s] of Object.entries(sizes)) console.log(f, (s / 1024).toFixed(0) + ' KB')
console.log(`shots: ${shots.length} files, ${(shotBytes / 1024 / 1024).toFixed(1)} MB`)
