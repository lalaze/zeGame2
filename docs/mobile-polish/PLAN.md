# Mobile polish plan

Base: joyful-sloth, eb4f1434079e226bbb3526892101d4eab7935dd0. Work on dot cloud checkout only. No commit, push, save-format or economy changes.

## Ordered stages and gates
1. Baseline: operate independent test cafés at 360, 390, 430 CSS px portrait; document blockers, mis-taps, reading and visual issues in that priority. Audit EN/中文, navigation, purchase/quantity, dialogs and furnishing. Record actual browser versus simulated coverage.
2. Operation and touch safety: fix reproduced blockers and target sizing, preserve ordinary list scroll/focus, ensure all primary controls reachable. Gate: focused regression tests plus repeated narrow-width UI operations.
3. Viewports and furnishing: safe-area/dynamic viewport, small-height dialogs/input, selection/place/move/store and illegal-position feedback; avoid conflicts with panning. Gate: UI checks and input/camera tests, with physical-touch and keyboard limitations explicit.
4. Reliability/performance: existing saves, refresh, background/resume, orientations; measure before optimizing. Gate: no save/economy regression and evidence-based findings.
5. Acceptance: full build/test, independent review, final real-browser EN/中文 loops including upgrades at each target width; screenshots and action records, unresolved limitations. Fix failed gates before proceeding.

## Acceptance
At each target width, create → stock → menu → open → close/settle → upgrade → reopen is reachable with no unintended horizontal scroll or obscured key actions. Primary controls have at least 44×44 CSS px hit boxes; dialogs scroll with reachable confirm/close, normal panel updates preserve browsing position; furniture controls give clear state and invalid-placement feedback. Warm pixel visual style, desktop/keyboard and established saves retained.

## Evidence discipline
Separate real cloud-browser UI actions, iframe viewport emulation, DOM/layout measurements, synthetic input/unit fixtures and actual mobile hardware. No touch or soft-keyboard claim from mouse/desktop evidence. Use isolated QA origins; never operate or reset user preview/storage. Keep screenshots free of user data.
