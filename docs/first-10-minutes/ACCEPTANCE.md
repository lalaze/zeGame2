# First-ten-minutes acceptance

## Latest verification — 2026-10-12 03:03 UTC
After independent-review repairs: **583 passed, 6 existing skips, 55 suites**; build, TypeScript and diff checks pass. Independent reviewer independently confirmed the same full-suite result and original seeded Sim reproduction. Keyboard-scroll and completion-card browser regressions are detailed below. Earlier 575-test sections are historical pre-review gates.

## What changed
- Six contextual steps introduce starter inventory, menu, automatic service, voluntary closing, settlement and reopening. The guide is skippable; Settings reopens a complete reference. Existing café saves do not get forced into an introductory UI.
- First-loop management shows Menu/Pantry first. All tools are one explicit action away and return automatically after reopening. This is presentation only, not a new unlock or purchase restriction.
- Preparation explains selected dishes and per-drink ingredients. Baking quantities/shelf waste appear when baking becomes relevant. Forecast/reputation detail is expandable; empty menus and limited stock have actionable text.
- Settlement leads with served/revenue/consumed costs/profit, actual loss reasons and a feasible next step. Completed rewards are linked to their existing claim action. All prior report detail remains available.
- EN/中文 copy, focus preservation, scrollable dialog bodies with reachable actions, and a phone toast-overlap correction.

## Method and limits
These are **agent-operated real browser walkthroughs, not human novice testing**. All actions were UI clicks/keyboard input. No test run altered a game clock, injected a save, changed speed from 1×, or used a debug win path. Initial inventory is 50 free beans and $0, so the first stocking step is inspection/confirmation; later EN runs actually bought replacement beans. No README was needed to choose the in-game sequence.

Each café had an independent test origin; the user's existing preview origin and real save were not reset, purchased against or advanced. 5181 was created on the baseline build; 5182–5185 were new acceptance cafés. A final English regression used localhost:5182 as another distinct origin.

Desktop viewport was 1180×757 CSS px. Phone-width runs used a real 390×844 iframe viewport in Chromium, not a physical phone or mobile Safari. An additional 390×720 run verified pointer access to Settings/help without outer test-container scrolling. Pixel screenshots preserve the surrounding harness so its nature is visible.

Wall-clock duration includes creation, reading, tool round trips and verification. The reported day clock is **effective 1× simulated service time**, including accepted-order completion; it is not the whole foreground interaction duration. We did not instrument every browser visibility transition, so an exact separate foreground-wall-clock figure is not claimed. Tool-managed tabs are unsuitable for the background-pause check; that check was repeated successfully through a native visible Chromium tab, below.

## Complete-loop matrix (UTC; recorded browser-runtime clock)
| Run | Start → reopened | Wall clock | Effective first-day service | Result |
|---|---|---:|---:|---|
| English desktop | 02:17:40.277 → 02:19:42.669 | 122.392 s | close requested at 0:37; immediate settlement | 8 guests, $36 revenue, $8 ingredients, +$28; reward claimed and 10 beans bought |
| 中文 desktop | 02:21:16.170 → 02:22:44.262 | 88.092 s | 0:44 settlement | 8 guests, $24 revenue, $8 ingredients, +$16; reward claimed |
| English 390×844 | 02:22:55.177 → 02:24:48.700 | 113.523 s | 0:46 settlement | 9 guests, $27 revenue, $9 ingredients, +$18; missing 1 bean bought in preparation |
| 中文 390×844 | 02:25:09.085 → 02:27:35.614 | 146.529 s | 0:48 settlement | 8 guests, $24 revenue, $8 ingredients, +$16; skip → Settings help → normal close/reopen |
| English desktop final repeat | 02:32:09.056 → 02:35:21.613 | 192.557 s | 1:56 settlement | Empty-menu recovery, live reload at 0:43, 23 guests, +$46; 15 beans bought and reopened |

The first English desktop run preceded final copy/ARIA and toast-placement fixes; final English repeat/regression is recorded in logs/ui-runs.json and the final supplement below. The Chinese phone run used the toast correction. All four full loops met the ten-minute threshold; this is an informed-agent completion result, not a population-level usability claim.

## Additional real-UI regressions
- Preparation details and settlement cost details expanded on 390px; primary actions remained visible/reachable in the app viewport. Screenshots: en-mobile-prepare-expanded.jpg, en-mobile-settlement-expanded.jpg, zh-mobile-settlement-expanded.jpg.
- Skip revealed all tabs without resetting progression. Settings reopened all six guide topics; return worked. The initial iframe header pointer attempt was clipped by the **outer harness** (iframe top −44px, Settings center above the outer viewport), not covered inside the game. Keyboard activation worked; pointer activation was rerun successfully in a fully visible 390×720 harness. Screenshots/logs preserve both the original full-height layout and the successful shorter-viewport help.
- Baseline-created café loaded on the final build at day 2 with its name, cash, stock, reviews, live-service state and all tabs intact; no introductory takeover. Screenshot: legacy-resume.jpg.
- That baseline test café had naturally exhausted its beans during its earlier 1× run. Live status named the missing coffee beans and offered Pantry. Closing produced a real report of 30 stock-loss orders, 46 served, $138 revenue, $46 cost and +$92 profit, with next-step guidance. Screenshots: stockout-explanation.jpg, stockout-settlement.jpg. No failure state was injected.
- Native background pause: before 02:28:00.648, day 2 0:51, $108 and 31 servings. Native Ctrl+T switched away; after 41.024 wall seconds, return showed 0:52, $108 and 31 servings (one second includes transition/capture). After remaining in the foreground, it advanced to 1:24, $126 and 26 servings. Screenshots: native-pause-before.png, native-pause-return.png, native-pause-resumed.png. No background catch-up income occurred.

