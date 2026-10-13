# Progress

## 2026-10-12: initial inspection
- Baseline provided: f45237a319917b987eb30457a17b66baaf3176d6; previous 919 tests / 17 opt-in skips are historical, not current verification.
- Inspected data, economy, state, taste, operations, simulation snapshot, panel, styles and ingredient definitions.
- No AGENTS.md or checkout .agents skills found in inspected repository/ancestor paths.
- Existing static MENU assumptions affect economy, save count parsing, runtime snapshot item validation, route category lookup and naming. Integration will preserve canonical recipes after card deletion.
- Plan and design are written. Rule engine, isolated workbench and persistence integration are in implementation.

## Initial next step (completed)
Rule API, economic integration, focused tests, workbench and browser acceptance are now completed; see final status below.

## First integrated checks
- Initial complete suite: 952 passed / 17 opt-in skipped (test-initial.log); initial production build passed. Further review fixes are still in progress, so these are not final totals.
- Independent review caught fractional trial-stock replenishment rounding and a per-frame custom canvas texture leak; repairs and regression coverage are underway.
- Formula quality now has deterministic 3.7–4.3 sensory differences, with delivery-only practice bonuses; the slow double-milk variant gets a review/taste tradeoff rather than a free price boost.
- Cloud Chromium initially could not access the execution-sandbox server. A supported cloud desktop terminal launched Python static hosting on isolated5302 successfully. Desktop EN trial, naming, save, listing and preparation-menu inclusion have been exercised; final rebuilt desktop/mobile run remains pending.

## Native-render regression repair
- Native390px Chinese actual service exposed a static-only thought-flavor lookup after the first custom dine-in guest's served-heart animation. This stopped the scene despite passing economic tests.
- Fixed custom cosmetic flavor mapping; added heart-expiry/all-base/combo and immutability regressions. Rebuilt and replayed the same native save: scene continues from0:21/revenue66 to1:02/revenue516 with visible moving customer/order scene.
- All six static route quotes, forecasts and seeded settlement outputs compare byte-for-byte with baseline.30fixed seeds×4bases×2pressure×2menus=480balance runs passed with conserved equal-budget ingredient accounting, including separate quarter-trial cost.

## Final verified status
- Complete suite: **995 passed /18 opt-in skips**; separate480-run30seed lab passed. Production build and TypeScript passed after the dine-in thought fix.
- Native cloud Chromium1000pxEN and390pxZH research/manage/trial/menu/service paths exercised. Mobile replay after the renderer fix finished naturally:36guests,1726revenue,695used ingredient cost,1031profit; screenshot preserved.
- Independent reviewer found no unresolved P1 after repairs. Existing six-route economic comparison remained identical to baseline.
- No commit or push. User's unrelated untracked playtest files preserved. Production5173 untouched.
- Delivery packaging next: playable static build, baseline-targeted source patch, evidence bundle and checksums. For continuation, inspect any newly reported defect and its repro before editing; avoid redoing the completed feature or resetting real saves.

## Delivery verification
- Source patch applied cleanly to an extracted f45237a baseline; patched src/scripts files match working implementation byte-for-byte.
- Source archive independently extracted, built and fully tested:995passed/18skipped. First archive smoke exposed omitted legacy frontier fixture files; they were added and the complete suite rerun successfully. This was a packaging omission, not an application regression; failed and passing logs are retained.
- Delivery packaging is complete: standalone source archive builds and passes the same995tests; baseline patch applies and matches implementation. Playable archive excludes synthetic QA harness/fixtures. Evidence contains raw balance data, independent review, full logs and native screenshots. Final English desktop run also crossed30deliveries naturally:49cups and4.5taste, with genuine milk-stockout and normal settlement verified.
