# Progress

## 2026-10-11 17:33 UTC — Started
- Verified clean checkout at baseline `57df94e60899a3067d1313a2980d32b4d591be48`.
- No AGENTS.md found in checkout or applicable parent directories. Read package scripts and engineering guidance.
- Created PLAN.md and this persistent progress log.
- Current phase: inspect game simulation and existing balance runner; define paired baseline experiments.
- Next: independent accounting audit and implementation of reproducible simulation coverage.
- Blockers: none.
- Available continuation: shell sessions can be polled until terminal result; persistent artifacts support manual resume after executor interruption. No extra scheduled service is assumed.

## 2026-10-11 17:37 UTC — Baseline preserved; audit running
- Baseline full tests passed: 431 tests, 39 files; `logs/baseline-tests.log`.
- Exported baseline tracked sources with `git archive HEAD` to `/workspace/shared/zeGame2-baseline-57df94e`, sharing installed dependencies. This is a source snapshot in the same cloud filesystem, not another task environment.
- Building paired fixed-seed runner with resumable raw JSON batches, inventory/prepaid reconciliation and explicit investment/payback treatment.
- Confirmed restock fragmentation: empty pantry, 1 coin, espresso+latte menu fails to buy an affordable espresso serving. Preparing minimal recovery-aware restock fix.
- Defensive invariant gaps: NaN ingredient purchases corrupt cash; unsupported bakery completion can create unpaid stock. Regression tests/fixes underway.
- Normal ingredient purchases, cat care and promotion airtime intentionally distinguish cash prepayment from accrued expense; no normal-path duplicate cost found.
- Fully exhausted cash and usable stock has no general recovery mechanism. Investigating scope; no unapproved rescue mechanic added. One-off goal grants are separate from recurring operating income.
- Next: capture baseline simulations from snapshot, run same scenarios against fixes, summarize paired differences and decision limits.

## 2026-10-11 17:42 UTC — Candidate validated; authoritative matrix running
- Three minimal changes implemented: integer-safe ingredient purchases, paid-batch-only shelving, affordable complete-recipe restock fallback.
- New invariants: 18/18 pass; identical tests against source snapshot: 7 fail, 11 pass. Before log persisted in `logs/accounting-regressions-before.log`.
- Current full suite: 452 passed, 1 intentionally opt-in simulation test skipped. Build passed; logs in `logs/candidate-tests.log` and `logs/candidate-build.log`.
- Full matrix covers 98 scenarios × 30 seeds × 8 days. Pilot used 0.1-second steps; authoritative baseline/candidate use the actual application's 0.05-second step. Pilot retained separately and not used as final evidence.
- Added independent paid-unlock investment frontier analysis to distinguish early espresso efficiency from perpetual dominance.
- Absolute insolvency requires a gameplay decision; documented trigger, existing reset limitations and minimal alternatives in RECOVERY-DECISION.md. Other work continues.

## 2026-10-11 17:45 UTC — Early results and independent frontier
- Authoritative matrix checkpoints: 26/98 in both baseline/candidate; no settlement timeouts or accounting failures.
- Early recovery evidence (30 seeds, 8 days): one-coin shared-ingredient case net-liquid gain 0 → 755.1 and served 0 → 147.6; nine-coin complex case gain 0 → 2,211.8 and served 0 → 156.1. Ordinary early strategies are numerically unchanged.
- Independent paid-unlock frontier uses five budgets, ten routes, 30 seeds each, actual 0.05 timestep. It refutes perpetual espresso dominance while documenting high-budget capital still unrecovered at day 8.
- Existing `npm run balance` passed. Experiment TypeScript checks passed separately using compiler `--ignoreConfig` and Node types. No price/bonus/milestone changes made.
- Added `balance:lab`, `balance:frontier`, `balance:compare` scripts and strict paired artifact comparison tool. Current source/runner held stable until full matrix terminates.
- Next: await full matrix, run strict paired comparison, finalize results/report and rerun full checks against final files. Absolute-insolvency choice remains separate and pending.

