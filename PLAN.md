# Segmentor — Product & Engineering Specification (`PLAN.md`)

> Living specification for **Segmentor**, a shop-ready React + TypeScript PWA for designing closed-segment, open-segment, and stave woodturned bowls and vases.

---

## 1. Vision & Product Principles

### 1.1 One-Liner
Design a segmented or stave woodturned vessel visually—closed-ring, open-ring, or stave—verify wall safety and glue-joint overlap in 2D and 3D, and export a kerf-accurate cut sheet, shop checklist, and 1:1 printable story-stick template.

### 1.2 Target Users
- **Hobbyist & intermediate woodturners** moving beyond basic solid blanks into segmented bowls, hollow forms, and vases.
- **Shop-floor makers** on phones, tablets, or garage laptops who need offline-capable, touch-friendly tools instead of legacy Windows-only desktop programs.

### 1.3 Core Principles
1. **Math correctness first.** Every miter angle, bevel, segment edge length (SEL), radial width, overlap margin, and kerf-compensated strip length lives in a pure, unit-tested TypeScript geometry engine (`src/geometry/`).
2. **Prevent shop disasters before cutting.** Detect insufficient ring-to-ring overlap, thin walls, and excessive stave sagitta (chord thinning) live while dragging the profile.
3. **Shop-floor ergonomics.** High-contrast typography, persistent dark/light themes, large tap targets for Shop Mode, dual units (`in` decimal/fractional and `mm`), and offline PWA support.
4. **Ship small, iterate cleanly.** Phase 1 (Week 1 MVP) delivers the full end-to-end loop (profile → inspect → 3D preview → cut sheet → shop mode/print) locally with zero backend dependencies.

---

## 2. Vessel Modes & Exact Geometry Specification

All internal calculations operate in **canonical inches** (`number`), converted at UI boundaries for display (`in` decimal, `in` nearest 1/16" or 1/32" fraction, or `mm`).

### 2.1 Vessel Profile Coordinate System
- Vertical axis $y \in [0, H]$, where $y = 0$ is the lathe chuck/foot bottom and $y = H$ is the rim.
- Outer contour $R_{\text{outer}}(y)$ defined by a piecewise cubic Bezier spline (user-editable anchor points + tangent handles, with optional snap-to-grid).
- Inner contour $R_{\text{inner}}(y)$ derived automatically by offsetting $R_{\text{outer}}(y)$ inward along the curve normal by wall thickness $t_{\text{wall}}$ (with configurable floor thickness $t_{\text{base}}$ at $y = 0$), **or** independently editable for thick-walled/hollow forms.
- **Turning allowance ($\Delta$):** Extra radial stock added to both the inside ($\Delta_{\text{in}}$) and outside ($\Delta_{\text{out}}$) of every rough ring/stave so the glued blank encompasses the finished wall after truing on the lathe. Default: $\Delta_{\text{out}} = \Delta_{\text{in}} = 0.125"$ ($3.2\text{ mm}$).

---

### 2.2 Mode A: Closed-Segment Rings

The vessel height $H$ is partitioned into $M$ stacked horizontal rings $k = 1 \dots M$ (plus an optional solid base disk at $k = 0$).

Each ring $k$ occupies $[y_{k,\text{bot}}, y_{k,\text{top}}]$ with ring thickness $h_k = y_{k,\text{top}} - y_{k,\text{bot}}$ and segment count $N_k \ge 3$ (common presets: `8, 12, 16, 18, 24, 32, 36`).

#### Ring Envelope (Critical for Preventing Blow-Through)
Because the vessel profile curves across height $h_k$:
- Finished outer max radius on ring $k$: $R_{o,\text{fin}} = \max_{y \in [y_{k,\text{bot}}, y_{k,\text{top}}]} R_{\text{outer}}(y)$
- Finished inner min radius on ring $k$: $R_{i,\text{fin}} = \min_{y \in [y_{k,\text{bot}}, y_{k,\text{top}}]} R_{\text{inner}}(y)$
- Rough glue-up outer radius: $R_{o,k} = R_{o,\text{fin}} + \Delta_{\text{out}}$
- Rough glue-up inner radius (inscribed circle of inner polygon): $R_{i,k} = \max(0, R_{i,\text{fin}} - \Delta_{\text{in}})$

