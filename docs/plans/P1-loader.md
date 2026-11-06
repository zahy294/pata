# P1: morphing location loader

- **Goal:** replace ordinary loading spinners across the app, including green buttons, with a compact morphing indicator that uses the supplied location pin instead of a heart.
- **Files:** shared web MorphLoader and namespaced CSS, local pin asset, existing frontend loading states, browser tests and research note.
- **Tests first:** user confirmed browser seams: observable shape cycle and location icon, still reduced-motion state, real green loading button with unchanged pending text and disabled behavior. Test external network/storage/time boundaries; no private helper tests.
- **Research read:** Hue, frontend role, P1 rules, Playwright and frontend-intro-components.md. The native snippet supplies usage but no implementation; create a lightweight web equivalent with the same requested shapes and no native dependencies.
- **Risks:** 120px is appropriate for a showcase, not a button; use 20–24px in controls and retain loading text. Pause on hidden tabs, respect reduced motion and avoid live-announcing each shape. The location PNG is user-supplied; preserve it locally and tint its alpha mask to the existing foreground color. Recording pulses indicate recording, not loading, and remain intact.
- **Result:** pending implementation and visual/browser checks.