## 2026-10-11 17:54 UTC — Reproducibility hardening before final evidence
- Byte-for-byte verified all 22 baseline gameplay source files against the recorded Git commit; `source-manifest.json` preserves per-file hashes. Candidate production changes are confined to economy.ts and kitchen.ts.
- Identified a harness isolation risk: layout height/kitchen stage are module globals, and first-day forecasts precede Sim's normal synchronization. A filtered/resumed run must not inherit prior scenario geometry.
- Each authoritative sample will explicitly reset fixed viewport and kitchen stage before forecasts; a contaminated-layout independence regression is required. Existing partial matrix is retained as pre-layout-fix evidence, not silently migrated. Final matrix restarts with a new design fingerprint.
- Added 8 comparison-validator tests covering incomplete results, differing design/timestep/seeds/assets, closing timeouts and ledger errors; all pass.
- Added representative 30-day cat/promotion/capital study, coordinated with the final layout-isolated runner. No production balance constants changed.
- Absolute-insolvency gameplay decision remains pending; continue all independent work.

## 2026-10-11 18:21 UTC — Long-horizon evidence complete; full matrix continues
- Final design v3 explicitly resets layout at each sample. Both before/after matrix runs at 50/98 matched completed scenario batches; all checks continue to pass. All-menu kitchen scenarios are materially slower than drink-only cases; keep polling actual shell sessions and resume identical commands if a per-run timeout occurs.
- Full current test suite: 466 passed, 4 opt-in long-generation tests skipped, 45 files passed. Build and separate experiment TypeScript checks passed (`logs/final-*`). Each skipped generator has its own explicit run; main matrix is the sole still-running one.
- Independent frontier: complete 10 scenarios × 30 seeds × 8 days. Main long horizon: complete 11 × 30 × 30; upgraded-espresso attraction supplement: complete 4 × 30 × 30. All use real 0.05 timing and current fingerprints, with no unsettled service.
- Thirty-day results preserve meaningful choices: ginger is negative versus low-margin starting espresso, but adds ~6,502 versus upgraded fast espresso; light promotion adds ~21,513, and their combination ~29,539. All 30 upgraded-espresso seeds finish ahead.
- First payback is not guaranteed durable: expanded ginger crosses in 28/30, but only 19/30 remain ahead by day 30. Both crossing and terminal/sustained outcomes are recorded.
- Added user-facing one-coin preparation-restock regression; all 10 integration tests pass.
- Remaining: await all 98 before/after batches; strict paired compare; final report, artifact packaging and final source/status review. Absolute-insolvency rescue-versus-reset decision remains pending; no rescue mechanism added.

## 2026-10-11 18:51 UTC — Matrix and independent verification
- Both final v3 matrices at 58/98 matching completed batches; zero settlement timeouts/accounting errors. Long kitchen/all-menu batches continue normally rather than being abandoned or thinned.
- Independent read-only review found no material reproducibility/accounting/fairness blocker. Baseline bytes match Git, source/design hashes match their intended versions, all completed records reconcile, and same-menu long-study controls match exactly.
- Independent verification covered 13,500 daily long-horizon records; maximum ledger residual below 2e-9. Billion-scale frontier residuals below 0.000092 coins are normal floating-point rounding.
- No additional production edits. Continue active shell-session polling; if timeout occurs, resume identical commands and immutable hashes. The original source snapshot and every completed checkpoint remain intact.
- Still pending: main matrix terminal completion, paired comparison, final report/package; user decision on absolute insolvency remains separate.

## 2026-10-11 19:17 UTC — Live checkpoint and exact recovery commands
- Both authoritative before/after runs now 80/98; latest completed scenario `expanded/mixed/noteLocal`. Counts advanced from 58 at 18:51 and 66 at 18:59. Zero completed-record settlement timeouts, accounting errors, or source/design mismatch failures.
- Current operation: continuing the already-running shell sessions to terminal state; no restart has been needed since final v3 launch. Preserve frozen game and runner files until completion.
- If interrupted, these exact commands resume completed scenario checkpoints without rerolling:

