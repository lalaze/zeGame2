# Actual browser QA evidence

Captured in the dot-cloud Chrome browser, isolated origin `127.0.0.1:5227`. The production origin on port 5173 was not used.

## What is actual
- `01`–`03`: actual zero-coin onboarding and service before visual corrections. These preserve the desktop clock/style overlap and the undersized guided mobile café found during QA; they are not final layouts.
- `05`–`06`: actual fresh-save service after the layout repair. Mobile viewport is 390×844, café canvas 274.66×206; Style, Close and service-status targets are 44px tall. Desktop style entry is top-right, separate from the lower-left clock.
- `02`: actual zero-coin bakery selection before kitchen ownership, with an accessible espresso-investment next step.
- `04` and `earned-*`: actual built UI displaying exact earned economic snapshots from the 18 real simulation trajectories. A cosmetic QA name/avatar is added; money, ownership, history, goals and runtime are not fabricated. These are fixture-loaded browser views, not a claim that browser clicks earned the late café.
- `coverage-72.json`: native browser DOM measurements for six routes × three earned stage completions × EN/ZH × desktop1120×760/mobile390×844. All 72 show the expected route, all goal rows, no untranslated keys, no page horizontal overflow, and a modal within the viewport. The completed early stage naturally displays the next, middle-stage goal.
- `mix-reload.json`: actual closed-shop switch from cats to takeaway and reload; exact cash 11.470599443718584 and all handoff counters unchanged. The Cats tab still shows the adopted ginger cat. Full ownership invariance is also covered by game tests.

## Coverage and limits
Actual UI checks cover fresh onboarding, décor wording, style discovery, previews, preparation round trip, open-only browsing with disabled Apply, closed switching, live reload, first automatic orders, expanded descriptions, all three goal sections, EN/ZH and portrait/desktop layouts. Existing automatic service remains low-click. Modal content scrolls independently with a visible scrollbar and fixed close action.

390px testing uses a real browser iframe viewport, not a physical phone. Quantitative 30-seed economy comparisons are in `../results`; screenshots do not establish balance. Visual correction source changes affect UI layout only, not the pinned gameplay matrix.

Additional actual mixed-service check: the cat café switched to takeaway, retained its espresso + Earl Grey menu and resident cat, reopened, then closed normally. Without pressing forced settlement, accepted orders drained to the Day 3 settlement: 2 served, revenue 95.76, costs used 4.56, profit 91.20, no recorded stock/wait/waste loss. This short session verifies the flow, not long-run profitability.

## Final expansion-advice refinement
The later two-key EN/ZH copy update tells players to strengthen profitable recipes and retain stock/care money before expensive expansion. It changes no operating formulas. `07-garden-mid-zh-guidance-final.png` shows the final 390px advice. `guidance-recheck-16.json` records all garden stages plus the community reading-room hint across both languages and viewports; 16/16 pass. Earlier screenshots preserve the previous wording; the final layout and effects are unchanged.

## Background pause verification scope
The final candidate additionally passes ten source-execution regressions in `src/game/style-background-pause.test.ts`: they execute the actual main frame and renderer delta clamp with the real simulation. Hidden/modal/onboarding/stale-session/save-notice states preserve economic/runtime state; hidden closing does not settle; 1×/2×/4× resume does not apply away time. This is source-contract evidence, not a physical browser test.

A native cloud-Chromium tab-switch attempt on the isolated QA origin did not expose reliable hidden visibility events to the built game's iframe. Its test-only observer recorded only the initial visible state. That attempt is inconclusive and is not credited as a direct browser background-pause pass. No gameplay change was made for this tooling limitation.
