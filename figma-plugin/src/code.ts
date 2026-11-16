import {
  Diff, FigmaMap, CodeNode, Measured, Rgba, measureCode, resolveKey, sameColor, toHex, fmt, fmtBox,
  weightFromStyle,
} from './shared'

figma.showUI(__html__, { width: 520, height: 640, themeColors: true })

const IGNORE_KEY = 'ignored-v1'
type IgnoreStore = Record<string, string> // id -> code value when ignored

type Skipped = { component: string; reason: string }
type Result = { diffs: Diff[]; skipped: Skipped[]; notes: string[]; ignoredCount: number; checkedAt: number }

let last: { map: FigmaMap; light: Record<string, CodeNode> } | null = null

// ---------- Figma-side measurement ----------
function lightModeId(coll: VariableCollection): string {
  const m = coll.modes.find((x) => /light/i.test(x.name))
  return m ? m.modeId : coll.defaultModeId
}

async function resolveVariable(v: Variable, depth = 0): Promise<Rgba | null> {
  if (depth > 8) return null
  const coll = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId)
  if (!coll) return null
  const val = v.valuesByMode[lightModeId(coll)] ?? v.valuesByMode[coll.defaultModeId]
  if (val && typeof val === 'object' && 'type' in val && val.type === 'VARIABLE_ALIAS') {
    const next = await figma.variables.getVariableByIdAsync(val.id)
    return next ? resolveVariable(next, depth + 1) : null
  }
  if (val && typeof val === 'object' && 'r' in val) return { r: val.r, g: val.g, b: val.b, a: 'a' in val ? val.a : 1 }
  return null
}

type Paint1 = { color: Rgba | null; variable: Variable | null; hasFill: boolean }
async function readFill(node: GeometryMixin & SceneNode): Promise<Paint1> {
  const fills = node.fills
  if (fills === figma.mixed || !Array.isArray(fills)) return { color: null, variable: null, hasFill: false }
  const p = (fills as readonly Paint[]).find((x) => x.type === 'SOLID' && x.visible !== false) as SolidPaint | undefined
  if (!p) return { color: null, variable: null, hasFill: false }
  const alias = p.boundVariables?.color
  let variable: Variable | null = null
  let color: Rgba | null = null
  if (alias) {
    variable = await figma.variables.getVariableByIdAsync(alias.id)
    if (variable) color = await resolveVariable(variable)
  }
  if (!color) color = { r: p.color.r, g: p.color.g, b: p.color.b, a: 1 }
  return { color: { ...color, a: color.a * (p.opacity ?? 1) }, variable, hasFill: true }
}

function firstTextNode(n: SceneNode): TextNode | null {
  if (n.type === 'TEXT') return n
  if ('children' in n) for (const c of n.children) { const t = firstTextNode(c); if (t) return t }
  return null
}

function lineHeightPx(t: TextNode): number | null {
  const lh = t.lineHeight
  if (lh === figma.mixed || lh.unit === 'AUTO') return null
  if (lh.unit === 'PIXELS') return lh.value
  const fs = t.fontSize
  return fs === figma.mixed ? null : (lh.value / 100) * fs
}

async function measureFigma(node: ComponentNode) {
  const text = firstTextNode(node)
  const fill = await readFill(node)
  const tfill = text ? await readFill(text) : null
  const radius: [number, number, number, number] = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'].map(
    (k) => ((node as unknown as Record<string, number>)[k]) || 0,
  ) as [number, number, number, number]
  const auto = node.layoutMode !== 'NONE'
  return {
    node, text, fill, tfill,
    width: node.width, height: node.height, radius,
    padding: auto ? ([node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft] as [number, number, number, number]) : null,
    gap: auto ? node.itemSpacing : null,
    fontSize: text && text.fontSize !== figma.mixed ? text.fontSize : null,
    fontWeight: text && text.fontName !== figma.mixed ? weightFromStyle(text.fontName.style) : null,
    lineHeight: text ? lineHeightPx(text) : null,
  }
}

