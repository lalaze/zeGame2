# Independent signature-drink review

Reviewed 2026-10-12 against uncommitted feature based on f45237a. Source was being improved concurrently. No browser, port 5173, production save, commits, or unrelated playtest fixtures were touched by this reviewer.

## High-priority findings

### P1 — Fractional trial leftovers could strand the player (fixed and tested)

Locations: `src/game/economy.ts` `restockQuote` / `restock`, `src/game/recovery.ts` `canEmergencyRestock`.

Reproduction: preparation, goals already completed, espresso available, beans 0.75, coins 0.25, all other stock zero. A quarter-serving tasting makes fractional inventories a normal reachable state. The old quote/fallback calculated a 0.25-bean deficit; emergency recovery considered that deficit affordable, while `buyIngredient` correctly rejected noninteger purchases. Neither shopping nor aid could produce a sale. With ample cash, restocking floored the quoted fractional deficit, leaving the forecast unfilled indefinitely.

Repair: round shopping deficits upward to whole purchasable ingredient units in both the full forecast and scarce-budget fallback; apply the same ceiling to recovery affordability. Fractional existing stock remains untouched. Added `src/game/signature-restock.test.ts` for all three remainders, exact quoted cash/stock changes, completion of forecast, save round-trip, and a two-ingredient custom fallback. Updated the preexisting persistence expectation that incorrectly treated fractional purchases as available.

Verification: restock/persistence/menu-stock/recovery suites: **4 files, 67 tests passed**. Initial new-test run had one fixture cost mistake (milk is 2, not 1.5); corrected the fixture and reran successfully.

### P1 — Uncached custom canvases leaked Phaser textures (fixed and tested)

Locations at initial review: `src/render/sprites.ts:1493,1506`; `src/render/phaser/cafe-scene.ts:326,1016,1043`; `src/render/phaser/textures.ts:10–16`.

`itemIcon(customId)` returned a newly allocated canvas every call, bypassing the static item cache. Customer overlays request the icon every rendered frame. Phaser's `canvasKey` registers every new canvas identity with `textures.addCanvas`; the texture manager retains these entries. A custom customer ordering or showing a stockout therefore creates a continuing stream of retained textures. Multiple customers multiply the problem and mobile sessions are particularly exposed.

Repair requested: cache immutable custom icons/artwork with stable identity. Include a regression asserting repeated `itemIcon(id)` and `itemArtwork(id)` calls return the same canvas and keep outlined/bare identities consistent with their contract. A Phaser-level fake texture-manager test can prove repeated renders register only one canvas.

Verified repair: `signature-drink-art.ts` now caches canonical recipe/density/icon canvases. The art regression checks stable identity across 100 repeated calls through `itemIcon`, `itemArtwork`, `signatureDrinkIcon` and `signatureDrinkCanvas`, with no additional drawing. Custom art plus existing static art suites pass: 2 files, 6 tests.

### P2 — Custom icons exceeded existing order-bubble bounds (fixed; browser check remains parent-owned)

Locations: `src/render/signature-drink-art.ts` returns 32×32 at density 1; `src/render/phaser/cafe-scene.ts:1017–1018` reserves 20×18 for a single item and 34×18 for two.

The 32×32 icon is centered at native dimensions, so it extends beyond the single-item bubble and two custom/combo icons overlap within 17px slots. This is a deterministic geometry mismatch; actual screenshots were requested from the parent browser review. Keep richer large art for workbench/menus, but generate compact in-scene icons or scale them to fit.

Verified repair: scene icons are now 18×18 and cached independently of 32×32/96×96 rich artwork; addon marks stay within the compact canvas. Automated geometry/identity checks pass. Parent owns actual scene screenshots.

## Requirement gap (fixed and tested)

At the initial review, `src/ui/signature-drinks.ts` summary/detail included economics and flavor, but no actual delivery count, current tier, 30/100 thresholds or explanation of automatic custom mastery. The static-menu research UI iterates only `MENU`, so it was not an alternative route to custom progression. DESIGN explicitly requires this explanation. The UI now shows delivered count, current tier/taste, base recipe quality, next milestone and explicit 30/100 automatic-growth rules in English and Chinese. The updated UI suite passes.

