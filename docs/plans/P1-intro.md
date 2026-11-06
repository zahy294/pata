# P1: phone-first Pata intro

- **Goal:** a phone-first welcome led by a shiny Pata wordmark opens like a doorway into the existing home screen.
- **Files:** HomeIntro React component and scoped CSS, home-page wrapper, browser tests, and a scoped Hue design model in docs/design.
- **Direction:** user approved green/gold/cream and tap-to-enter doorway motion, then requested the bottom-right app icon as the app logo and wordmark-only intro with a liquid-chrome effect. Adapt the supplied React Native component interface to web React; its underlying implementation was not supplied. Use warm metallic gold instead of introducing copper orange into the brand. No animation packages or third-party runtime requests.
- **Tests first:** user confirmed browser seams: enter/keyboard access, reduced motion, once-per-session, storage failure recovery and direct courier-link bypass. One red/green slice at a time. Inspect mobile/desktop, short screens, focus and overflow.
- **Research read:** AGENTS.md, frontend role, P1 branching, Next static/PWA and Playwright research; Hue skill, hero-stage and the reference's public first panel/caption. Exact video motion was unavailable; this is the approved Pata interpretation.
- **Risks:** keep the intro on `/` only, never ahead of courier links or setup. A blocked sessionStorage must not strand entry. Native dialog protects focus; Escape and reduced motion must dismiss immediately. A transition completion fallback prevents animation from trapping the app. No server or chain changes; branch remains frontend-jeston and PR targets p1.
- **Result:** pending implementation and browser verification.
