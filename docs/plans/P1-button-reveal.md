# P1: reveal from Enter Pata

- **Goal:** anchor the circular opening to the Enter Pata button so entry visually responds to the press; preserve the center-to-header wordmark flight.
- **Files:** HomeIntro, its existing browser entry regression, scoped Hue motion model and handoff research.
- **Tests first:** update the already approved browser entry seam to verify the aperture starts at the button center and reaches every viewport corner. Preserve the separate wordmark endpoint check and accessibility/session/fallback regressions.
- **Research read:** existing circular-reveal and wordmark-handoff notes; no new library or mechanism needed. Use measured button bounds so touch and keyboard share a consistent origin.
- **Risks:** the button is near the viewport bottom, so recalculate radius from that origin to the farthest corner. Do not move the wordmark's source or header target. No server/chain/deployment changes.
- **Result:** pending validation. Branch `frontend-jeston`; PR into `p1`.
