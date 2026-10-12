# Execution progress

## 2026-10-12: initialization
- Created PLAN, DESIGN, BALANCE and this execution record before implementation.
- Confirmed checkout joyful-sloth. Existing unrelated untracked docs/playtest/2026-10-12 files preserved.
- Checked repository guidance; no repository AGENTS.md was found under /workspace/shared.
- Current phase: design and baseline. No feature changes or tests claimed yet.
- Blockers: none known.
- Resume next: inspect catalog/state/simulation/UI/save and realSim harness; complete design and baseline before first-route implementation.
- Native task execution only; no scheduled wake or autonomous scheduler has been created.

## Design/baseline checkpoint
- Baseline test suite: 74 files passed, 1 skipped; 827 tests passed, 9 skipped. Log: logs/baseline-tests.log.
- Independent design audit checked fresh-save zero cash, 800-coin kitchen gate, room order, handoff, seating fallback, care, taste and service rating constraints.
- Independent accounting audit requires fixed total clock and counts queues removed at closing separately. Historical economy datasets have a different source hash and are not reused as today's baseline.
- Untouched tracked source copied and verified for baseline replay before economic edits. Real simulation baseline and new matrix runner are being built independently.
- First-route implementation: version-14 focus migration, closed-shop switching, real stage checklists, coffee handoff premium and precision brewing cost. Focused coffee/taste/reputation/operations tests: 40 passed. One unused-import typecheck failure was corrected; rerun in progress.
- Coffee UI verification remains pending before expanding route effects. No phase is claimed complete yet.
- Corrected a design inconsistency before batch expansion: takeaway late goal now uses cortado Lv3 (2.6s base preparation), rather than flat white (3.2s), which would not qualify for fast-counter service.
- Added authentic persisted handoff counters with safe migration and no legacy fabrication. Coffee first-route focused tests remain passing; TypeScript check passed after unused-import correction.

## First complete route gate
- Coffee game tests and history regressions: 10 passed in styles.test.ts; 40 combined first-route/game-system tests had already passed.
- Coffee UI gate: 30 tests covering EN/ZH progression, switching, stale controls, closed-only changes and preparation round trip passed. TypeScript passed.
- Began batch A (bakery + commuter): forecast/real-order shared pairing, kitchen station work and physical counter routing with discount. Batch verification in progress.
- Independent matrix pilot discovered a pre-existing valid fern placement blocking a chair approach and preventing closing completion. Preserved before-fix evidence; matrix uses cactus sill + wall poster instead. A local access-guard regression/fix is required before delivery, not waived by avoiding the layout.
- Parallel execution capacity was temporarily limited; the scoped repair continued within the existing task.

## Route batches verified
- Batch A (bakery + commuter): 122 tests across 7 files passed. Pair probabilities shared with forecasts, station-work-only speedup retains walking time, fast counter handoff has a real 6% discount. TypeScript passed.
- Batch B (cats + garden + community): 159 tests across 9 files passed. Tests cover care expiry, comfort/plants, actual seated pair premiums, no style stacking, pairing forecasts, lower community traffic and unchanged review scoring.
- An initial batch-B test fixture used a nonexistent rug ID; six expected-condition assertions failed. Corrected fixture to actual rug_red, preserved the failed log as logs/phase3-invalid-rug-fixture.log, reran successfully. This was a fixture correction, not a gameplay tuning change.
- All 199 existing/new UI tests across 20 files passed. Browser visual verification is still pending; structural DOM tests are not screenshots.
- Current phase: mixing/save regression and full suite, then final balance/browser QA. First genuine fresh-save pilots reach all six routes' late goals; final multi-seed runs pending final mechanics and local chair-access repair.
- Chair-access review found a narrow reserved-apron mismatch; independent worker is implementing placement protection plus asset-preserving legacy eviction, without changing the pathfinding model.

## Stable gameplay candidate and independent review
- Frozen gameplay candidate includes six focuses, save v14, no farmable route rewards, all-six live reload tests, chair access repair and non-mutating cost-aware automatic-care forecast.
- Actual zero-coin progression: all 18 trajectories (six routes × three fixed seeds) reach all stages. All 54 exact stage saves round-trip, preserving economic state and live runtime. QA copies stay outside the repository. See progression/README.md.
- Independent source review checked delivered-order qualifiers, regular substitutions, forecasts, no-focus behavior, saves and stacking. Fixed community patience wording and cook station progress-bar denominator.
- Old-load furniture movements now trigger one clear EN/ZH notice and save immediately; repeated loads retain one stored item without refunds or repeated migration.
- QA build succeeded to an isolated output directory. Production preview/save on 5173 remains untouched; actual browser QA uses dot cloud browser at a separate origin.
- A full suite under concurrent 14 heavy simulation shards produced five wall-clock timeouts in existing heavy tests, not assertion failures (logs/all-tests-frozen.log). Do not claim a full pass. Rerun unchanged tests with CPU contention removed before delivery.
- Baseline and final real-Sim matrices are running as checkpointed native shards; no automation scheduler has been created. Final acceptance and visual QA still pending.