#### Segment Cut Formulas (Closed Ring)
Let half-sector angle $\theta_k = \frac{\pi}{N_k}$ (in degrees: $\theta_{m,k} = \frac{180^\circ}{N_k}$):
- **Miter angle (per end):** $\theta_{m,k} = \frac{180^\circ}{N_k}$
- **Circumscribed outer radius** (polygon vertices): $R_{o,\text{vert},k} = \frac{R_{o,k}}{\cos(\theta_k)}$
  - *Note:* Defining $R_{o,k}$ as the flat-to-flat *inscribed* outer radius ensures the flat face never dips inside the turning envelope, while the polygon corners protrude out to $R_{o,\text{vert},k}$.
- **Segment Edge Length (SEL, outer chord of trapezoid):**
  $$\text{SEL}_k = 2 \cdot R_{o,k} \cdot \tan(\theta_k)$$
- **Inner Edge Length (IEL, inner chord of trapezoid):**
  $$\text{IEL}_k = 2 \cdot R_{i,k} \cdot \tan(\theta_k)$$
- **Radial Strip Width ($W_k$, fence width on table saw):**
  $$W_k = R_{o,k} - R_{i,k}$$
  *(Exact perpendicular height of the trapezoid between outer face and inner face when both radii are measured to the flat faces.)*
- **Ring-to-Ring Glue Overlap Check:**
  Between adjacent rings $k$ and $k+1$, the radial glue contact width is:
  $$\text{Overlap}_{k,k+1} = \min(R_{o,k}, R_{o,k+1}) - \max(R_{i,k}, R_{i,k+1})$$
  - **Safe:** $\text{Overlap} \ge 0.25"$ ($6\text{ mm}$)
  - **Warning:** $0 < \text{Overlap} < 0.25"$ (risky glue joint; increase turning allowance, reduce ring height $h_k$, or add radial width)
  - **Error (Gap / Blow-through):** $\text{Overlap} \le 0$ (rings do not physically overlap; impossible to turn safely)

