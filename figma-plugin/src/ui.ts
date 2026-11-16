import type { Diff } from './shared'

const REPO = 'simonb-dc/shadcn-playtest'
const RAW = `https://raw.githubusercontent.com/${REPO}/main/`
const POLL_MS = 5 * 60 * 1000

const $ = (id: string) => document.getElementById(id)!
let currentSha = ''
let busy = false

type Result = { diffs: Diff[]; skipped: { component: string; reason: string }[]; notes: string[]; ignoredCount: number; checkedAt: number }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function banner(text: string, kind: '' | 'error' = '') {
  const b = $('banner')
  b.style.display = text ? 'block' : 'none'
  b.className = kind
  b.textContent = text
}

async function getJson(url: string) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`)
  return r.json()
}

async function fetchSha(): Promise<string> {
  const j = await getJson(`https://api.github.com/repos/${REPO}/commits/main`)
  return j.sha as string
}

async function sync(reason = '') {
  if (busy) return
  busy = true
  ;($('sync') as HTMLButtonElement).disabled = true
  banner(reason || 'Fetching from GitHub…')
  try {
    const [sha, map, light] = await Promise.all([
      fetchSha(), getJson(RAW + 'figma-map.json'), getJson(RAW + 'measurements/light.json'),
    ])
    // measurements/dark.json is fetched as requested; comparison uses light values only.
    await getJson(RAW + 'measurements/dark.json')
    currentSha = sha
    $('sha').textContent = sha.slice(0, 7)
    parent.postMessage({ pluginMessage: { type: 'compare', map, light } }, '*')
  } catch (e) {
    banner('Fetch failed: ' + e, 'error')
    busy = false
    ;($('sync') as HTMLButtonElement).disabled = false
  }
}

function render(r: Result) {
  $('checked').textContent = new Date(r.checkedAt).toLocaleTimeString()
  const groups = new Map<string, Diff[]>()
  for (const d of r.diffs) (groups.get(d.component) ?? groups.set(d.component, []).get(d.component)!).push(d)
  const swatch = (v: string) => (v.startsWith('#') ? `<span class="sw" style="background:${esc(v)}"></span>` : '')
  const dataKey = new Map<string, Diff>()
  let html = ''
  if (!r.diffs.length) html += `<p class="ok">No differences${r.ignoredCount ? ` (${r.ignoredCount} ignored)` : ''}.</p>`
  else html += `<p>${r.diffs.length} difference${r.diffs.length === 1 ? '' : 's'}${r.ignoredCount ? `, ${r.ignoredCount} ignored` : ''}.</p>`
  for (const [comp, list] of groups) {
    html += `<h2>${esc(comp)} <small>${list.length}</small></h2><table><tr><th>Variant</th><th>Property</th><th>Code</th><th>Figma</th><th></th></tr>`
    for (const d of list) {
      dataKey.set(d.id, d)
      html += `<tr><td>${esc(d.variant)}</td><td>${esc(d.prop)}</td><td>${swatch(d.code)}${esc(d.code)}</td><td>${swatch(d.figma)}${esc(d.figma)}</td>` +
        `<td class="actions"><button data-act="apply" data-id="${esc(d.id)}">Apply</button> <button data-act="ignore" data-id="${esc(d.id)}">Ignore</button></td></tr>`
    }
    html += '</table>'
  }
  if (r.skipped.length) {
    html += `<h2>Skipped <small>${r.skipped.length}</small></h2><ul>` + r.skipped.map((s) => `<li><b>${esc(s.component)}</b>: ${esc(s.reason)}</li>`).join('') + '</ul>'
  }
  if (r.notes.length) {
    html += `<h2>Unmatched variants <small>${r.notes.length}</small></h2><ul>` + r.notes.map((n) => `<li>${esc(n)}</li>`).join('') + '</ul>'
  }
  const out = $('out')
  out.innerHTML = html
  out.onclick = (ev) => {
    const t = (ev.target as HTMLElement).closest('button[data-act]') as HTMLElement | null
    if (!t) return
    const d = dataKey.get(t.dataset.id!)
    if (d) parent.postMessage({ pluginMessage: { type: t.dataset.act, diff: d } }, '*')
  }
}

window.onmessage = (e) => {
  const m = e.data.pluginMessage
  if (!m) return
  if (m.type === 'result') {
    busy = false
    ;($('sync') as HTMLButtonElement).disabled = false
    banner('')
    render(m)
  } else if (m.type === 'error') {
    busy = false
    ;($('sync') as HTMLButtonElement).disabled = false
    banner(m.message, 'error')
  } else if (m.type === 'toast') {
    banner(m.message, 'error')
  }
}

$('sync').onclick = () => sync()
$('clear').onclick = () => parent.postMessage({ pluginMessage: { type: 'clear-ignored' } }, '*')

// Auto-check: poll the commit SHA; re-run only if it changed.
setInterval(async () => {
  if (busy) return
  try {
    const sha = await fetchSha()
    if (sha !== currentSha) {
      await sync(`Repo changed (${currentSha.slice(0, 7)} → ${sha.slice(0, 7)}), re-checking…`)
    }
  } catch (e) {
    banner('SHA check failed: ' + e, 'error')
  }
}, POLL_MS)

sync()