## Actual browser and matrix checkpoint (10:11 UTC)
- Native dot-cloud browser at isolated port 5227 verified genuine zero-coin onboarding, selecting bakery before kitchen, normal stock/open service, disabled changes while open, and reload preservation.
- Actual screenshots exposed a desktop clock/style overlap and an overly small guided mobile café. Repaired locally, preserving before evidence. Fresh 390×844 service now renders the café at 274.66×206 px, with 44 px Style/Close/status controls and no overlap. Onboarding now explicitly calls its three choices décor themes.
- Earned garden late snapshot renders all completed stages in Chinese on 390 px. These stage fixtures were captured from the real progression runs, not browser-earned wealth; only cosmetic QA profile is added.
- Matrix checkpoint: baseline 2,835/3,240 samples; final 1,305/6,480. All 17 fully completed focused cells currently have positive operating-profit lower confidence bounds. Paired examples show route tradeoffs; this is partial evidence, not final global dominance acceptance.
- Resume: finish bilingual desktop/mobile stage coverage, await all checkpointed matrix shards, run final acceptance and uncontended full suite/build, then package evidence. No scheduler or production save change.
- Browser coverage completed: 72/72 six-route × earned-stage × language × viewport cases pass route/goal/localization/overflow/modal-bound checks. Representative screenshots and exact measurements are in screens/. Actual cats→takeaway switching plus reload preserves exact cash and handoffs; adopted cat remains visible. Final UI independent source review found no additional blocker.
- 10:30 checkpoint: baseline 3,165/3,240; final 3,795/6,480 samples. No simulation, ledger or drain failures reported. The independent acceptance reader is being strengthened to reconstruct ledger identities and report resolved/pending guest sensitivity; this does not change frozen simulation inputs or mechanics.
- Final route contract rerun passed (6 tests, 2 explicitly opt-in long tests skipped), logs/route-contract-final.log. Final all-tests rerun still waits for CPU contention to clear.

## Full-suite gate (10:41 UTC)
- `npm test -- --maxWorkers=1` passed all unchanged tests: 84 files passed/1 skipped; 901 tests passed/13 explicitly opt-in tests skipped; 175.28 seconds. No test timeout was increased and no failing assertion was disabled. Serial worker scheduling removed the earlier burst CPU contention; the failed run remains preserved.
- Matrix checkpoint: baseline 3,235/3,240, final 5,510/6,480 samples. Pending final matrix acceptance, ordinary default-worker test/build recheck and packaging.
- Default `npm test` also passed on the final candidate: 901 passed/13 opt-in skipped, 84 files passed/1 skipped, 40.66 seconds (logs/all-tests-default-final.log). The ordinary build command passed with an isolated output directory (logs/final-build.log); its entry is byte-identical to the actual browser-tested QA build.
- 10:59 matrix checkpoint: untouched baseline fully merged; final 6,385/6,480 samples, seven shards complete and one remaining. Full quantitative acceptance is still pending; tests/build passing does not substitute for this result.

## Full matrix exposes a remaining garden balance issue (11:07 UTC)
- All 9,720 samples completed and the accounting/sustainability/pairwise-advantage verifier passed. This is NOT overall feature acceptance: independent dominance review found coffee significantly dominates garden in all nine common-asset stage/pressure cells on the five recorded metrics.
- Acceptance review requires diagnosing and correcting this genuine weakness before completion. No final package was uploaded and no completion claim is made. Keep all `final-v1` and untouched evidence unchanged.
- Initial attribution: early garden's bread add-on does not exercise the tea/pastry benefit; the common middle portfolio has cappuccino level 2 versus hot chocolate level 1; the late common portfolio spends heavily on rooms and retains all target dishes at level 1. Cross-room dining, kitchen waste and input margins also matter. These are hypotheses/observed setup differences, not yet a validated correction.
- Next: record exact paired dominance and cost diagnostics; preregister a game-grounded menu/capital/layout correction or narrowly justified mechanic adjustment; run targeted 30-seed checks and the affected matrix regression. Do not add arbitrary premiums just to win a benchmark. Full tests/build/UI remain passed for candidate v1; rerun affected gates if source changes.
- 11:19 correction plan approved and frozen: a new synthetic shared-ownership sensitivity panel anchored to the six previously recorded late-stage saves at seed1592594996. It reconstructs every paid asset at actual cost, rather than merging cash/pantry/care/reviews. All six focuses and plain control use the same five distinct recorded late menus. No garden-only optimization or recipe-price bonus is introduced.
- Independent union reconstruction estimates 724,296.378105 total paid cash including initial care; derive funding and the same 12% reserve from the ledger. Recipe capital is 405,640.67 and rooms259,200, with three baristas, servers and cooks. Exact setup audit precedes 30-seed base scan, a predeclared independent holdout and pressure regression.
- Equal productive-capital analysis does not justify a global price change: 30k of recipe-chain investment purchases lemon tea level7 versus cortado level1; at60k,11 versus3; at120k,15 versus5. Original same-level margins were not equal recipe investment.
- 11:26 UI guidance refinement verified: only two EN/ZH locale keys changed (garden introduction and room next-step hint). Focused tests47pass/typecheck/buildpass. Actual browser rechecked16 affected garden/community language/viewport cases, all pass; final390 screenshot saved. Gameplay remains frozen for the new union experiment.