```sh
# Original baseline: source snapshot in the same cloud filesystem.
cd /workspace/shared/zeGame2-baseline-57df94e
ECONOMY_LAB=1 ECONOMY_LABEL=baseline ECONOMY_GIT_HEAD=57df94e60899a3067d1313a2980d32b4d591be48 ./node_modules/.bin/vitest run scripts/economy-lab.test.ts --silent=false --disableConsoleIntercept

# Candidate: existing main checkout, unchanged production/runner hashes.
cd /workspace/shared/zeGame2
ECONOMY_LAB=1 ECONOMY_LABEL=balanced ./node_modules/.bin/vitest run scripts/economy-lab.test.ts --silent=false --disableConsoleIntercept
```

- Never run two simultaneous writers for the same result label/path. Check the current session terminal status before restarting; a pending result is not a reason to duplicate it.
- On terminal completion, copy baseline JSON and summary from its snapshot to the main `docs/long-task/results/`, then run `npm run balance:compare`. Require both complete markers and exactly 98 scenarios before final reporting.
- Source/design guards must remain enabled. An intentional code change requires a new label and fresh evidence, not overwriting an old baseline.
- Absolute-insolvency decision still pending; no new gameplay introduced.
- Live execution-session confirmation at 19:17: baseline session 55149 and candidate session 18829 both running without errors, timeout, or resume. Active logs: `/tmp/economy-baseline-official.log` and `/tmp/economy-balanced-official.log`; copy terminal logs into this task's logs directory once both runs finish. Session identifiers are only useful while this executor remains alive; durable JSON checkpoints and the commands above are the restart mechanism.

## 2026-10-11 19:48 UTC — Final seven batches
- Both matrices at 91/98. Last added batch `expanded/all/clipStar` was written at 19:47:00 UTC in both result directories, verified from file metadata and active logs; no stall.
- Recent batches take about 197–211 seconds each. Seven remain. All completed records still pass accounting/source/design/settlement checks.
- Continue existing sessions; the two-hour per-run threshold is approaching. If it actually produces a terminal timeout, resume the exact frozen-source command above after verifying the prior writer stopped. Do not invent or assume a restart.
- Next remains terminal98/98 → strict paired comparison → final report/package → final checks. Absolute-insolvency feature decision is still pending and untouched.

## 2026-10-11 20:14 UTC — Last recovery probes still running
- Both runs are 96/98; all strategy comparison batches finished. Last completed checkpoint `expanded/all/cat-noteStar` was written at 20:02:54 UTC. Remaining: expanded scarcity recovery and poor-rating recovery.
- Scarcity is much slower than ordinary batches. Static source diagnosis: idle cooks repeatedly call `nextBatch`; `bakeryPlan` recalculates route-based `batchSeconds` for each bakery item every tick. Two cooks and seven bakery dishes make low-stock simulation expensive. Loops are bounded, sessions remain active, and no errors/timeouts have been reported.
- Do not change source or introduce caches in the frozen experiment. Geometry-keyed memoization with equivalence tests is an optional future performance task, not part of the current balance fixes.
- The nominal two-hour test threshold did not produce a terminal timeout; no resume has actually occurred. Continue polling these original sessions and preserve exact recovery commands above.
- Completion estimate has slipped; do not describe unfinished diagnostics or the pending insolvency decision as complete.