## Reviewed safeguards

- Recipe IDs are parsed, canonicalized, bounded and checked against immutable encoded ingredient quantities; user names do not control identity.
- Trials check all stock before consumption and spend exactly a quarter portion. Saving/editing does not additionally consume stock.
- Saved and listed capacities are checked in mutation APIs, with preparation-only changes, duplicate refusal and atomic replacement.
- Names use text nodes in the workbench and explicit HTML escaping in dynamic name markup; no new name-based script injection found.
- Practice and sales remain handoff-driven. Canonical history survives deleting/recreating recipes and is separated from paid static-menu research.
- Live snapshot validators accept custom IDs while checking that active custom recipes belong to the economic save. Legacy static IDs remain accepted.
- Custom price/preparation/ingredient definitions feed general economy, forecast, shortage, review and settlement paths; static assumptions checked in those call sites.
- New economic evidence explicitly distinguishes trial consumption from service-day costs, ingredient margin from final bonuses, and level-1 balance samples from later progression.

## Limits and follow-up

This review is code/test evidence, not desktop/mobile browser QA. The parent owns bilingual narrow-screen screenshots and real-browser service observation. Final focused tests include the completed recipe-quality rules and review parser updates. Full build/full suite remains parent-owned. No unresolved P1 defect found in this final code/test pass; this does not replace the parent’s visual QA or claim exhaustive recipe balance.


## Final independent verification

### Regression commands and results

- Twelve focused suites (`styles`, `style-operations`, `style-persistence`, `style-care-forecast`, `style-background-pause`, `signature-drinks`, `signature-operations`, `signature-persistence`, `signature-restock`, `taste`, `reputation`, and UI `signature-drinks`): **12 files / 110 tests passed**.
- `src/game/signature-review.test.ts` plus `scripts/cafe-style-balance.test.ts`: **2 files / 9 tests passed, 2 opt-in matrix/merge tests skipped**. The large economic matrix was not rerun or claimed passed.
- Signature and static art suites: **2 files / 6 tests passed**.

The additional independent review suite explicitly proves:

1. Ten rename, same-formula replacement, delete, reload, rebuild and paid tasting cycles leave coins, price, taste, canonical delivered count, route mastery and menu traffic unchanged. Each tasting still deducts exact stock. No duplicate trial history or saved entry appears.
2. A recipe short by 0.25 of one ingredient consumes none of another ingredient and adds no cost. A successful serving preserves exact quarter remainders, charges full recipe cost once, and does not grant delivery practice at preparation time.
3. Attempted delete/rename/replacement during both open and closing is rejected without changing serialized state. Its in-flight snapshot restores, hands off exactly once, and keeps historical recipe cost and practice valid after subsequent legal deletion.
4. The operations suite separately validates actual custom/bakery combo sales for both delivered items, one guest review, taste derived from the delivered meal, current route/VIP revenue, paid preparation cost and no replay after reload. Missing stock produces neither revenue nor practice.

### Direct baseline comparison of all six static routes

Extracted the `src` tree from commit `f45237a` into an isolated `/tmp` directory. Ran the same comparison test independently against that baseline and the current source. For each of the six styles, the sample uses a static mixed espresso/black-tea/donut menu, identical level-3 menu ownership, ample stock, staff/machine settings, seed 453, 180 seconds at 0.05-second ticks, then graceful completion of accepted service.

Compared every static menu item's sale-price/preparation quote, demand forecast, restock quote, route stages, complete settlement report, final coins, pantry and route handoff counters. **All six baseline/current result objects are byte-for-byte identical (`cmp` exit 0).** This is stronger than only observing passing unit tests, but is still six deterministic samples rather than the exhaustive balance matrix.

Evidence: `evidence/static-six-route-comparison.json`; reproducible test template: `evidence/static-six-route-comparison-template.txt`. Substitute `SOURCE` with the baseline/current absolute `src` path and `OUTPUT` with the output filename, then run each through Vitest and compare the JSON files. The baseline test extraction intentionally omits unrelated artifacts. An initial overly broad baseline test command selected all source tests; 854 tests passed but one unrelated chair-access suite could not import its omitted docs fixture. The corrected explicitly targeted comparison test passed on both trees; no such fixture failure occurred in the current focused suites.

