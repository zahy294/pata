# P1: page transitions

- **Goal:** add the approved roughly 300 ms page reveal in Pata's green, cream and gold theme on phones and laptops; keep the header stationary and reduced-motion navigation instant.
- **Files:** a persistent client component in the shared layout, namespaced CSS, browser navigation tests, scoped Hue motion tokens and research notes.
- **Tests first:** user-approved browser seam: internal links reveal the arriving page; direct loads and courier fragments retain their normal behavior; rapid navigation never blocks interaction; Back/Forward works; reduced motion disables the effect. One red/green slice at a time.
- **Research read:** `docs/research/page-transitions.md`, `frontend-intro-components.md`, local Next usePathname/template/view-transition docs, Hue and the existing `docs/design/pata-intro.yaml` model.
- **Design:** short upward settle and fading green/gold door-jamb accent; no full-screen curtain, loading indicator or departing-page snapshot. Preserve the existing intro separately.
- **Risks:** no copied Pro/library components or new dependency. Keep the wrapper unkeyed, leave links/history/focus/scroll to Next, observe only pathname, cancel prior animations, and retain visible content without animation support. Inspect fixed descendants before choosing the animated region. Physical-phone/mobile-data and funded end-to-end checks remain owner verification; this change does not alter chain or server flows.
- **Result:** pending implementation and browser/static-export checks. Work stays on `frontend-jeston`; PR targets `p1`. No deployment.