## 2026-10-11 20:24 UTC — Authorized audit reaches verified terminal state
- Both final matrices completed 98/98 and saved complete=true: 5,880 eight-day trajectories, 47,040 day records. Maximum ledger discrepancy 1.28e-10 coins; zero service-drain timeouts. Expanded scarcity batches took 724.6s baseline / 726.6s candidate.
- Actual execution outcome: after all synchronous work finished (~8,530s), Vitest reported its nominal 2h test timer. The original sessions ended; identical frozen-source commands then resumed/validated all existing checkpoints and exited0, 5/5 tests each in ~2.6s. No new seed draws, source changes, or missing batches. Original timeout logs and passing resume logs are retained under `logs/economy-*-full.log` / `logs/economy-*-resume.log`.
- Baseline raw+summary copied into primary results directory and copy SHA256 verified. `npm run balance:compare` passed: 98 matched scenarios; 2 changed, 96 unchanged. Additional full raw-object comparison confirmed those same two recovery cases are the only differences.
- Final checks rerun after all code was stable: 45 test files pass; 466 tests pass, 4 opt-in generators skipped by the ordinary test command. All four generators have completed independent runs. Build, existing balance regression and independent experiment TypeScript checks pass.
- Final Chinese conclusions written in REPORT.md. All requested experimental phases and authorized fixes are complete; absolute-insolvency emergency-supply policy remains a separate pending user decision and was not implemented.
- No commit, push, deploy, browser save access, or credentials. Final deliverable packaging and source/status verification follow; no simulation remains running.
- Final independent report review found no material corrections: complete98/98, exact two raw-trajectory changes, 62,940 recorded days, timeout/resume disclosure and pending product decision all verified.
- Delivery archive prepared at `/workspace/shared/tiny-bean-cafe-economy-audit-2026-10-11.zip`. It includes authoritative data, changed source/tests, tools, reports and verification logs; superseded pilots remain in the checkout but are excluded from the archive. The archive is an overlay for the recorded base commit, not a standalone full repository.

## 2026-10-11 20:27 UTC — Reopened strict total-duration acceptance
- Parent review correctly identified that equal180-second open windows with variable service drain do not satisfy strict equal total elapsed simulation time. Earlier completion wording is superseded; REPORT/PLAN updated accordingly.
- Daily endpoint trajectories cannot be truncated accurately at a shared instant; no interpolation or hourly-rate extrapolation will be used.
- Independent fixed-clock supplement is in development: actual Sim at0.05s, equal1800-second total clock per seed, natural180-second open/closing cycles,30 fixed seeds per representative route across all stages and cat/promotion combinations. Exact horizon stops without out-of-window sales; live inventory/WIP and unserved customers will be disclosed with accounting checks.
- Production code and all frozen original artifacts remain unchanged. Separate script/result paths, source hashes and atomic checkpoints will support recovery. Pilot timing will determine actual cost; initial estimate10–20minutes.
- Absolute-insolvency relief decision remains pending. Existing delivery ZIP is not the final revised deliverable; regenerate only after terminal validation.

## 2026-10-11 20:33 UTC — Strict-clock runs active
- Pilot passed: one1800-second seed took0.2s early upgraded espresso,0.6s mid mixed,4.0s expanded all. Independent accounting probe checked all36000ticks with max4.75e-11 residual; two reviews found no material accounting/time-budget defect.
- Frozen candidate20routes×30seeds active in session97666; baseline2recovery routes×30seeds active in session95592. New script only; production/original datasets untouched. Logs /tmp/economy-fixed-clock-balanced.log and /tmp/economy-fixed-clock-baseline.log.
- Resume after confirming old writer terminal: primary `FIXED_CLOCK=1 FIXED_CLOCK_LABEL=fixed-clock-balanced npx vitest run scripts/economy-fixed-clock.test.ts --silent=false --disableConsoleIntercept`; baseline snapshot same command with `FIXED_CLOCK_SCOPE=recovery FIXED_CLOCK_LABEL=fixed-clock-baseline`. New harness timeout86400000ms. Atomic source/runner/seed/scope-guarded batches.
- Strict-clock results describe terminal advantage, not first-payback timestamps; previous daily payback is explicitly only equal-open-window evidence.

## 2026-10-11 20:37 UTC — Strict-clock midpoint and aggregate checks
- Candidate11/20 complete, last expanded/fast; source/hash/accounting guards still pass. Mid/all batch133.8s is materially slower than drink-only routes, but progress is normal. Baseline recovery2/2 complete and terminal passing.
- Aggregate checks including the new fixed-clock unit tests and script typecheck completed with exit0 (session10418): npm test, build, balance, all experiment TypeScript checks, git diff --check. Final test counts updated in report after terminal dataset verification.
- Early upgraded espresso cat/noteLocal/combo all30/30 terminal-positive at exact1800s; paired gains1824.6/7212.4/9354.3coins, respectively. Do not extrapolate this to all menus or infinite time.