function variantProps(n: ComponentNode): Record<string, string> {
  const vp = (n as unknown as { variantProperties: Record<string, string> | null }).variantProperties
  if (vp) return vp
  const out: Record<string, string> = {}
  for (const part of n.name.split(',')) {
    const [k, ...v] = part.split('=')
    if (v.length) out[k.trim()] = v.join('=').trim()
  }
  return out
}

// ---------- comparison ----------
async function compare(): Promise<Result> {
  if (!last) throw new Error('no data')
  const { map, light } = last
  const ignored: IgnoreStore = (await figma.clientStorage.getAsync(IGNORE_KEY)) || {}
  const diffs: Diff[] = []
  const skipped: Skipped[] = []
  const notes: string[] = []
  let ignoredCount = 0

  for (const [comp, c] of Object.entries(map.components)) {
    const vm = c.variantMap
    if (!vm) { skipped.push({ component: comp, reason: 'no variantMap in figma-map.json' }); continue }
    const setName = vm.figmaNode && c.figma[vm.figmaNode] ? vm.figmaNode : Object.keys(c.figma)[0]
    const nodeId = c.figma[setName]
    const set = await figma.getNodeByIdAsync(nodeId)
    if (!set || set.type !== 'COMPONENT_SET') {
      skipped.push({ component: comp, reason: `node ${nodeId} (${setName}) not found or not a component set in this file` })
      continue
    }
    for (const v of set.children) {
      if (v.type !== 'COMPONENT') continue
      const props = variantProps(v)
      const label = Object.entries(props).map(([k, x]) => `${k}=${x}`).join(', ')
      const r = resolveKey(c.measure, vm, props)
      if ('error' in r) { notes.push(`${comp} [${label}]: ${r.error}`); continue }
      const entry = light[r.key]
      if (!entry) { notes.push(`${comp} [${label}]: no code measurement "${r.key}"`); continue }
      const code = measureCode(entry)
      if (!code) { notes.push(`${comp} [${label}]: empty code measurement "${r.key}"`); continue }
      const f = await measureFigma(v)
      const push = (prop: string, codeS: string, figS: string, value: unknown, target?: string) => {
        const id = `${comp}|${label}|${prop}`
        if (ignored[id] === codeS) { ignoredCount++; return }
        diffs.push({ id, component: comp, variant: label, prop, code: codeS, figma: figS, nodeId: v.id, textNodeId: target, value })
      }
      const num = (prop: string, a: number | null, b: number | null, tol: number, target?: string) => {
        if (a === null || b === null || Math.abs(a - b) < tol) return
        push(prop, fmt(a), fmt(b), a, target)
      }
      num('width', code.width, f.width, 1)
      num('height', code.height, f.height, 1)
      if (code.radius && code.radius.some((x, i) => Math.abs(x - f.radius[i]) >= 0.01)) push('corner radius', fmtBox(code.radius), fmtBox(f.radius), code.radius)
      if (code.padding && f.padding && code.padding.some((x, i) => Math.abs(x - f.padding![i]) >= 0.01)) push('padding', fmtBox(code.padding), fmtBox(f.padding), code.padding)
      num('gap', code.gap, f.gap, 0.01)
      if (f.text) {
        num('font size', code.fontSize, f.fontSize, 0.01, f.text.id)
        num('font weight', code.fontWeight, f.fontWeight, 0.5, f.text.id)
        num('line height', code.lineHeight, f.lineHeight, 0.01, f.text.id)
        if (code.textColor !== undefined && f.tfill && !sameColor(code.textColor, f.tfill.color))
          push('text colour', toHex(code.textColor), toHex(f.tfill.color), code.textColor, f.text.id)
      }
      if (!sameColor(code.fill, f.fill.color)) push('fill colour', toHex(code.fill), toHex(f.fill.color), code.fill)
    }
  }
  return { diffs, skipped, notes, ignoredCount, checkedAt: Date.now() }
}

