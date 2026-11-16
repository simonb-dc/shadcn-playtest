# shadcn-playtest
Reference app for the shadcn/ui base-nova Figma library: real components to diff against Figma, plus Code Connect target.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (host 0.0.0.0, port 5173, strictPort)
```

Demo route: **`/demo`** (`/` redirects there). Dark: `/demo?theme=dark`. Alert-dialog open state: `/demo?dialog=default` or `?dialog=sm`; open tooltip: `?tooltip=top|right|bottom|left`.
In Codespaces, port 5173 is forwarded via `.devcontainer/devcontainer.json` (also auto-detected by the Ports panel).

## Setup (exact)

```bash
npm create vite@9.3.4 app -- --template react-ts --no-interactive   # files copied into repo root
npm i tailwindcss @tailwindcss/vite react-router-dom
npx shadcn@4.23.0 init -b base -p nova -y        # Base UI + Nova preset; baseColor neutral
npx shadcn@4.23.0 add button badge avatar alert accordion breadcrumb button-group \
  alert-dialog aspect-ratio attachment bubble calendar -y
```

`components.json`: `style: base-nova`, `baseColor: neutral`, `iconLibrary: lucide`, `cssVariables: true`.
Components are untouched registry output in `src/components/ui/`. (`separator` was pulled in as a dependency of button-group.)
The `cn` import is `cn@0.5.2` (official `shadcn-ui/cn` package, registry default for base-nova).

| Tool / package | Version |
| --- | --- |
| node / npm | 24.22.2 / 11.19.1 |
| `shadcn` CLI | 4.23.0 |
| `react`, `react-dom` | 19.3.1 |
| `vite` | 8.3.8 |
| `@vitejs/plugin-react` | 6.3.0 |
| `typescript` | 7.0.2 |
| `tailwindcss`, `@tailwindcss/vite` | 4.3.5 |
| `@base-ui/react` | 1.9.0 |
| `cn` | 0.5.2 |
| `class-variance-authority` | 0.7.1 |
| `tw-animate-css` | 1.4.0 |
| `lucide-react` | 1.73.0 |
| `react-day-picker` | 10.0.2 |
| `date-fns` | 4.4.0 |
| `react-router-dom` | 7.18.5 |
| `@fontsource-variable/geist` | 5.3.0 |

## /demo conventions

- Every item sits in `[data-demo="component/variant/size/state"]` (424 items; ids unique). Captions live outside the wrapper.
- No `className` overrides on components. Scaffolding CSS is in `src/demo/demo.css` and only targets the grid and cell wrappers.
- Cells are fixed 288px wide; grid column counts are fixed per section.
- Real attributes for: `disabled`, `aria-invalid`, open accordion (`defaultValue`), attachment `state`, calendar selection.
- **hover / focus-visible / active / focus-within**: `src/index.css` redefines those four Tailwind variants (`@custom-variant`) so `[data-force="<state>"]` fires the same utilities as the real pseudo-class. Component source is untouched; real pseudo-classes still work. Verified: hover/focus-visible/active buttons compute different styles from default.
- **Exception:** `bubble/*/*/button-hover` (14 cells) use a literal `:hover` inside an arbitrary selector, so `data-force` does not reach it. Those need CDP `CSS.forcePseudoState` on the `[data-force=hover]` element.
- Badge hover cells render as `<a>` (the component only styles hover for anchors).
- Accordion open and dialog use enter animations; wait ~300ms before capture.
- alert-dialog content portals to `<body>` as a fixed overlay, so the grid shows triggers; the open popup carries `data-demo="alert-dialog/default/<size>/open-popup"` under `?dialog=<size>`.
- Calendar is pinned to January 2025 for determinism.
- Capture viewport: **1440x900**. Some component classes respond to viewport width (`md:`/`sm:` in calendar, alert, alert-dialog), so keep it fixed.
- `vite.config.ts` sets `allowedHosts: ['.app.github.dev']` so the Codespaces forwarded URL isn't blocked.

## Measurements

`npm run dev` in one shell, then `node scripts/measure.mjs [baseUrl]` (default `http://localhost:5173/shadcn-playtest`). Playwright is a devDependency; run `npx playwright install chromium` once, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` (the script also uses `/opt/pw-browsers/chromium` if it exists) to use an existing Chromium.
The committed baseline is generated in the Claude Code cloud environment; run `npm run sync:check` there for comparable results.
Writes `measurements/light.json`, `measurements/dark.json` (keyed by `data-demo` id; `?dialog=default|sm` and `?tooltip=top|right|bottom|left` open states merged in) and `measurements/shots/*.png` (light only). Viewport 1440x900. Node `0` in each entry is the `data-demo` wrapper; the component is its child. Infinite animations (attachment shimmer) are cancelled to base style; `data-force` elements are also forced via CDP so bubble hover applies.

## Figma traceability / upstream sync

**Code is the source of truth.** `figma-map.json` links each component in `src/components/ui/` to its Figma component-set node IDs (file `7FfUnoOiC22clHRrl1EFOS`) and to its key prefix in `measurements/*.json`.

1. Run `npm run sync:check` (needs network for the shadcn registry and `npx playwright install chromium`). It re-adds every mapped component with `npx shadcn@latest add <name> --overwrite`, prints `git diff --stat src/components/ui`, re-runs `scripts/measure.mjs` (starting vite if needed), and prints per component which sizes, colours, radius, padding and font values changed versus the committed measurements. Width/height differences under 1px and `measurements/shots` are ignored in the diff output. It always exits 0 and leaves everything unstaged. Components missing upstream (e.g. custom ones) are listed as not updated.
2. Review with `git diff`. Discard with `git checkout -- src measurements`.
3. For each changed component, look up its node IDs in `figma-map.json` and update the matching Figma component set. Commit code, measurements and Figma changes together.