## 2026-10-11 20:44 UTC — Strict-clock acceptance reaches terminal state
- Candidate20/20 routes×30 seeds and baseline2/2 recovery routes×30 seeds finished, complete=true. All660 trajectories exactly36000ticks/1800s, no post-cutoff transitions or revenues. Candidate session97666 terminal5/5pass in599.39s; baseline session95592 terminal5/5pass in~5s. Logs persisted as logs/fixed-clock-balanced.log and fixed-clock-baseline.log. No simulation remains running.
- Independent reviewer recomputed all clock totals, assets, investment, ledger, summary intervals/paired effects and counts. Maximum independent ledger residual2.91e-10; no material correction. Candidate terminal589open/11closing; live food0–780coins cost explicitly excluded from net-liquid wealth.
- One-/nine-coin strict-time before/after profit0→1153.23 and0→3230.67;30/30positive each. Upgraded espresso attraction remains positive30/30, while all three expanded-white-coffee attraction paired intervals cross zero at1800s. REPORT now distinguishes this from longer equal-open-window observations.
- Aggregate validation after new script:46files470tests pass,5opt-in generators skipped by ordinary command but all actually executed separately; build, balance, standalone script typecheck and diffcheck pass, exit0.
- All previous authoritative result hashes reverified unchanged before appending new fixed-clock result hashes to RESULTS-MANIFEST.json. Production remains frozen. Updated Chinese report, reproduction, plan and delivery notes; representative20-route strict coverage is not described as a full98-route equal-total-time rerun. Exact first-payback time is not measured by this supplement.
- Absolute-insolvency product choice remains pending; no rescue feature or unapproved behavior added. Revised artifact packaging follows.
- Revised delivery archive: /workspace/shared/tiny-bean-cafe-economy-audit-2026-10-11-fixed-clock.zip. It supersedes the earlier ZIP, includes the exact-clock report/script/raw data/logs, and excludes pilot results. ZIP CRC and authoritative embedded file bytes are verified after final report updates.

## 2026-10-12 00:54 UTC — Approved one-bean emergency extension started
- Parent supplied explicit user approval for one-bean help only when normal operations cannot recover. Existing uncommitted source/tests and all original datasets preserved.
- Implement new isolated recovery module and preparation entry,30-seed targeted exact-clock evidence, then full checks and updated conclusions. Eligibility checks all unlocked recipes (not just selected menu), affordable deficits, paid shelf/WIP, available or freely obtainable goal rewards, and valid unlocked espresso.
- Action will add exactly1bean and enable espresso without removing existing selections; no cash/debt, automatic sales or price changes. Immediate repeat must fail. Conservative free-owned-comfort feasibility bound will fail closed rather than grant while a reward might be reachable.
- Previous result hashes remain historical; new production fingerprint and rescue grant accounting will be stored separately.

## 2026-10-12 00:59 UTC — Eligibility and UI frozen
- New recovery.ts pure predicate/action independently approved.36core+4bilingual UI tests pass; tsc passes. No existing economy/kitchen fixes altered. UI in preparation dialog; successful claim shifts keyboard focus back to espresso selection.
- Review corrected a genuine migration case: suspended legacy pastry shelf with kitchen=false cannot be sold and must not block aid; preserved unchanged while emergency bean permits espresso. Usable shelf and all outstanding production remain blockers.
- No menu-size cap exists, so adding existing espresso requires no removal. Repeated clicks/reloaded bean state deny; after a genuinely repeated deadlock another single bean is permitted, no lifetime quota added.
- Free day goals are excluded; owned comfort uses a fail-closed upper bound with documented rare impossible-placement limitation. No unowned paid reward requirements assumed free.
- Targeted independent simulation runner is being completed; source will be hash-guarded, 30seeds each, strict1800seconds with grants separated from earnings.

