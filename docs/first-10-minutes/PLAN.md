# First ten minutes

## Goal and boundaries
A new café, played in the foreground at 1×, can stock ingredients, prepare its menu, open, observe service, close and settle, then reopen within ten minutes using only in-game guidance. Preserve voluntary opening/closing, background pause, cozy pixel art, economy and old saves. English and Chinese, desktop and a 390px viewport. No commits or pushes in this task.

## Stages and gates
1. **Baseline:** run the current UI on a separate origin/test save, record real interactions and rank friction. Never touch the user's existing café. Establish screenshots and timing.
2. **Guided loop:** contextual, skippable and replayable guidance; progressively introduce management; explain ingredients/menu/baking/shop state at relevant moments. Unit/integration checks before proceeding.
3. **Useful feedback:** actionable stock/customer-loss/profit explanations and situation-aware next steps at settlement. Verify bad states and repeat/interrupted flows.
4. **Acceptance:** real browser walkthroughs in English/Chinese on desktop/390px; foreground 1× complete loop under ten minutes, screenshots, actual timing. Run full tests and production build after final edits. Record uncovered scenarios candidly.

## Evidence standard
Browser-driven agent walkthroughs are not human novice testing. Tests/simulations supplement rather than replace UI interaction. Record viewport, language, speed, wall-clock duration, shop elapsed time, actions and evidence paths. If browser execution is blocked, document exact blocker and recovery path; do not claim a UI pass.

## Independent-review repair gate
Correct settlement cause attribution with actual seeded Sim regression, persist completed guide across later services/reload, and reproduce/repair keyboard scrolling using the real cloud browser. Rerun full tests/build and affected UI, then independent read-only review before refreshing delivery evidence.
