# P1: spacious phone and laptop layout

- **Goal:** replace the phone-only frame with a responsive site, keep consistent content gutters and restrained headings, and simplify the intro to the Pata wordmark, Your door / Your say, logo top-left and Hindi top-right.
- **Files:** shared shell/styles, intro React/CSS and scoped Hue model; setup direction-stage layout where parallel panels can use desktop columns.
- **Validation:** existing agreed intro/loader browser seams, one intro content regression first, production screenshots at phone/compact/laptop widths, check and static build. Pure spacing changes do not need implementation-mirroring tests.
- **Research read:** AGENTS.md, frontend role and P1 branching; existing Hue model and component research. Apply the user's explicit spacing and copy corrections within the current palette.
- **Risks:** preserve loading/flow behavior and small-screen order; avoid stretching readable copy and controls across a laptop. Keep native dialog focus, once-per-session and reduced-motion behavior intact.
- **Result:** shared 1120px website shell replaces the narrow phone frame. Pages have 20–48px gutters, bounded 22–28px headings and more card spacing. Home/lookup use laptop columns; setup directions place code/audio in parallel, while phones retain stacked order. New setup steps return to the top. Intro has a smaller plain wordmark, app icon top-left, Hindi top-right, Your door / Your say, and the enter control; all secondary intro wording was removed.

Validation: 26 intro/loader browser checks pass across desktop/phone. Check passes app/server typechecking, 532 unit tests and one Foundry test; static export succeeds. Changed intro/layout/test TypeScript passes ESLint, and the design scan reports no findings. Existing wider-page lint limitations remain as noted in P1-intro.md.

Two capture rounds verified 390×844, 360×640 and 1440×900. No horizontal overflow; phone content starts at x=20. Laptop main is 1120px wide, with code/audio panels sharing the same y position. The real setup screen was reached through normal controls with isolated synthetic extraction/ranking responses and a pending directions response; no live AI requests, speech calls or chain writes. Captures: scripts/dev/pata-spacious-intro-*.png, pata-spacious-home-*.png and pata-spacious-directions-*.png. Local preview remains on port 3000.