## Browser-discovered P0 follow-up: custom dine-in thought crash (fixed)

The parent's subsequent native mobile browser run found a blank/frozen scene after the first custom dine-in handoff. This was **not caught by the initial code/integration pass**, and that earlier pass must not be interpreted as completed rendered-service QA.

Cause: `src/render/thoughts.ts` treated the authored static `ITEM_FLAVORS` map as a total `Record<ItemId, ...>`. After signature IDs expanded `ItemId`, indexing a custom recipe returned undefined. Once the delivered-heart timer expired, the dining thought branch called `.includes` on that undefined value.

Repair: the authored map now uses `StaticItemId`; an explicit custom-recipe adapter derives cosmetic flavors from the immutable ingredient definition (beans/bold, milk or cream/milky, cocoa, sugar/sweet, tea or matcha/tea, spice/spiced, fruit/fruity). Existing authored static notes remain unchanged. The view adapter has a defensive empty fallback and does not write to gameplay state.

New regressions cover all four custom bases after the served-heart timer, each custom base in either combo position, addon flavor mapping, repeated reads of deeply frozen state/customer records, and all four bases in the actual `Sim` path through a real dine-in handoff while calling `thoughtCandidates` every tick. The final thought read leaves serialized economic state and simulation snapshot unchanged.

Verification: thought and signature-operations suites **2 files / 43 tests passed**; `npx tsc --noEmit` passed. Parent must rerun the native mobile scene after this repair; code/test success alone does not close browser QA.

The follow-up global static-map audit checked `Record<ItemId>` maps and direct `MENU`, `RECIPES`, `ITEM_ART`, `METHODS`, and order-key indexing. No additional unchecked custom access was found: economy and recipe lookups branch/fallback to canonical definitions; sprites branch before static art; kitchen methods have a fallback and production is bakery-gated; Panel's static item lookup receives keys enumerated from static `MENU`. Partial counters use explicit defaults. This is a focused audit, not a guarantee against every rendering defect.

# Second independent review — 2026-10-12

This is a new pass after the previously reported 995-test completion, not a restatement of the earlier review. The user subsequently authorized direct repairs. No commit or push was authorized or performed. Production port 5173 and its save were not accessed.

## Verified findings and repairs (priority order)

1. **P1: Signature-only cafés could not open.** `src/main.ts:459–476`: preparation used the effective menu and enabled “Start business”, but `startDay()` called a legacy `menuEmpty()` checking only `state.onMenu`. Custom listings live in `signatureDrinks.recipes`. Reproduction: save/list one custom drink, remove every stock-menu item, open preparation and click Start business; the dialog closes but the café remains closed. Independently reproduced in the old 5302 build at a real 390×720 iframe viewport. Repaired the entry guard to use `menuItems(state)`.
2. **P2: Signature-only cafés could not book promotion despite an enabled button.** `src/game/promotion.ts:21–25`: the panel used the effective menu but the booking API required a nonempty legacy `state.onMenu`. Same custom-only fixture, enough cash, click Hire creator $60: no campaign or deduction. Independently reproduced both in Vitest and the old real-browser preview. Repaired the booking guard to use `menuItems(state)`; existing budget, phase and one-campaign guards remain.
3. **P2: Settlement recommended an impossible fractional purchase instead of available emergency help.** `src/game/settlement-advice.ts:103–109`: after trial leftovers, the fallback still priced fractional missing ingredients although suppliers sell whole units. Reproduction: goals complete, beans 0.75, cash 0.25, no usable alternatives; advice returned `restartRecipe` for 0.25 rather than `emergency`. A new regression failed before repair and passes after rounding missing ingredient units upward, consistent with restock and recovery.
4. **P3: Settlement told the player to list an already-listed custom drink.** `src/game/settlement-advice.ts:97–98`: with a stocked custom drink on the menu, zero cash and a forecast deficit, fallback selected that custom drink correctly but tested listing against the legacy array. It returned `switchMenu` instead of `useStock`. New regression failed before repair and passes after checking the effective menu.

