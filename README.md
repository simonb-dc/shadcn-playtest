# shadcn-playtest
Reference app for the shadcn/ui base-nova Figma library: real components to diff against Figma, plus Code Connect target.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (host 0.0.0.0, port 5173, strictPort)
```

Demo route: **`/demo`** (`/` redirects there). Dark: `/demo?theme=dark`. Alert-dialog open state: `/demo?dialog=default` or `?dialog=sm`.
In Codespaces, port 5173 is forwarded via `.devcontainer/devcontainer.json` (also auto-detected by the Ports panel).

## Setup (exact)

```bash
npm create vite@latest app -- --template react-ts --no-interactive   # files copied into repo root
npm i tailwindcss @tailwindcss/vite react-router-dom
npx shadcn@latest init -b base -p nova -y        # Base UI + Nova preset; baseColor neutral
npx shadcn@latest add button badge avatar alert accordion breadcrumb button-group \
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
- **hover / focus-visible / active cannot be set from markup.** The element under test carries `data-force="hover|focus-visible|active"`. Apply with CDP `CSS.forcePseudoState` (real browser pseudo-state) before capture.
- Accordion open and dialog use enter animations; wait ~300ms before capture.
- alert-dialog content portals to `<body>` as a fixed overlay, so the grid shows triggers; the open popup carries `data-demo="alert-dialog/default/<size>/open-popup"` under `?dialog=<size>`.
- Calendar is pinned to January 2025 for determinism.
