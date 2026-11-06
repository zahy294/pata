# P1: reveal from Enter Pata

- **Goal:** anchor the circular opening to the Enter Pata button so entry visually responds to the press; preserve the center-to-header wordmark flight.
- **Files:** HomeIntro, its existing browser entry regression, scoped Hue motion model and handoff research.
- **Tests first:** update the already approved browser entry seam to verify the aperture starts at the button center and reaches every viewport corner. Preserve the separate wordmark endpoint check and accessibility/session/fallback regressions.
- **Research read:** existing circular-reveal and wordmark-handoff notes; no new library or mechanism needed. Use measured button bounds so touch and keyboard share a consistent origin.
- **Risks:** the button is near the viewport bottom, so recalculate radius from that origin to the farthest corner. Do not move the wordmark's source or header target. No server/chain/deployment changes.
- **Result:** the circular reveal now starts at the measured Enter Pata button center for both touch and keyboard activation. Radius still clears every viewport corner. The central wordmark keeps its existing measured flight into the header. Its cream-to-ink change is centered on when the expanding opening reaches the traveling text; this timing is sampled once from the native easing curves without layout reads, preventing dark text from disappearing into the still-green surface.

The changed origin regression failed against the old center-origin reveal, then passed on phone/desktop. A contrast regression caught the prematurely dark wordmark, then passed with coordinated timing. All 46 intro/loader/navigation browser checks pass in Chrome desktop/phone emulation; 40 intro/navigation checks also pass against the production static export. Existing header endpoint, keyboard, reduced-motion, session, storage-failure and unsupported-animation checks pass.

Frame review at 390×844, 360×640 and 1440×900 verifies the button-led opening and legible wordmark, with no overflow. Local captures remain in `scripts/dev/pata-handoff-*.png`. `npm run check` passes app/server typechecking, 532 unit tests and one Foundry test. Static build, changed-file ESLint, formatting and design scan pass. No physical-device/funded-chain check or deployment. Work stays on `frontend-jeston`; PR targets `p1`.
