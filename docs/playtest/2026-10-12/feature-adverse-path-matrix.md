# Supporting QA matrix — HEAD 17286bb

Prepared 2026-10-12 from README, feature acceptance/QA documentation, and focused read-only UI integration review. This is a browser test plan, not a claim that the cases below were executed. Lead owns real-browser testing. Use isolated test origins and identify synthetic fixtures explicitly; never overwrite the player's origin/save.

## Verified automated gate

- `npm test`: exit 0; 70 test files passed, 1 skipped (71); 799 tests passed, 9 skipped (808), zero failures; 38.11 seconds.
- `npm run build`: exit 0; TypeScript succeeds; Vite 89 modules, 740 ms build. Font regenerated: 1,371 glyphs / 43.8 KB reported by subset script. Phaser chunk 1,374.10 kB (357.33 kB gzip), no Vite chunk warning.
- Warning: npm unknown environment configuration `http-proxy`, once per command. npm test also printed npm update notice and Vitest worker-reuse optimization hint. Neither is an application failure.
- Exact raw evidence: `npm-test.log`, `npm-build.log` in this directory. Test process timestamps use environment-local time; this report's date is UTC.
- No source edits, commits, pushes or browser actions by this reviewer. Build regenerated dist/font through normal scripts.

## Prioritized coverage matrix

P0 = protect save / irreversible or core-loop integrity; P1 = major advertised feature or integration; P2 = secondary/polish. Default execution uses normal UI; advanced fixture branches must be labeled synthetic, with natural economic progression checked separately.