// ---------- apply ----------
async function setColor(node: SceneNode & GeometryMixin, color: Rgba | null): Promise<string> {
  const cur = await readFill(node)
  if (cur.variable) {
    const coll = await figma.variables.getVariableCollectionByIdAsync(cur.variable.variableCollectionId)
    if (!coll) throw new Error('variable collection missing')
    if (!color || color.a <= 0.004) throw new Error('code colour is transparent; cannot write that into a variable. Remove the fill manually.')
    cur.variable.setValueForMode(lightModeId(coll), { r: color.r, g: color.g, b: color.b, a: color.a })
    return `variable "${cur.variable.name}" (light)`
  }
  if (!color || color.a <= 0.004) { node.fills = []; return 'removed fill' }
  node.fills = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: color.a }]
  return 'node fill (no bound variable)'
}

async function weightFont(t: TextNode, weight: number): Promise<FontName> {
  const cur = t.fontName === figma.mixed ? null : t.fontName
  const fonts = await figma.listAvailableFontsAsync()
  const family = cur ? cur.family : fonts[0].fontName.family
  const hit = fonts.find((x) => x.fontName.family === family && weightFromStyle(x.fontName.style) === weight && !/italic|oblique/i.test(x.fontName.style))
  if (!hit) throw new Error(`no ${family} style with weight ${weight} available`)
  return hit.fontName
}

async function apply(d: Diff): Promise<string> {
  const node = await figma.getNodeByIdAsync(d.nodeId)
  if (!node || node.type !== 'COMPONENT') throw new Error('variant node not found')
  const text = d.textNodeId ? await figma.getNodeByIdAsync(d.textNodeId) : null
  const v = d.value as never
  switch (d.prop) {
    case 'width': node.resize(v as number, node.height); return 'width set'
    case 'height': node.resize(node.width, v as number); return 'height set'
    case 'corner radius': { const r = v as number[]; node.topLeftRadius = r[0]; node.topRightRadius = r[1]; node.bottomRightRadius = r[2]; node.bottomLeftRadius = r[3]; return 'radius set' }
    case 'padding': { const p = v as number[]; node.paddingTop = p[0]; node.paddingRight = p[1]; node.paddingBottom = p[2]; node.paddingLeft = p[3]; return 'padding set' }
    case 'gap': node.itemSpacing = v as number; return 'gap set'
    case 'fill colour': return 'updated ' + (await setColor(node, v))
  }
  if (!text || text.type !== 'TEXT') throw new Error('text node not found')
  switch (d.prop) {
    case 'font size':
    case 'font weight':
    case 'line height': {
      if (text.fontName === figma.mixed) throw new Error('mixed fonts')
      const font = d.prop === 'font weight' ? await weightFont(text, v as number) : text.fontName
      await figma.loadFontAsync(font)
      if (d.prop === 'font weight') text.fontName = font
      if (d.prop === 'font size') text.fontSize = v as number
      if (d.prop === 'line height') text.lineHeight = { unit: 'PIXELS', value: v as number }
      return d.prop + ' set'
    }
    case 'text colour': return 'updated ' + (await setColor(text, v))
  }
  throw new Error('unknown property ' + d.prop)
}

// ---------- messaging ----------
async function send(): Promise<void> {
  try {
    figma.ui.postMessage({ type: 'result', ...(await compare()) })
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String(e) })
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'compare') {
    last = { map: msg.map, light: msg.light }
    await send()
  } else if (msg.type === 'apply') {
    try {
      const how = await apply(msg.diff)
      figma.notify(`Applied: ${msg.diff.prop} (${how})`)
    } catch (e) {
      figma.notify('Apply failed: ' + e, { error: true })
      figma.ui.postMessage({ type: 'toast', message: `Apply failed: ${e}` })
    }
    if (last) await send()
  } else if (msg.type === 'ignore') {
    const store: IgnoreStore = (await figma.clientStorage.getAsync(IGNORE_KEY)) || {}
    store[msg.diff.id] = msg.diff.code
    await figma.clientStorage.setAsync(IGNORE_KEY, store)
    await send()
  } else if (msg.type === 'clear-ignored') {
    await figma.clientStorage.setAsync(IGNORE_KEY, {})
    await send()
  }
}