## 2026-10-12 01:02 UTC — Thirty-seed rescue results and remaining validation
- Final runner scripts/economy-recovery.test.ts pilot terminal4/4pass in6.46s. Full paired experiment session87538 active, /tmp/emergency-recovery.log,4/5batches complete; expanded mixed remaining. Resume only after previous writer stops: `npm run balance:recovery` (EMERGENCY_RECOVERY=1, label emergency-recovery). New dataset only, source/runner hashes frozen.
- Both absolute-insolvency fixtures30/30 recover with exactly1bean. Earned profit excluding gift at1800s: espresso-selected661.37 [642.56,680.17], espresso-off-menu1153.23 [1091.67,1214.80]; no-aid controls0. First sale4.65–6.90s and4.65–29.65s. Early/mid normal0grants and30/30byte-identical pairs.
- Aggregate test/build/balance/typecheck running session55938; separate emergency-final-* logs preserve prior frozen validation evidence. Independent final raw-data review pending terminal result. No production changes since freeze.

## 2026-10-12 01:06 UTC — Approved extension completed and independently verified
- Full emergency experiment session87538 terminal4/4pass in172.67s;5/5paired cases complete.300trajectories each36000ticks/1800s. Both stranded groups30/30 recover with exactly1bean; all90normal pairs0grants and byte-identical observed results/state/Sim snapshots. Independent recomputation confirms clock, all reported intervals/first-sale ranges, current hashes and zero ledger residual.
- Aggregate session55938 terminal exit0:49testfiles513tests pass,6opt-in generators skipped by default; this new generator executed fully, older five completed on their respective recorded frozen versions. Build,balance,strict new experiment typecheck including unused checks and git diff --check pass. Separate emergency-final-* logs retained.
- Historical result file hashes all reverified unchanged. RESULTS-MANIFEST now labels previous pending policy historical and records approved extension, while emergency-source-manifest records new source/UI/test fingerprints. No existing economy.ts/kitchen.ts edits altered, no HEAD change, commit,push,deployment or real-save access.
- PLAN,PROGRESS,REPORT,RECOVERY-DECISION,README and DELIVERY updated. Independent review requested clearer historical labels in REPORT sections1/7; corrected so old470-test/source claims cannot be confused with new513-test/current-source evidence.
- Final delivery archive /workspace/shared/tiny-bean-cafe-emergency-recovery-2026-10-12.zip contains complete prior audit overlay plus this approved extension. Earlier2026-10-11 archive remains unchanged for historical reproduction. Verify ZIP CRC/all embedded bytes after writing. No simulation remains running; no product decision remains pending for this approved one-bean rule.

## 2026-10-12 01:08 UTC — Reopened furniture reachability false denial
- Parent correctly rejected the conservative comfort upper-bound limitation as unfinished: truly unplaceable owned furniture must not prevent one-bean help. Prior completion/ZIP is superseded pending this correction.
- Replace unproven positive comfort bound with actual legal arrangement reachability using existing canPlace rules, free storage/repositioning and owned style switches; no new game rule. Core implementation and independent solver review underway.
- Preserve previous emergency-v1 raw results and archive. Run a fresh source-hashed v2 label and add30seed unplaceable-furniture recovery comparison after the new source freezes. Re-run full affected checks and rebuild package before completion.

## 2026-10-12 01:12 UTC — Exactness passes; performance optimization required
- Exhaustive canPlace-based layout solver and45core/UI tests passed independent correctness review. Concrete impossible case: main room art_cat8+art_landscape4+poster_bakery4 has16owned comfort but only12can coexist; relief must be allowed. Actual legal witnesses with garland/open reading room block relief.
- Independent performance audit prevents premature freeze: allowned low-comfort kinds at maxregions/tables repeated~72.66ms (p95~80.15ms), hard impossible six-wall-kind check~107.59ms. This can stutter prep UI despite no every-frame UI call.
- Implement exact dependency-key memo and earlier positive witnesses; optimize equivalent search states if cold negatives remain slow. No timeout/node cutoff may classify unknown as unreachable. Rerun independent benchmarks and cache-invalidation coverage before source freeze/newv2simulation.

