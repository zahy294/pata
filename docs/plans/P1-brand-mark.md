# P1: Pata brand mark preview

- **Goal:** preview the reference's gold pin-and-lock wordmark in the current cream/green app.
- **Files:** a local SVG mark in public, the shared app header and browser icon metadata.
- **Validation:** visual-only change; inspect mobile and desktop screenshots, run check and the static build. No behavior changes or implementation-mirroring tests.
- **Research read:** frontend role, AGENTS.md, P1 branching rules and Impeccable refinement guidance.
- **Risks:** the supplied reference is a raster sheet; reproduce the chosen silhouette as an SVG, not an exact source asset. Work stays on frontend-jeston as requested; PRs target p1. Existing flows and copy stay intact.
- **Result:** gold pin/P/lock SVG added beside the existing Pata wordmark, with the same asset as the favicon. Existing green, cream and gold colors are preserved. Static build passes; local Chrome verified mobile (414px) and desktop (1440px) renders, loaded artwork, no horizontal overflow and keyboard focus on the home link. Mechanical design scan returned no findings. Screenshots are local at scripts/dev/pata-logo-mobile.png and pata-logo-desktop.png. No flow behavior changed.
