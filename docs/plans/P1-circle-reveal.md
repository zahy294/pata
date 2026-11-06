# P1: circular intro reveal

- **Goal:** keep the approved wordmark-to-header handoff; replace segmented green pieces with one smooth circular opening that reaches every viewport corner.
- **Files:** HomeIntro React/CSS, existing intro browser test, scoped Hue model and handoff research/results.
- **Tests first:** at the already approved browser entry seam, strengthen the transition test to verify a circular aperture starts at the original wordmark center, grows, and clears the farthest corner before entry completes. Retain keyboard, session, reduced-motion, fallback and endpoint-alignment checks.
- **Research read:** existing `wordmark-handoff.md` primary-source masking recommendation; preserve the incumbent Hue palette and motion timing. SVG luminance mask: white keeps green, black circle removes it. No new research or library needed.
- **Risks:** use viewport/user coordinates and a radius to the farthest corner; keep the moving wordmark outside the mask. Preserve cancellation and reduced-motion handling. No server, chain or deployment changes.
- **Result:** pending verification. Work on `frontend-jeston`; PR into `p1`.
