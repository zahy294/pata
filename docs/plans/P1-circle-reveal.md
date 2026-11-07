# P1: circular intro reveal

- **Goal:** keep the approved wordmark-to-header handoff; replace segmented green pieces with one smooth circular opening that reaches every viewport corner.
- **Files:** HomeIntro React/CSS, existing intro browser test, scoped Hue model and handoff research/results.
- **Tests first:** at the already approved browser entry seam, strengthen the transition test to verify a circular aperture starts at the original wordmark center, grows, and clears the farthest corner before entry completes. Retain keyboard, session, reduced-motion, fallback and endpoint-alignment checks.
- **Research read:** existing `wordmark-handoff.md` primary-source masking recommendation; preserve the incumbent Hue palette and motion timing. SVG luminance mask: white keeps green, black circle removes it. No new research or library needed.
- **Risks:** use viewport/user coordinates and a radius to the farthest corner; keep the moving wordmark outside the mask. Preserve cancellation and reduced-motion handling. No server, chain or deployment changes.
- **Result:** removed all segmented surfaces and their staggered movements. One SVG luminance mask now opens a smooth circle from the source wordmark center over 820 ms, with its radius reaching beyond the farthest viewport corner. The approved 900 ms wordmark flight, header handoff, peripheral exits and cancellation behavior remain intact.

The circular-entry browser regression failed against the segmented version, then passed for center alignment, growth and clearance of all four corners. All 46 intro/loader/navigation checks pass on desktop and phone Chrome emulation; all 40 intro/navigation checks also pass against the production static export. Stabilized the existing reduced-motion route test by pausing its brief animation inside the browser before runner latency can miss it under parallel load; no route behavior changed.

Visual frame captures at 390×844, 360×640 and 1440×900 confirm a single round opening and no horizontal overflow (`scripts/dev/pata-handoff-*.png`, local only). `npm run check` passes app/server typechecking, 532 unit tests and one Foundry test. Static build, changed-file ESLint and the design detector pass. No physical-device/funded-chain check, dependencies or deployment. Work stays on `frontend-jeston`; PR targets `p1`.