## 2026-10-12 01:16 UTC — Exact layout rule frozen; v2 runs active
- Independent grouping/cache correctness review passed. Actual impossible layouts now permit aid; actual legal free-reward witnesses block. Tests include main-only three-artwork16owned/max12reachable, max-table piano, garland/rearrangement/reading-room witnesses and mutable cache dependencies.
- Performance audit final: cache-evicted hard-wall mean0.769ms/max0.980ms; all low-comfort owned/maxregions mean2.817ms/max4.904ms. Warm means0.025–0.056ms;1024wall-subset sweep162ms total, slowest3.27ms. These are measured inventories, not universal complexity guarantees. No arbitrary search cap;32-entry result eviction only. Event-driven UI, no frame loop. Full reproduction in logs/emergency-layout-performance.txt.
- V2 pilot5/5pass6.57s. Full sixcase×30seed×2policy experiment active session84485, label emergency-recovery-v2; `npm run balance:recovery` now uses v2 label. Expected360trajectories, including new impossible-furniture case. Previousv1data and archive remain unchanged.
- New aggregate checks active session66019, logs/emergency-v2-final-*.log. Resume full simulation only after original writer terminal with same frozen source/runner/seed command.

## 2026-10-12 01:20 UTC — V2 verified terminal completion
- Full v2 session84485 exited0,5/5tests in177.06s;6/6paired cases complete.360exact1800-second trajectories:90rescue runs exactly1bean each and all recover,90normalpairs0grants/full byte equality. New30seed unplaceable-comfort fixture recovers; goal remains inaccessible and furniture unchanged, no goal income. Shared fivev1case batches match v1exactly.
- Independent final raw review recomputed all clocks, source/runner fingerprints, every cash/operating ledger (zero residual), outcome counts and provenance; no material blocker. Accurate cold/warm performance evidence and cache dependency checks also pass, without cutoff or approximation.
- Aggregate session66019 exited0:49files520tests pass,6opt-in skips; new generator fully run5/5. Build,balance,strict script types+unused checks,diffcheck pass. No active simulations.
- REPORT,PLAN,RECOVERY-DECISION,README,DELIVERY now describe exact reachable-layout rule and completedv2 evidence, not the superseded comfort caveat. Historical source/results/archives remain intact; updated manifests distinguish v1andv2.
- Revised final archive /workspace/shared/tiny-bean-cafe-emergency-recovery-2026-10-12-v2.zip supersedes prior emergency ZIP. It contains complete audit overlay, v1/v2raw evidence, final source/tests, exact-layout performance reproduction and validation logs. Verify CRC/every embedded file after writing. No commit,push,deploy or browser-save modification; original HEAD retained.

## 2026-10-12 01:41 UTC — User-authorized publication preparation
- User approved commit and normal push of this task to lalaze/zeGame2 joyful-sloth. No force push, new credentials or permissions. Remote ref checked at original57df94e; no upstream advance. No AGENTS.md found in applicable workspace/repository ancestry.
- Independent audit: all92final-v2archive entries match current checkout; no unrelated edits, symlinks or credential-pattern findings in intended docs/logs. Original sources/data preserved.
- Repository evidence packaged as19deterministic gzip files:96,488,217rawbytes to7,530,742compressedbytes, original hashes unchanged. Added COMPRESSED-EVIDENCE manifest and npm run balance:restore; fresh temporary extraction/hash validation,idempotence and refusal to overwrite modified evidence pass. Expanded raw/pilot/patch files remain local ignored; no caches or generated build/dependencies staged.
- Existing git authentication can read remote. gh CLI reports not logged in; use existing GitHub connector for CI read checks, no new auth. Commit/push pending final staged review and local checks.
- Publication checks completed exit0: npm test520pass/6skip, build, balance, historical comparison98matched/2changed, lossless restore+hash check. Updated reproduction instructions distinguish current recovery-v2 from old generators and prohibit overwriting historical output. Scoped .gitattributes preserves trailingblankEOF bytes in fingerprinted runner/logs without suppressing other whitespace errors.
