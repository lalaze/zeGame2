# Browser acceptance — 2026-10-12

Tested in dot's cloud Chromium on isolated http://127.0.0.1:5304/harness.html. Port 5173 and its real save were not opened. The harness uses an iframe with CSS viewport dimensions; these are real browser checks, not a physical-phone claim. `fresh` is a genuine new save. `advanced` and `shortage` are explicitly synthetic fixtures, not earned progression. Screenshots and DOM observations are in evidence/screens.

## Passed
- EN and ZH, desktop and 390×720: optional Help / Pantry controls work through existing actions. Shortage goes directly to existing forecast-priced replenishment. Closing and live menu restrictions remain enforced in regression tests.
- English and Chinese signature-only Cloud Milk shortage: real milk shortage appears, original $130 quote/purchase works, no substitute buying logic. Back restores Menu / Tea / x10. Chinese return was rechecked by authoritative active attributes after native keyboard selection; initial automation pointer attempts had not changed the selection and are not counted as successful taps.
- Panel collapsed → Pantry → Back restores collapsed preference. Normal open-panel return preserves category/amount. Controller tests additionally cover scroll, focus, stale navigation and modal interruptions.
- 390×720: app and scrollWidth both 390, all visible button heights >=44 px. Footer in normal layout, no scene overlap. Current → next traffic phase is visible above the scene with no extra click. Desktop uses footer text outside scene. Existing unrelated desktop controls retain legacy sizes; all new shortcut/focused-pantry actions are >=44 px.
- Native held Return for 1500 ms on Back: one return, no accidental repeated upgrade purchase (Lv2 before/after). Final focus-interruption repair separately passed independent native-event probe and regression tests.
- Genuine English fresh play: default onboarding, 50 starter beans, explicitly prepare/open, complete first day naturally: 33 served, revenue123, ingredient cost33, profit90, no recorded stock/wait/waste losses. Bought26 beans with earned cash and reopened day2 at cash97.
- First-service Pantry initially exposed only27px of stock list. Fixed by temporarily hiding only the guide while the focused task is open; stock viewport150.4px, Back restores same guide progress. No new beginner resource gift.
- Background native-tab test: about70s away advanced displayed time by only2s at tab-transition edges (4:12→4:14), rather than offline duration. Live reload retained cash10250 and continued current day's clock/phase; no reset. Unit save/clock tests cover exact state continuity.
- English synthetic shortage settlement cash ledger reconciled:10000−130+380=10250. Its intentional unattended stockouts are fixture pressure, not a fresh-save result.

## Limits / observation
- At720×390 landscape the existing min-height layout vertically scrolls; footer is below initial fold. No horizontal overflow (clientWidth=scrollWidth705 with scrollbar). Portrait390×720 is the acceptance target; no claim of landscape thumb reach.
- Browser metadata extension emitted known chrome-extension errors. No application error was observed; this is not a claim that the browser's entire history is error-free.
- No physical touch device or Safari run. Synthetic fixture results are kept separate from natural fresh-save results.
