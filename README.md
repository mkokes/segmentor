# Segmentor

A browser-first, offline-capable PWA studio for designing **closed-segment**, **open-segment**, and **stave** woodturned bowls and vases—turning any drawn vessel profile into a kerf-accurate, collision-checked cut sheet and 1:1 printable shop template.

**Live app:** https://segmentor.wouldbymarty.com/ (deployed automatically from `main` via GitHub Pages)

See [PLAN.md](PLAN.md) for the engineering specification, geometry math, data model, and phased roadmap.

## Features

- **Three construction modes:** Design **Closed Ring**, **Open Ring** (with gap angle or open % and rotary indexing angle), and **Stave** (single or multi-tier compound-tilted stave) vessels.
- **Interactive Bezier profile editor:** Drag profile anchor points and tangent handles with optional snap-to-grid (`1/8"` or `5 mm`), edit coordinates numerically, and configure wall thickness, base floor thickness, outer/inner turning allowances, saw kerf, and end-trim allowance.
- **Four built-in presets:** Start from _Classic Segmented Bowl_, _Tall Flared Vase_, _Open-Segment Lantern Bowl_, or _Tapered Stave Vessel_.
- **2D cross-section & collision inspector:** Visualizes finished walls against rough rings/staves with color-coded diagnostics for ring-to-ring glue overlap (safe ≥ `0.25"`, tight warning, blow-through error) and stave sagitta / curve-bow stock thickness checks.
- **Per-ring & per-tier controls:** Adjust ring heights, segment/stave counts, rotation stagger, open gaps, and wood species patterns from an 8-species hardwood palette, plus bulk actions (`Fit Height`, `Stagger`).
- **Live 3D preview:** Interactive Three.js WebGL viewport with **Glue-Up** (individual mitered segments or staves with optional seams) and **Turned** (`LatheGeometry`) modes, a **180° Cutaway** toggle, and orbit/zoom controls.
- **Cut sheet & lumber planner:** Per-ring and per-tier cut tables (miter angle, blade bevel, miter gauge, SEL, strip width, and kerf-compensated strip length), wood species board-foot & estimated cost summary, CSV export, clipboard summary copy, and print support.
- **Shop Mode & 1:1 story-stick printout:** Tap-friendly build checklist (`Cut → Dry-Fit → Glued → Flattened`) paired with a true-scale (`1 SVG unit = 1 inch`) printable profile story stick with a `1" × 1"` calibration square and automatic multi-page tiling.
- **Dual units & themes:** Switch between `in (frac)` (1/32" fractions), `in (dec)`, and `mm`; toggle `system` / `light` / `dark` in the **Would? By Marty** warm workshop theme (Cream & Oak / Walnut).
- **Local persistence & portable JSON:** Auto-saves projects to `localStorage` (`segmentor.projects.v1`) with rename, duplicate, delete, and `.segmentor.json` export/import.
- **Installable offline PWA:** Installable via `vite-plugin-pwa` with Workbox precaching and runtime caching for Google Fonts.

## Stack

- **React 19** + **TypeScript 7** + **Vite 8**
- **Three.js** (`three`) for live 3D vessel preview + **Lucide** (`lucide-react`) for icons
- **Would? By Marty** warm workshop CSS design tokens (`src/styles.css`, `Chango`, `Fraunces`, `Montserrat`, `JetBrains Mono`)
- **Vitest 5** + **Testing Library** (`jsdom`) for geometry & UI verification
- **`vite-plugin-pwa` 2** (Workbox service worker & web app manifest)
- **`oxlint`** + **`oxfmt`** + **Husky** (`pre-push` hook)

## Getting Started

### Prerequisites

- Node.js 22+ (CI uses Node 22)
- npm

### Installation & Local Development

```bash
git clone https://github.com/mkokes/segmentor.git
cd segmentor
npm install
npm run dev
```

`npm install` also configures Husky git hooks via the `prepare` script.

### Available Scripts

| Command                | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                                             |
| `npm run build`        | Typecheck (`tsc --noEmit`) and build production bundle to `dist/`     |
| `npm run preview`      | Preview the production build locally                                  |
| `npm test`             | Run Vitest in watch mode                                              |
| `npm run test:run`     | Run all unit & component tests once                                   |
| `npm run typecheck`    | Run TypeScript compiler (`tsc --noEmit`)                              |
| `npm run lint`         | Run `oxlint`                                                          |
| `npm run lint:fix`     | Run `oxlint --fix`                                                    |
| `npm run format`       | Format files in place with `oxfmt`                                    |
| `npm run format:check` | Verify formatting with `oxfmt --check`                                |
| `npm run check`        | Run `format:check`, `lint`, `typecheck`, and `test:run` (pre-push/CI) |

`.husky/pre-push` runs `npm run check` before pushing.

## Project Structure

```text
segmentor/
├── .github/workflows/deploy.yml   # CI checks + GitHub Pages deployment
├── .husky/pre-push                # Runs `npm run check`
├── .oxfmtrc.json                  # Formatting rules (singleQuote, LF)
├── .oxlintrc.json                 # Lint rules (ts, react, oxc, unicorn, vitest)
├── public/                        # Favicons and PWA icons
├── src/
│   ├── components/
│   │   ├── common/ThemeToggle.tsx # 3-way system/light/dark theme switcher
│   │   ├── ProfileEditor.tsx      # Interactive Bezier profile & shop settings
│   │   ├── CrossSectionView.tsx   # 2D cross-section, diagnostics, ring/tier editor
│   │   ├── Vessel3DView.tsx       # Three.js 3D glue-up & turned preview
│   │   ├── CutSheetView.tsx       # Cut tables, species board-foot summary, CSV/print
│   │   └── ShopModeView.tsx       # Build checklist & 1:1 tiled story-stick printout
│   ├── data/
│   │   ├── presets.ts             # 4 built-in vessel presets
│   │   └── species.ts             # 8 default hardwood species
│   ├── geometry/
│   │   ├── closedRing.ts          # Closed-segment & kerf strip math
│   │   ├── openRing.ts            # Open-segment angles, gaps, overlap diagnostics
│   │   ├── stave.ts               # Compound bevel/miter, sagitta, curve-bow checks
│   │   ├── spline.ts              # Cubic Bezier sampling & inner-wall offset
│   │   ├── speciesSummary.ts      # Lumber linear & board-foot aggregation
│   │   ├── units.ts               # in <-> mm and fractional inch formatting
│   │   ├── vesselMetrics.ts       # Full vessel evaluation pipeline
│   │   └── __tests__/             # Vitest geometry test suites
│   ├── lib/theme.ts               # Theme persistence & meta theme-color sync
│   ├── state/useVesselStore.ts    # Multi-project state, localStorage, JSON I/O
│   ├── test/setup.ts              # Vitest jsdom setup
│   ├── types/vessel.ts            # Canonical project & geometry types
│   ├── styles.css                 # Would? By Marty tokens, grain & print CSS
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
└── PLAN.md
```

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages:

- **Pull requests to `main`**: run `format:check`, `lint`, `typecheck`, `test:run`, and `build`.
- **Pushes to `main`** (and `workflow_dispatch`): run the same checks and build with `VITE_BASE_PATH` from `actions/configure-pages`, then deploy `./dist` to https://segmentor.wouldbymarty.com/.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