Permanent added regression file: `src/game/signature-independent-review.test.ts` (4 cases). The main entry test is an explicit source-contract assertion, supplemented by actual browser reproduction; it does not pretend to be a simulated browser click. The other three exercise real domain APIs. Original settlement failures are retained in `evidence/independent-review/settlement-before-fix.txt`.

## Independent coverage

- Read canonical recipe validation, quarter trials, save/edit/name/menu locks, price/preparation integration, combinations, forecast/restock, growth, serialization, historical names/settlement, static-route adapters and pixel/scene interfaces.
- Existing focused economy/UI/art/thought regressions: 6 files / 62 tests passed after the first repairs.
- Promotion, settlement advice and the added independent suite: 3 files / 37 tests passed after all four repairs.
- Separate persistence reviewer: 80 existing targeted tests passed; an additional disposable probe compared **72 live-order reload checkpoints** against uninterrupted closing, with identical sales, ingredient costs, cash, pantry and practice. Another probe retained separate 100/30 serving histories through A→B→reload→A→delete→reload→B. Temporary probes were removed. No new persistence/growth defect verified.
- TypeScript no-emit check and whitespace check passed. Final full-suite/build and real-browser results are recorded below when complete.

## Limits

This review cannot prove the absence of bugs. Browser evidence uses isolated cloud Chromium at a CSS viewport of 390×720, not physical-phone hardware. The prior 480-run balance experiment is not being relabelled as a new run; this pass targets integration and regression. Trial stock remains a preparation/R&D consumption separate from the service-day ingredient ledger, as explicitly designed and documented previously. No asset artwork was altered.

### Final automated result for the second review

- `npm test`: **96 files passed / 1 skipped; 999 tests passed / 18 skipped**. These skips are explicit opt-in experiments, not failures. Full output: `evidence/independent-review/full-tests.txt`.
- `npm run build`: passed including TypeScript; output: `evidence/independent-review/build.txt`.
- Final browser target bundle: `dist/assets/game-BUg_zIYM.js`, SHA-256 `b540f85353acd316a6db3b81a61085a2b103b78870b9faf9aa17601f1f64f196`.
- Re-executed the six-style static-menu simulation comparison against the stored f45237a baseline output: current results remain byte-for-byte identical (`cmp` exit 0). Current raw output and rerun log are `evidence/independent-review/static-routes-current.json` and `static-routes-rerun.txt`. This is six deterministic route samples, not the full 480-run custom balance laboratory.
- Fresh extraction of the updated source ZIP: **999 tests passed / 18 skipped**, build passed, and the rebuilt main bundle SHA-256 exactly matches the reviewed build. Logs: `evidence/independent-review/source-archive-tests.txt` and `source-archive-build.txt`. Dependencies were reused from the installed local `node_modules`; no clean-network install was attempted.
- Updated source patch passes `git apply --check` and applies to a clean f45237a archive. Patched `src` matches the reviewed source, except the generated ignored font directory, which is included in the source ZIP and regenerated by the documented prebuild step. No Git index, commit or remote was changed.

### Final independent real-browser result

An independent browser reviewer verified the old bundle `game-BX3E_vw1.js` against the original dist, reproduced findings 1 and 2, then loaded the final `game-BUg_zIYM.js` and repeated the same actions successfully. Pure-signature promotion deducted exactly 60 coins and moved from waiting to running; the pure-signature opening entered Open normally.

At a real cloud Chromium **390×720 iframe viewport**, both English and Chinese research/trial/save/rename/edit/list/unlist/delete-cancel/delete/reload flows passed, with live-service management read-only. Coffee served **19 cups**, and the edited fruit recipe served **9 cups**, before natural closing. Dine-in customers and custom order icons continued rendering without a new application TypeError. An additional render/thought test run passed **37 tests**. Full browser report, screenshots, DOM snapshots and test log: `evidence/independent-mobile/REPORT.md`.

Dynamic texture verification in this second pass is source-level stable-canvas caching plus existing regression tests and actual service observation. GPU texture counts, heap profiling and long-session leak behavior were not measured. The four verified findings above are repaired; no further verified defect remains from this bounded review. This is not a claim of exhaustive correctness.