| Priority | Feature / positive path | Adverse or boundary path / expected result |
|---|---|---|
| P0 | Fresh launch: language → café name → owner skin/hair/apron/name → free style → prepare | Back/blank/long names and random name; no accidental open or purchase; names display literally; refresh onboarding resumes safely |
| P0 | Day loop: starter 50 beans/$0, inspect pantry, select espresso, explicitly open, serve, close, settle, claim goal, buy stock, reopen | Empty menu disables start with useful explanation; close with nobody served still settles; day increments once; finite rewards cannot be claimed twice |
| P0 | Live save/reload: compare cash/day/time/pantry/queue/accepted deliveries | Refresh during open, closing, and pending regular visit does not duplicate payment/review/story/practice or lose consumed costs |
| P0 | One active saved session and normal tab-close/reopen | Second same-origin tab cannot overwrite active café; storage/Web Locks unavailable yields labeled temporary café; existing save is unchanged |
| P0 | Normal Close shop stops arrivals and drains accepted work | Queue dismissals are not losses/reviews; pass-held order, walking server and kitchen batch drain; Settle now warning cancellation keeps running, confirm discards unfinished work but retains ingredient costs |
| P0 | Background/foreground and modal pause | Native tab switch with no background probing: no time, money, care or promotion catch-up; modal journal/settings/help pause; close resumes; speed 4× must not leak through pause |
| P1 | First-service guide six steps; skip/replay via Settings | Returning save not forced through guide; tools reveal reversible; guide stays complete on later days; receipt and guide do not cover Close shop |
| P1 | Menu progression, quantities, price/cost/time preview, all four categories | Cannot unlock bakery/affogato/matcha float before kitchen; insufficient cash or sequence prerequisite blocks buy; open shop cannot alter selected menu; upgrade bulk/max respects funds |
| P1 | Pantry single/bulk buy and ~3-minute forecast | Limited budget buys useful complete recipe rather than unusable fragments; actual purchase receipt matches cash/stock; invalid/negative quantities rejected; inventory persists into next day |
| P1 | Preparation: bakery exact integer, ±5, suggested forecast, details | Empty/negative/huge input clamped safely; type then Tab or hold next button preserves focus and applies once; manual plan remains unless forecast explicitly applied |
| P1 | Kitchen purchase + two expansions, cook/station activity | No free recipe unlock on construction; unlocked equipment appears in intended spots; partial morning batch consumes only actual ingredients; shortage/capacity warnings understandable |
| P1 | In-day baker production replenishes shelves | No duplicate batches per dish, no phantom stock without paid batch; empty shelf causes correct loss, kitchen backlog understandable; unsold bread stales exactly once on settlement |
| P1 | Drink/takeaway + dine-in/table/pass/server handoff | Stockout main, unavailable add-on, full six-plate pass, held barista and impatient guests resolve without freeze; main/add-on expenses and payments correct |
| P1 | Upgrade tables, baristas, servers, machine, sign | Purchase only when allowed; max caps honored; newly added table does not strand cat/customer; table-space furniture goes to storage without loss |
| P1 | Room progression: Reading → Glasshouse → Garden; staff kitchen | Closed-only paid unlock; locked doorway/map actionable; all arrows work; main is sole public entrance; room route remains clear with furniture and returning guests |
| P1 | Map toggle / click room / arrow navigation | Map→Arrange retains toolbar; no panning or scene taps while modal; resized camera returns correctly; focus not left in hidden element |
| P1 | Furniture/decor purchase, place, move, store; finishes switch | Invalid floor/wall/doorway/table placement visibly rejected; drag/cancel/outside/multitouch/blur does not commit; repeats of same kind do not duplicate comfort; decor seating adds no service capacity |
| P1 | Flavor: 30 handoffs practiced, 100 handoffs + paid research signature | Baking/waste/reload/cancel never adds practice; combo tracks actual delivered dishes; research closed-only, once-only, correct $150 minimum; no price/tip changes |
| P1 | Reputation bar and recent feedback, settlement review summary | Sold-out/cancelled/table loss = 1; queue loss = 2; missing add-on cap 3; service caps and neutral early weighting; review list max 50; affects arrivals only |
| P1 | Goals 15-step list and reward claim | Alternative capacity investments satisfy goal; count unlocked recipes rather than forced menu; no double claim/reload reward; later advice points to genuinely available next action |
| P1 | Emergency one-bean recovery in preparation | Only genuine insolvency with no ready/paid stock, affordable recipe or claimable/reachable reward; keeps money/revenue/menu choices; adds espresso and one bean once; reload/double click cannot accumulate |
| P1 | Cat catalog 12 kinds / filters / portraits / deliberate adoption | Browsing spends nothing; closed-only adoption, three distinct maximum, insufficient funds blocked; initial care accounting, cap ten packs and auto-refill behavior |
| P1 | Resident locate/pet/dialog, personality and five behaviors | Empty care sleeps and removes traffic bonus; refill reactivates correct cat; default idle server does not trap strolling; left/right head orientation; moved bed/table changes retarget safely |
| P1 | Cat + stable seated guest reciprocal interaction | One global pair, no chasing departed guest; furniture/reload/no-care/room/route cancellation safe; gesture not covered by thoughts; service/payment/reviews unchanged |
| P1 | Creator campaign booking, pause/resume, expiry, carry across days | One booking including paused; exact one-time cash fee; no refund/renewal; airtime only open game time; settlement expense is consumed proportion, not second cash deduction; overloaded/stockout warning |
| P1 | Regulars badge/journal: 12 cast × 5 bilingual chapters | Unknown people have no leaked names/portraits/titles; only actual successful handoff unlocks; business-day gate/once-per-day; failed visit, reading or reload cannot advance |
| P1 | Regular chapter Previous/Next/Read later/Finished reading/reread | Only Finished reading changes read flag once; closing/escape preserves unread; reload persists; not required to read for progression; live pending identity survives without duplicate credit |
| P1 | Regular favorite selected/unlocked/supplyable drink | Missing/unselected/unsupplyable favorite falls back; food-only main not replaced with drink; ordinary combo/stock/payment rules remain |
| P1 | Settlement headline and expanded ledger, useful advice | Distinguish ingredient vs capital/prepaid cash flow; table/queue/stock/cancel loss causes not masked by ambiguous expense remainder; negative profit, stale leftovers, pets/promotion shown once |
| P1 | Settings edit café/owner; language switch during existing café | Progress unaffected; EN/中文 labels, glyphs and long text remain legible; Escape and return focus correct; reset warning cancel is safe; confirm only on disposable test save |
| P1 | Mobile 360/390/430, desktop and 720×390 landscape | Combined guide/toast/reputation/Regulars/service controls visible; no horizontal overflow; dialog footer reachable; ≥44px action targets; long list scroll retained across tabs and breakpoints |
| P1 | Keyboard-only controls and long dialog body scrolling | Native input arrows/Space/IME not stolen by game; Tab/Shift+Tab contained, Escape restores focus; End/PageDown scroll long help/story/reviews; hidden controls not tabbable |
| P2 | Tap/Space brew assistance, VIP crown/tip | At most once per game second; rapid clicking no extra; cat click opens cat rather than brew; dialogue/arranging/map do not trigger service actions |
| P2 | Thoughts, day/night lighting, reduced motion | Max two unobtrusive clouds; suppress during dialogs/map/arrange/transitions; lamps/rooms readable at night; reduced-motion camera/cat effects static but understandable |
| P2 | PWA/offline reload and sprite gallery | Existing offline asset path loads after initial cache; app update does not mix cached chunks; gallery filters/previews/download atlas+manifest without touching save; keyboard navigation intact |

