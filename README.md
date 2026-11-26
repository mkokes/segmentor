# Segmentor

A browser-first, offline-capable PWA studio for designing **closed-segment**, **open-segment**, and **stave** woodturned bowls and vases—turning any drawn vessel profile into a kerf-accurate, collision-checked cut sheet and 1:1 printable shop template.

See [PLAN.md](PLAN.md) for the complete specification, geometry math, data model, UI architecture, and phased build plan.

## Stack

- React 19 + TypeScript + Vite
- **Would? By Marty** warm workshop theme (Cream & Oak light / Walnut dark, `Chango` + `Fraunces` + `Montserrat` + `JetBrains Mono`)
- Three.js (live 3D vessel preview)
- Vitest (geometry & unit verification)
- `vite-plugin-pwa` (installable offline shop app)
- `oxlint` + `oxfmt` + Husky

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