#### Strip Length & Saw Kerf Compensation
When cutting $N_k$ trapezoidal segments by flipping the strip $180^\circ$ after each cut on a miter sled (kerf $K$, miter angle $\theta_k$):
- Kerf advance along the strip axis per cut: $K_{\text{axial}} = \frac{K}{\cos(\theta_k)}$
- Average trapezoid pitch along the strip: $P_k = \frac{\text{SEL}_k + \text{IEL}_k}{2}$
- **Minimum linear strip length** (including $N_k + 1$ cuts + configurable end-trim allowance $E_{\text{trim}}$, default $1.0"$):
  $$L_{\text{strip},k} = N_k \cdot P_k + (N_k + 1) \cdot \frac{K}{\cos(\theta_k)} + E_{\text{trim}}$$
- When a ring uses multiple species (e.g., alternating maple/walnut), split segment count per species ($N_{k,s}$) and compute per-species strip length identically with $N_{k,s} + 1$ cuts.

---

### 2.3 Mode B: Open-Segment Rings

Open-segment rings leave intentional radial gaps between adjacent segments around the ring.

#### Parameters per Ring
- Segment count $N_k$
- **Gap specification** (user picks one; the other derives live):
  - **Gap angle $\alpha_g$** (degrees per gap, e.g., $4^\circ$–$12^\circ$), OR
  - **Open percentage $p_{\text{open}} \in (0\%, 70\%)$** where $\alpha_g = \frac{360^\circ}{N_k} \cdot p_{\text{open}}$
- Segment angular sweep: $\alpha_s = \frac{360^\circ}{N_k} - \alpha_g$
- Half-segment angle: $\theta_{s,k} = \frac{\alpha_s}{2}$ (radians: $\frac{\pi}{180}\cdot\frac{\alpha_s}{2}$)

#### Cut & Jig Formulas (Open Ring)
- **Miter angle (per end of segment):** $\theta_{m,k} = \frac{\alpha_s}{2} = \frac{180^\circ}{N_k} - \frac{\alpha_g}{2}$
- **Outer Segment Length (SEL):** $\text{SEL}_k = 2 \cdot R_{o,k} \cdot \tan(\theta_{s,k})$
- **Inner Segment Length (IEL):** $\text{IEL}_k = 2 \cdot R_{i,k} \cdot \tan(\theta_{s,k})$
- **Radial Strip Width:** $W_k = R_{o,k} - R_{i,k}$
- **Gap Width (straight-line clearance between segment corners):**
  - At inner radius: $G_{\text{in},k} \approx 2 R_{i,k} \sin(\alpha_g / 2)$
  - At outer radius: $G_{\text{out},k} \approx 2 R_{o,k} \sin(\alpha_g / 2)$
- **Indexing Jig Angle:** $\theta_{\text{index},k} = \frac{360^\circ}{N_k}$ (for rotary/pin indexing plate setup).
- **Glue Surface Warning:** Since open segments only bond to the ring below/above (not side-to-side), flag a warning if vertical overlap between staggered open segments drops below $40\%$ of segment footprint area.

---

### 2.4 Mode C: Stave Vessels (Vertical & Compound-Tilted Staves)

Stave vessels are formed by $N$ long staves arranged around the axis, either as a **single frustum/barrel** or **stacked multi-tier stave sections** that follow a curved vase profile.

#### Parameters per Stave Tier
- Stave count $N \ge 3$ (half-sector $\theta = \frac{\pi}{N}$)
- Tier bottom height $y_{\text{bot}}$, top height $y_{\text{top}}$, tier length along slope $L_{\text{stave}}$
- Outer radius at bottom $R_{o,\text{bot}}$, at top $R_{o,\text{top}}$
- **Slope / Tilt Angle $\phi$ from vertical:**
  $$\phi = \arctan\!\left(\frac{R_{o,\text{top}} - R_{o,\text{bot}}}{y_{\text{top}} - y_{\text{bot}}}\right)$$
  *(Note: $\phi = 0^\circ$ is a vertical cylinder; $\phi > 0^\circ$ flares outward toward the rim; $\phi < 0^\circ$ tapers inward.)*

#### Compound Angle Formulas (Verified from Dihedral Geometry)
For a regular $N$-sided polygonal frustum tilted at angle $\phi$ from vertical:
- **Table Saw Blade Bevel Angle ($\beta$, tilt from $90^\circ$ vertical):**
  $$\beta = \arcsin\!\big(\cos(\phi) \cdot \sin(\theta)\big)$$
- **Table Saw Miter Gauge Angle ($\gamma$, angle from $90^\circ$ perpendicular):**
  $$\gamma = \arctan\!\big(\sin(|\phi|) \cdot \tan(\theta)\big)$$
  - *Boundary checks:*
    - Vertical cylinder ($\phi = 0^\circ$): $\beta = \frac{180^\circ}{N}$, $\gamma = 0^\circ$ (pure rip bevel).
    - Flat horizontal ring ($\phi = 90^\circ$): $\beta = 0^\circ$, $\gamma = \frac{180^\circ}{N}$ (pure flat miter).

#### Stave Sizing & Curve-Sagitta Check
- **Outer stave width** at bottom/top:
  $$w_{\text{bot}} = 2 R_{o,\text{bot}} \tan(\theta), \qquad w_{\text{top}} = 2 R_{o,\text{top}} \tan(\theta)$$
- **Required Stock Thickness ($T_{\text{stave}}$):**
  Must accommodate wall thickness $t_{\text{wall}}$, turning allowances $\Delta_{\text{out}} + \Delta_{\text{in}}$, polygonal corner drop (sagitta $s = R_o(\sec\theta - 1)$), AND any **curved profile bulge** $b_{\max}$ where the vessel profile bows outside/inside the straight chord between $(y_{\text{bot}}, R_{\text{bot}})$ and $(y_{\text{top}}, R_{\text{top}})$:
  $$T_{\text{min}} = t_{\text{wall}} + \Delta_{\text{out}} + \Delta_{\text{in}} + \text{profile\_bow}_{\max} + R_{o,\max}(\sec\theta - 1)$$
  - **Error if $T_{\text{stock}} < T_{\text{min}}$:** Highlight the exact height $y$ where the stave will run thin or expose a gap during turning.

---

## 3. Data Model & Persistence

### 3.1 Core TypeScript Interfaces (`src/types/vessel.ts`)

```ts
export type UnitSystem = 'in' | 'mm';
export type FractionPrecision = 16 | 32 | 64;
export type VesselMode = 'closed' | 'open' | 'stave';

export interface ProfilePoint {
  id: string;
  r: number;        // radius in canonical inches
  y: number;        // height from base in canonical inches
  handleIn: { dr: number; dy: number };
  handleOut: { dr: number; dy: number };
}

export interface WoodSpecies {
  id: string;
  name: string;
  colorHex: string;         // display/3D base color
  secondaryHex: string;     // subtle grain accent
  costPerBoardFoot?: number;
}

export interface RingConfig {
  id: string;
  index: number;            // 0 = base disk, 1..M = rings
  isBaseDisk: boolean;
  height: number;           // inches
  segments: number;         // N
  mode: 'closed' | 'open';  // per-ring override supported
  gapDegrees: number;       // used when mode === 'open'
  rotationOffsetDeg: number;// half-segment brick stagger by default: 180 / N
  speciesPattern: string[]; // array of WoodSpecies.id cycled around the ring
}

export interface StaveTierConfig {
  id: string;
  index: number;
  yBottom: number;
  yTop: number;
  staveCount: number;
  stockThickness: number;   // actual milled lumber thickness
  speciesPattern: string[];
}

export interface ShopSettings {
  unit: UnitSystem;
  fractionPrecision: FractionPrecision;
  sawKerf: number;          // e.g. 0.125" (1/8") or 0.094" (3/32" thin-kerf)
  endTrimAllowance: number; // default 1.0" per strip
  turningAllowanceOut: number;
  turningAllowanceIn: number;
  wallThickness: number;
  baseThickness: number;
}

export interface RingProgress {
  cut: boolean;
  dryFit: boolean;
  glued: boolean;
  flattened: boolean;
  notes?: string;
}

export interface VesselProject {
  schemaVersion: 1;
  id: string;
  name: string;
  updatedAt: string;
  mode: VesselMode;
  profilePoints: ProfilePoint[];
  settings: ShopSettings;
  speciesLibrary: WoodSpecies[];
  rings: RingConfig[];
  staveTiers: StaveTierConfig[];
  progress: Record<string, RingProgress>; // keyed by RingConfig.id or StaveTierConfig.id
}
```

### 3.2 Persistence & Portability
- **Auto-save:** Debounced write to `localStorage` (`segmentor.projects.v1` + `segmentor.activeProjectId`).
- **Project switcher:** Create new from preset, duplicate, rename, delete.
- **Portable JSON:** Export/import `.segmentor.json` files with strict schema validation and migration hooks (`schemaVersion`).

---

## 4. Application Architecture & 5 Core Views

Navigation uses a compact, mobile-friendly top/bottom bar so all 5 workspace views are one thumb-tap away on a phone or tablet in the shop:

1. **`Profile` — Vessel Profile & Setup**
   - Interactive SVG spline canvas with drag handles (touch-friendly hit targets $\ge 36\text{px}$), numeric coordinate popover, symmetry centerline, and live overall dimensions (`H`, max `OD`, wall thickness).
   - Vessel mode selector (`Closed Ring`, `Open Ring`, `Stave`) + preset picker (`Classic Salad Bowl`, `Tall Flared Vase`, `Hollow Calabash`, `Open-Segment Lamp Shade`, `Stave Planter/Urn`).
   - Quick global settings drawer: units (`in` decimal / fraction / `mm`), wall thickness, turning allowance, saw kerf.

2. **`Rings / Staves` — 2D Cross-Section & Collision Inspector**
   - Left/Right split on desktop, stacked on mobile:
     - **2D Cross-Section SVG:** Shows finished inner/outer curve overlaid against rough stepped rings (or stave chord envelope).
     - **Color-coded safety overlays:** Green/neutral = safe overlap, Amber = tight overlap ($< 0.25"$), Red = gap/blow-through risk.
   - **Ring / Tier Inspector Panel:** Tap any ring on the diagram to edit its height, segment count, rotation offset (brick stagger), open-gap angle, and species pattern (solid, alternating AB, ABAC, or manual tap-to-paint).
   - Quick bulk actions: "Add Ring", "Split Ring", "Distribute Heights Evenly", "Apply Alternating Stagger".

3. **`3D Preview` — Interactive Lathe & Glue-Up Viewer**
   - Built with **Three.js** (direct canvas component or `@react-three/fiber`):
     - **Glue-Up View:** Individual beveled/mitered trapezoidal segments or staves rendered with subtle seam lines and accurate open-segment air gaps.
     - **Turned View:** Smooth `LatheGeometry` profile clipped/mapped to species bands so turners see the finished bowl/vase proportions.
     - **Cutaway Toggle:** 180° half-section cutaway in 3D to inspect interior wall thickness and ring step alignment.
   - Orbit/pinch-to-zoom controls + ambient/key light presets.

4. **`Cut Sheet` — Miter/Bevel Table & Stock Planner**
   - **Per-Ring / Per-Tier Cut Table:**
     - Closed/Open: Ring #, Height, Segments ($N$), Miter Angle ($\theta_m$), Gap Angle (if open), Outer Width/SEL, Inner Width/IEL, Board Width ($W$), Linear Strip Length (with kerf).
     - Staves: Tier #, Height/Length, Stave Count, Tilt ($\phi$), **Blade Bevel ($\beta$)**, **Miter Gauge ($\gamma$)**, Bottom/Top Stave Width, Required Stock Thickness.
   - **Wood Species Summary Card:** Total board-feet & linear strip lengths grouped by species and board width/thickness so you know exactly what to mill.
   - **Exports:** Download CSV cut sheet, copy summary to clipboard, or trigger print-friendly cut sheet.

5. **`Shop Mode` — Build Checklist & 1:1 Story-Stick Printout**
   - **Step-by-Step Ring/Tier Tracker:** Large tap-friendly cards showing one ring at a time (`Cut → Dry-Fit → Glued → Flattened`) with big, glanceable numbers (`16 segs · 11.25° · SEL 2.148" · Strip 1.375" wide`).
   - **1:1 Printable Story Stick (SVG Print Engine):**
     - Renders the true-scale (`1 SVG unit = 1 inch`) vertical profile + ring elevation tick marks + ring numbers + 1"×1" / 25.4mm calibration square.
     - Automatically **tiles across US Letter / A4 pages** with registration crosshairs when $H$ exceeds one page, reusing the print CSS & calibration conventions from `Fretomaton`.

---

## 5. Design System & Styling

- Follows `styleguide/` (vendored unchanged from `mkokes/mk-styleguide`) + Tailwind CSS v4 + DaisyUI 5 (`mk` theme).
- **Color rules:**
  - Semantic tokens only (`bg-bg`, `bg-surface`, `text-text`, `text-text-muted`, `border-border`, `text-link`, `bg-primary`, `text-on-primary`, `text-warning`, `text-danger`, `text-success`).
  - Never use `text-primary` on light backgrounds; use `text-link`.
  - Respect `<html data-theme="light|dark">` with OS preference fallback.
  - `@media print` forces light mode (`#ffffff` paper, high-contrast black lines) regardless of active UI theme.
- **Typography:** Poppins for headings, Inter for UI copy, **JetBrains Mono** (`tabular-nums`) for all angles, lengths, fractions, and cut tables.

---

## 6. Repository Structure & Tooling

```text
segmentor/
├── .github/workflows/deploy.yml   # CI check + GitHub Pages deploy
├── .husky/pre-push                # Runs `npm run check`
├── .oxfmtrc.json                  # Formatting rules (singleQuote, semicolons, LF)
├── .oxlintrc.json                 # Lint rules (ts, react, oxc, unicorn, vitest)
├── styleguide/                    # Vendored mk-styleguide (do not edit directly)
├── public/                        # PWA icons & manifest assets
├── src/
│   ├── geometry/
│   │   ├── units.ts               # in <-> mm, decimal <-> nearest fraction formatter
│   │   ├── spline.ts              # Bezier profile sampling, normals, inner-wall offset
│   │   ├── closedRing.ts          # Closed-segment formulas, overlap check, kerf strip math
│   │   ├── openRing.ts            # Open-segment angles, gaps, indexing, overlap check
│   │   ├── stave.ts               # Compound bevel/miter, sagitta, curve-bow checks
│   │   ├── speciesSummary.ts      # Lumber totals & board-foot aggregation
│   │   └── __tests__/             # Comprehensive Vitest suites for all geometry
│   ├── data/
│   │   ├── presets.ts             # Built-in bowl, vase, open-segment, stave presets
│   │   └── species.ts             # Default hardwood species palette (Walnut, Maple, Cherry...)
│   ├── types/
│   │   └── vessel.ts              # Canonical project & geometry types
│   ├── state/
│   │   └── useVesselStore.ts      # Project state, localStorage persistence, JSON import/export
│   ├── components/
│   │   ├── ProfileEditor.tsx      # View 1: Interactive Bezier profile editor
│   │   ├── CrossSectionView.tsx   # View 2: 2D rings/staves + overlap inspector
│   │   ├── Vessel3DView.tsx       # View 3: Three.js 3D glue-up & turned preview
│   │   ├── CutSheetView.tsx       # View 4: Cut tables, species summary, CSV export
│   │   ├── ShopModeView.tsx       # View 5: Ring checklist + 1:1 tiled story-stick print
│   │   └── common/                # UnitBadge, ThemeToggle, ProjectMenu, Tooltip
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── PLAN.md
├── AGENTS.md
└── README.md
```

### Quality Gates (`npm run check`)
1. `npm run format:check` (`oxfmt`)
2. `npm run lint` (`oxlint`, 0 errors)
3. `npm run typecheck` (`tsc -b`)
4. `npm run test:run` (`vitest`, including mathematical identity & boundary tests)
5. `npm run build` (`vite build` + PWA asset generation)

---

## 7. Phased Build Plan

### Phase 1 — Week 1 MVP (End-to-End Core Loop)

- **M1: Project Bootstrap & Math Kernel**
  - Scaffold Vite + React 19 + TS + Tailwind v4 + DaisyUI 5 + `mk-styleguide` + PWA + Vitest + oxlint/oxfmt.
  - Implement `units.ts`, `spline.ts`, `closedRing.ts`, `openRing.ts`, `stave.ts`, `speciesSummary.ts` with 100% unit test coverage on boundary cases ($\phi = 0^\circ$, $\phi = 90^\circ$, open-segment gap limits, zero/negative overlap detection, kerf flip-cut verification).
- **M2: State, Presets & Profile Editor (View 1)**
  - Implement `useVesselStore.ts` (`localStorage` auto-save + `.segmentor.json` export/import).
  - Build built-in presets (Classic Closed Bowl, Flared Vase, Open-Segment Bowl, Tapered Stave Vessel).
  - Build interactive SVG Bezier profile editor with touch/mouse drag points, wall thickness, turning allowance, and unit switcher.
- **M3: 2D Ring/Stave Inspector & Collision Warnings (View 2)**
  - Interactive 2D cross-section displaying finished curves, rough rings/staves, and green/amber/red overlap diagnostics.
  - Per-ring / per-tier controls (height, segment count, gap angle, species pattern, brick stagger).
- **M4: Live 3D Vessel Preview (View 3)**
  - Three.js viewport rendering individual mitered/beveled segments (closed, open with real gaps, and tilted staves) + turned smooth mode + 180° cutaway toggle.
- **M5: Cut Sheet, Species Totals & Shop Mode + 1:1 Print (Views 4 & 5)**
  - Complete cut sheet tables + CSV export + hardwood linear/board-foot summary.
  - Shop Mode ring-by-ring checklist (`Cut → Dry-fit → Glued → Flattened`).
  - 1:1 printable SVG Story Stick with calibration square & multi-page tiling.
- **M6: QA, Responsive Polish & GitHub Pages Deploy**
  - Dogfood on mobile viewport + desktop; verify print scaling; configure `.github/workflows/deploy.yml` and push live.

### Phase 2 — Patterning & Advanced Shop Tools (Post-MVP)
- **Feature-Ring & Pattern Designer:** Visual per-segment painter for spirals, chevrons, diamonds, and zig-zag wraps across rings.
- **Compound Lamination Planner:** Strip-lamination calculator for woven/Celtic-knot/tumbling-block feature rings.
- **Stock Bin-Packing Optimizer:** Map required strips onto actual rough-lumber board lengths you have on hand.
- **1:1 Wedgie-Sled Templates:** Printable angle wedges for common segment counts ($8, 12, 16, 18, 24, 36$).

### Phase 3 — Ecosystem & Sharing
- Custom wood species library with procedural wood-grain textures in 3D view.
- Shareable URL-encoded vessel links (`#project=...`) for sharing designs in forums/clubs.
- Optional DXF/SVG export for laser-cut open-segment indexing plates and story sticks.