## High-value browser sequence

1. Complete one genuinely fresh 1× loop in English desktop and Chinese narrow phone viewport, including reward, upgrade, restock, live reload and reopen.
2. On isolated advanced test café, combine bakery + all rooms + cats + campaign + regular journal: play, pause dialog, resume, reload, normal close, expanded ledger.
3. Force or naturally reach empty menu, sold-out main, bakery shortage/pass backlog, and insufficient-funds restock; validate explanations and graceful settlement.
4. Test native background pause, same-origin second-tab session safety, keyboard dialog scrolling and cross-breakpoint long-list retention.
5. Advanced rare states (true recovery gating, capped adoption, story read/unread/all chapters, dense furnishing) may use clearly labeled synthetic fixtures only; do not describe fixture money/progress as naturally earned.

## Risk map from focused code reading (hypotheses, not confirmed defects)

- `src/main.ts` binds region/map/arrange, cat hits, brew assistance, guide, HUD, dialogs, lifecycle and autosave. Cross-feature integration is denser than any one feature acceptance run. Probe overlapping HUD and scene tap priorities, and exact pause/resume/reload transitions.
- `src/ui/modal.ts`, `dialog-focus.ts`, `regular-guests.ts`: modal replacement restores focus before creating next dialog; long text bodies require scroll/focus integration. Probe nested Settings→help and journal list→story→close with keyboard and 360px height.
- `src/ui/prepare.ts` suppresses redraw while a pointer is held to preserve quantity actions. Probe blur/Tab, held plus, invalid input, language/viewport changes, and stock purchase updates before Start.
- `panel-scroll.ts`, `mobile-layout.ts`, styles and newly added Regulars strip: previous regressions involved inactive-tab offset and footer clipping. Retest with all management tabs visible and long Chinese labels.
- `sim.ts`, `sim-snapshot.ts`, `save-session.ts`, `state.ts`: newest story identities share live-save handoff paths with existing flavor/review/payment; accepted-order restore, closing restore and competing tabs deserve actual browser checks.
- `living-cats`/scene rendering: recent repaired bugs involved idle server deadlock, furniture/table changes, direction and thought overlap. Current full tests pass, but visual orientation and blocked-route behavior merit a live sample.
- Long-task evidence is frozen historical source data. Do not rerun old generator writers into existing evidence. Automated gates here establish regressions, not a new balance proof.

## Documentation discrepancies / limits

- README's Chinese font “about 12 KB” is stale: current build reports 43.8 KB (asset 44.81 decimal kB) after story content. Documentation issue only; glyphs still require visual check.
- Feature docs retain historical 583/666/760 test counts and historical uncommitted statements. Current HEAD gate is 799 passed/9 skipped; do not aggregate historical counts or treat prior screenshots as current-run screenshots.
- Nine default skips are opt-in evidence/expensive experiment coverage. Not failures, and not newly executed evidence.
- Existing mobile evidence is desktop Chromium CSS viewport emulation, not iOS/Android/touch/soft-keyboard or physical-device performance. No claim of physical-device validation should be made.
- No confirmed application bug emerged from this supporting review. Browser execution is required to resolve risk hypotheses.
