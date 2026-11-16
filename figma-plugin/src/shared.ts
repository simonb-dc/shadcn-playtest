// Pure helpers (no Figma API) so they can be tested in node.

export type VariantMap = {
  figmaNode?: string
  key: string[] // e.g. ["{variant}", "default", "{state}"]
  values?: Record<string, Record<string, string>>
}
export type MapComponent = {
  code: string
  figma: Record<string, string>
  measure: string
  variantMap?: VariantMap
}
export type FigmaMap = { figmaFile: string; components: Record<string, MapComponent> }

export type CodeNode = {
  path: string
  slot?: string
  text?: string
  rect: { width: number; height: number }
  style: Record<string, string>
  children?: CodeNode[]
}

export type Rgba = { r: number; g: number; b: number; a: number } // 0..1

/** Case-insensitive lookup of a Figma variant property. */
export function getProp(props: Record<string, string>, name: string): string | undefined {
  const k = Object.keys(props).find((p) => p.toLowerCase() === name.toLowerCase())
  return k === undefined ? undefined : props[k]
}

/** Build the measurement key for one Figma variant, or an error string. */
export function resolveKey(
  measure: string,
  vm: VariantMap,
  props: Record<string, string>,
): { key: string } | { error: string } {
  const segs: string[] = []
  for (const tpl of vm.key) {
    const m = /^\{(.+)\}$/.exec(tpl)
    if (!m) { segs.push(tpl); continue }
    const raw = getProp(props, m[1])
    if (raw === undefined) return { error: `Figma variant has no "${m[1]}" property` }
    const v = raw.trim().toLowerCase()
    const tr = vm.values && Object.keys(vm.values).find((k) => k.toLowerCase() === m[1].toLowerCase())
    const mapped = tr ? vm.values![tr][v] : undefined
    segs.push(mapped ?? v)
  }
  return { key: [measure, ...segs].join('/') }
}

// ---------- colour ----------
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const srgbEnc = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

function oklab(L: number, a: number, b: number, alpha: number): Rgba {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  return {
    r: clamp01(srgbEnc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp01(srgbEnc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp01(srgbEnc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
    a: alpha,
  }
}

const num = (s: string) => (s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s))

/** Parse CSS colour strings produced by getComputedStyle (oklch, oklab, rgb(a), color(srgb)). null = unparseable. */
export function parseColor(input: string | undefined): Rgba | null {
  if (!input) return null
  const s = input.trim().toLowerCase()
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const m = /^(oklch|oklab|rgba?|color)\((.*)\)$/.exec(s)
  if (!m) return null
  const [body, alphaPart] = m[2].split('/').map((x) => x.trim())
  let parts = body.split(/[\s,]+/).filter(Boolean)
  let alpha = alphaPart !== undefined ? num(alphaPart) : 1
  if (m[1] === 'color') {
    if (parts[0] !== 'srgb') return null
    parts = parts.slice(1)
    return { r: clamp01(num(parts[0])), g: clamp01(num(parts[1])), b: clamp01(num(parts[2])), a: alpha }
  }
  if (m[1] === 'rgb' || m[1] === 'rgba') {
    if (parts.length === 4 && alphaPart === undefined) alpha = num(parts[3])
    const c = (v: string) => clamp01((v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / 255))
    return { r: c(parts[0]), g: c(parts[1]), b: c(parts[2]), a: alpha }
  }
  const L = num(parts[0])
  if (m[1] === 'oklab') return oklab(L, num(parts[1]), num(parts[2]), alpha)
  const C = parseFloat(parts[1]) || 0
  const h = ((parseFloat(parts[2]) || 0) * Math.PI) / 180
  return oklab(L, C * Math.cos(h), C * Math.sin(h), alpha)
}

const hex2 = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
export function toHex(c: Rgba | null): string {
  if (!c || c.a <= 0.004) return 'none'
  return '#' + hex2(c.r) + hex2(c.g) + hex2(c.b) + (c.a < 0.996 ? hex2(c.a) : '')
}
export function sameColor(a: Rgba | null, b: Rgba | null): boolean {
  const ta = !a || a.a <= 0.004, tb = !b || b.a <= 0.004
  if (ta || tb) return ta && tb
  const t = 2 / 255
  return Math.abs(a!.r - b!.r) <= t && Math.abs(a!.g - b!.g) <= t && Math.abs(a!.b - b!.b) <= t && Math.abs(a!.a - b!.a) <= 0.01
}

// ---------- css numbers ----------
export const px = (s: string | undefined): number | null => {
  if (s === undefined) return null
  if (s === 'normal' || s === 'none' || s === 'auto') return 0
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/** "16px 0px 0px" -> [top,right,bottom,left] */
export function parseBox(s: string | undefined): [number, number, number, number] | null {
  if (!s) return null
  const v = s.trim().split(/\s+/).map((x) => parseFloat(x))
  if (!v.length || v.some((n) => !Number.isFinite(n))) return null
  const [t, r = t, b = t, l = r] = v
  return [t, r, b, l]
}

export const fmt = (n: number) => String(Math.round(n * 100) / 100)
export const fmtBox = (b: number[]) => b.map(fmt).join(' ')

export const WEIGHTS: Record<string, number> = {
  thin: 100, hairline: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400, book: 400,
  medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900,
}
export function weightFromStyle(style: string): number | null {
  const k = style.toLowerCase().replace(/italic|oblique/g, '').replace(/[\s_-]/g, '')
  if (k === '') return 400
  return WEIGHTS[k] ?? null
}

/** First node (self, then DFS) that carries text. */
export function firstText(n: CodeNode): CodeNode | null {
  if (n.text && n.text.trim()) return n
  for (const c of n.children ?? []) { const f = firstText(c); if (f) return f }
  return null
}

export type Measured = {
  width: number | null
  height: number | null
  radius: [number, number, number, number] | null
  padding: [number, number, number, number] | null
  gap: number | null
  fontSize: number | null
  fontWeight: number | null
  lineHeight: number | null
  fill: Rgba | null // null = no fill
  textColor: Rgba | null | undefined // undefined = no text in this variant
}

/** Normalise a code measurement entry (wrapper node "0" -> component node "0.0"). */
export function measureCode(entry: CodeNode): Measured | null {
  const root = entry.children?.[0]
  if (!root) return null
  const st = root.style
  const t = firstText(root)
  const rad = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'].map((k) => px(st[k]))
  const w = root.rect.width, h = root.rect.height
  const cap = Math.min(w, h) / 2 // Figma clamps radii to half the shortest side
  return {
    width: w,
    height: h,
    radius: rad.every((x) => x !== null) ? (rad.map((x) => Math.min(x as number, cap)) as [number, number, number, number]) : null,
    padding: parseBox(st['padding']),
    gap: px(st['gap']),
    fontSize: t ? px(t.style['font-size']) : null,
    fontWeight: t ? parseFloat(t.style['font-weight']) || null : null,
    lineHeight: t && t.style['line-height'] !== 'normal' ? px(t.style['line-height']) : null,
    fill: parseColor(st['background-color']),
    textColor: t ? parseColor(t.style['color']) : undefined,
  }
}

export type Diff = {
  id: string
  component: string
  variant: string
  prop: string
  code: string
  figma: string
  nodeId: string // variant node
  textNodeId?: string
  value: unknown // structured code value used by Apply
}