## Automated verification
- npm test: 55 suites, **575 passed, 6 skipped** (581 total). The six skips are existing opt-in experiment suites, not new guide tests.
- npm run build: passed (TypeScript checking + Vite production build).
- git diff --check: passed.
- New focused coverage includes guide state, preferences/skip/replay, established saves, storage unavailable, stage progression, focus, progressive controls, preparation failures/receipts, and negative-profit/stock/queue/table/stale/promotion/pet/cancelled-service advice.
- Logs: logs/final-tests.log, logs/final-build.log; stage gates preserved separately. Raw observed UI actions and run records: logs/ui-actions.json, logs/ui-runs.json.

## Explicitly not covered
- No human novice study; no claim about unsupervised new-player success rates.
- No physical iOS/Android, mobile Safari, screen-reader or touch-hardware testing. Phone width is Chromium iframe rendering plus pointer/keyboard actions.
- Negative-profit, bakery production capacity, promotion/pet costs and alternative recovery branches were tested through unit/DOM fixtures, not all replayed as real long-running UI economies. The new-save first loop intentionally remains drinks-only.
- No new economic balance experiment matrix; no economy/save-format change required it.
- No commit, push or deployment was requested or performed. Existing docs/long-task evidence remains unchanged.

## Final review supplement
Independent review found that the initial toast-overlap fix hid unrelated receipts while the guide remained visible. The final implementation preserves all toasts in their own layout row after the guide, returning them to their normal location on dismissal. A dedicated regression test and real 390×720 reward claim verified visible feedback without covering guidance or Close shop. Screenshot: en-mobile-final-feedback.jpg. The full suite/build were rerun after this last repair (575 passed, 6 existing skips). The core-loop matrix preceded this feedback-only repair; its affected behavior was directly retested rather than misrepresented as a new full matrix.

Final English repeat: 02:32:09.056–02:35:21.613 UTC, 192.557 wall seconds. Empty-menu explanation/disabled start, restoring the checkbox, 1× open, live reload at 0:43, voluntary close at 1:56, 23 served/+46 profit, actual 15-bean top-up and day-2 opening all passed. This repeat and final feedback check are in the raw action log.

Final 390×720 critical-control check (after the last toast repair): fresh Chinese test café, visible welcome/operation feedback in its own row, actual stock → preparation → Start business → immediate Close shop → settlement → Plan tomorrow → Start business. Every key control was activated by pointer. This short test specifically verifies layout/feedback interactions; its zero-customer instant close is not counted as another complete service acceptance run. Screenshots: zh-mobile-final-starter-feedback.jpg, zh-mobile-final-open-feedback.jpg, tiny-bean-final-chinese-390px.jpg. The last image is a direct browser crop of the actual 390×720 game viewport for standalone delivery.

## Independent-review repair regression — 2026-10-12 02:57–03:01 UTC

These are targeted regressions after the original acceptance matrix, not a repeated first-ten-minute novice test. Only the existing independent test café `晨光小豆` at `localhost:5185` was used, at 1× without save/clock manipulation.

### Confirmed keyboard issue and fix
Before the fix, on the cloud Chromium 390×720 wrapper, Chinese quick help had a 552px-high scroll body containing 766px of text. Initial focus was on Back to work. PageDown did not change scrollTop (0); Tab stayed on that sole button. Thus the candidate was reproduced, not merely inferred from CSS.

The text-only help now opts into a focusable, labelled scroll region in the existing dialog focus trap. Other dialogs do not opt in, preserving their existing initial control focus. Real keyboard checks after build:
- Chinese 390×720: initial body focus, End moved scrollTop 0→214 (552/766). Tab focused Back; Shift+Tab returned to body; Tab then Enter closed help.
- English 390×720: initial body focus, End moved 0→469 (558/1027); Tab and Enter closed help.
- English desktop 1180×757: End moved 0→401 (585/986); Tab/Enter closed.
- Chinese desktop 1180×757: End moved 0→126 (578/704); Tab/Enter closed.
- Chinese settlement still initially focused its details summary; keyboard Enter on Prepare tomorrow opened preparation with Start business focused. This confirms the opt-in change did not change those existing focus entry points.

### Completion-card persistence
The same real test café completed its day-2 normal close: the guide stayed at 6/6 during closing, settlement and day-3 preparation. Reload while day 3 was closed retained 6/6. No immediate-settlement cancellation was used. The report recorded 8 guests, $24 revenue, $8 ingredients, +$16 profit. Unit tests additionally exercise tools expanded before completion, subsequent opening, reconstruction during closing, and explicit dismissal remaining dismissed.

Screenshots added: `keyboard-help-before.jpg`, `keyboard-help-zh-after.jpg`, `keyboard-help-en-after.jpg`, `keyboard-help-desktop-after.jpg`, `completion-day3-prep.jpg` (under screenshots/). Browser wrappers use an index query suffix to avoid serving a cached pre-fix entry page; they are QA-only and not shipped. The test tab was closed after checks.

### Settlement diagnosis regression
The independent review's seeded real Sim case is now a permanent test: 360s service plus normal accepted-order drain produces 45 table losses, 0 cancelled reviews, $145 ingredient consumption and 100 Espresso sales. Advice now recommends checking production/delivery (`watchPass`), while explaining the $45 unsold ingredient remainder separately. A remainder alone no longer asserts early closing. Real simulated forced cancellation and an unfinished baking batch retain finish-service advice. Focused additional cases keep queue, promotion and table causes from being masked by an ambiguous ledger remainder. These are accelerated deterministic simulation tests, not browser gameplay or human novice evidence.