## Earned-asset holdout and bounded acceptance (12:10 UTC)
- Training and independent holdout each completed all 1,050 real-Sim samples. The stronger, preregistered all-competitor gate FAILED on one of 34 frozen edges: garden versus cats on the same tea/scone menu has holdout profit difference +23,924, 95% CI [−29,614,77,462]. This is inconclusive, not equivalence or a garden win. The original protocol and failure are retained unchanged.
- The narrower requested material advantage/cost is independently reproduced: garden's own-plain profit benefit is +263,823 [222,046,305,601]; its preselected bakery waste advantage is −337 [−364,−310]. Its own-plain costs are +1.30 percentage points lost guests and −0.293 stars. Garden is descriptively nondominated among all 35 tested holdout policies, and all 30 garden runs recover capital without constrained restocking. This does not establish a global optimum.
- Continue the previously planned feature/rush sustainability regression across all 35 policies and 30 holdout seeds, despite the stricter auxiliary gate failure. This departure from conditional sequencing is explicit; no metric, menu, seed, source or frozen acceptance edge is being changed. No gameplay buff is justified by an uncertain profit comparison with cats.
- Remaining: pressure regression, final complete test/build checks, consolidated acceptance and truthful deliverable packaging. No commit, push or package upload yet.
- Final aggregate attempt overlapped eight pressure simulation workers and hit five existing wall-clock test timeouts (900 passed, 17 opt-in skipped); no assertion failure. Preserved logs/all-tests-final-union.log. Wait for CPU contention to clear and rerun the unchanged default suite, without increasing timeouts or disabling tests.
- Final isolated build and route contract check pass again (logs/final-build-union.log and route-contract-union.log). The rebuilt entry matches the actual QA build.
- Added ten passing source-execution pause regressions, evaluating actual main/render timing code with the real simulation, without changing gameplay hashes. A native cloud-browser hide/show attempt did not expose reliable hidden events and is explicitly inconclusive; it is not substituted for those tests or claimed as a browser pass.

## Final verification (12:42 UTC)
- All 2,100 pressure samples completed with no simulation/accounting failure. All 70 policy cells have positive operating-profit lower confidence bounds, zero cash-constrained restocks and zero failed promotion bookings. Capital recovery is 1,772 samples; 328 remain censored. Selected garden recovers in all 30 seeds at both pressures.
- Feature pressure reproduces all 34 frozen edges; rush reproduces 33/34. Under rush, same-menu cats earns 59,746 more than garden [14,500,104,993], with better loss/rating/throughput. The strict combined gate remains false. Do not erase or soften this adverse result.
- Final default `npm test` passed: 915 tests, 17 explicitly opt-in skipped; 87 files passed, one skipped; 40.04 seconds. Final isolated build and route check pass (6 tests, two opt-in skipped). Logs: all-tests-release.log, build-release.log, routes-release.log. No timeout was increased and no failing test disabled.
- Source patch applies to the clean base and all 34 changed/new source files match byte-for-byte. The release entry is identical to the actual QA build. Final delivery contains the local playable build, source patch, bilingual guide, screenshots and complete raw/summary evidence. No commit or push.
- Independent acceptance is complete: all eleven requested areas are supported within the documented scope. The source/build/evidence are ready for attachment delivery. The auxiliary statistical failure and inconclusive native visibility smoke remain explicit limitations, not unfinished promises to chase a stronger claim. No further gameplay changes are planned.

## Post-review P3 correction (2026-10-12, 14:07 UTC)
- Fixed only the first style-preview selection scroll defect: the callback now queries the mounted modal body rather than retaining the null pre-mount reference. Preview heading focus and separate Apply behavior remain intact.
- Four new red-first regressions cover header/preparation entry × mixed/coffee initial focus; all four failed at scrollTop 480 before the fix and pass afterward. Subsequent choices, state preservation, Apply availability, focus and Escape are checked.
- Focused checks: 84 tests passed. Complete ordinary suite: 919 passed, 17 opt-in skipped; 87 files passed, one skipped. Normal npm build, including font generation and TypeScript, passed to the isolated final-build directory. Route contract: 6 passed, 2 opt-in skipped. No timeouts raised or assertions disabled.
- Independent recheck passed all four real-module DOM reproductions and 71 focused tests. Native cloud Chromium could not reach the isolated port 5294 harness (ERR_CONNECTION_REFUSED after one bounded retry); no new native-layout pass or screenshot is claimed. Temporary servers were stopped. Details: [P3 QA](QA-P3.md).
- Compared with the previously delivered source manifest, only src/ui/cafe-styles.ts and its test changed. Gameplay fingerprint remains 9c47eab7d2f2b1fe47e094df3f22c41f6a6a51043c338e952a6de37a27352c4d. Economic matrices and preserved statistical failures are unchanged; no long matrix rerun is needed for this UI-only fix.
- Source patch was independently reapplied to the clean baseline and all 34 source files match. Existing uncommitted six-style work was preserved. No commit, push, production-origin or player-save access.
