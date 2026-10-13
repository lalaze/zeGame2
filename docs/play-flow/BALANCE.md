# Traffic-wave economic validation

Status: complete. Retain the 10% candidate with the disclosed high-pressure bakery tradeoff. Technical integrity checks pass; the strict original per-cell gate result is **not an all-pass** (3 flagged primary cells remain).

## Result

- All 78 cells completed: 39 scenarios × 2 horizons × 30 paired seeds, 2,340 pairs / 4,680 simulations. Startup/first-update equality, source/harness fingerprints, clocks, demand counters, cash and consumed-input wealth accounting all verified.
- Two 180-second early/rush profit flags (bakery −6.96%, community −5.45%) reflect different realized VIP payouts: every seed served the same 9 or 26 customers, ingredient expense was identical, and accepted-food cost was zero. Their profit intervals include zero; independent holdout does not reproduce the losses. Keep the original flags visible.
- Mid/rush bakery has a real short-window stockout/rating tradeoff: primary rating −0.1173 stars (95% CI −0.1976 to −0.0370), lost rate +1.93pp (CI +0.72 to +3.15). Independent holdout repeats the direction (−0.0987 stars, +1.65pp). One additional paid pantry restock does not remove it. Evidence is consistent with batch/shelf supply timing rather than pending-accounting or queue-delay artifacts.
- In the 39 original 1,800-second cells, mean operating-profit changes span −2.26% to +1.17%; no cell crosses the original review gates, and all treatment mean operating profits are positive. This supports **no clear sustained overall operating-profit deterioration in the tested scope**, not an equivalence guarantee or a claim of no local cost.
- Retain the near-threshold independent early/rush bakery 1,800-second rating decline: −0.098 stars (CI −0.145 to −0.051). Do not claim all long-run service outcomes are cost-free.

See [all 78 primary cells](BALANCE-waves10-full-v1.md), [individual flag dispositions](BALANCE-FLAG-REVIEW.md), [independent holdout](BALANCE-HOLDOUT-RESULTS.md), and [paid-restock diagnosis](BALANCE-MECHANISM-RESULTS.md).

## Frozen experiment

See [BALANCE-PROTOCOL.md](BALANCE-PROTOCOL.md). The matrix has 39 scenarios (36 focused paid route portfolios, fresh-save, and signature-heavy base/rush sanity panels), two exact horizons, and 30 paired seeds: 2,340 paired observations, 4,680 total simulations. The original cafe-style helper and old balance benchmark are unchanged. Baseline and treatment startup states and first-update fingerprints must match exactly.

The short window stops after exactly 180 seconds open. The 1,800-second window counts closing drain in elapsed time and automatically restocks/reopens under the helper's existing policy. Endpoints are censored: pending guests receive no invented sale or terminal drain. Lost demand includes missed guests, full-door losses, and queued guests removed at closing. Primary observed loss rate retains pending guests in the denominator; resolved-only and all-pending-lost sensitivities accompany it.

For the fresh-save panel, starter pantry value is included in initial wealth but initial cash remains zero. Tutorial goal payouts are not injected. Signature-heavy scenarios use the paid mid coffee portfolio and three coffee recipes (beans1; beans1+milk2; beans2+milk1), purchased ingredients and paid quarter-serving trials; remaining fractional milk remains a real asset. Trial consumption is reported as startup expense and included with setup capital solely for the unchanged wealth identity.

Peak queue is sampled at each 0.05-second tick. Mean/P95/max service waits condition on guests actually served. Calendar-phase diagnostics use the same 90-second bins for both versions. A full cycle's wave multiplier integrates to 90 seconds, so a full 180-second open window has 180 multiplier-seconds at either amplitude. This does not guarantee identical realized customer counts: endogenous reputation, paid promotion/care depletion, renewal jitter and RNG path divergence can differ. A carryover endpoint may include an incomplete final open cycle.

## Candidate history (all results retained)

- 20% amplitude pilot, two pre-registered disjoint seeds: 11 of 18 scenario/horizon cells crossed at least one review threshold. The existing unchanged 12-seed menu benchmark also failed its high-pressure espresso-versus-latte ranking (candidate 514 versus 542; baseline 507 versus 498). This candidate was rejected for final testing. Full pilot rows, paired uncertainty, source snapshot and failed suite log are retained under `evidence/waves20-*`.
- 10% amplitude pilot, identical two seeds and scope: 7 of 18 cells crossed thresholds. The old menu benchmark passed (514 versus 505), and fresh-save/mid-cats flags disappeared; signature-heavy pilots were noisy and several worsened. No thresholds or scenario choices were changed. The coordinator froze 10% and requested the full 30-seed matrix rather than selecting an amplitude against two-seed noise. Results are retained under `evidence/waves10-pilot-*`.

Pilot confidence intervals use t(df=1); full intervals use t(df=29). Intervals describe paired differences without multiplicity correction. A threshold crossing remains visible even if its interval includes zero. No aggregate-only pass is permitted.

## Reproduction and integrity

- Generator: `scripts/play-flow-balance-lab.ts`; contract tests: `scripts/play-flow-balance.test.ts`.
- Independent reader: `scripts/play-flow-balance-verify.ts`; tests prove tampered cash, assets, demand and exposure identities are rejected.
- Set `PLAY_FLOW_LAB=1`, `PLAY_FLOW_LABEL=<unique-label>`, and optionally `PLAY_FLOW_SHARD=0..2`, `PLAY_FLOW_SHARDS=3`; run `vitest run scripts/play-flow-balance.test.ts --disableConsoleIntercept --maxWorkers=1` in each tree. Pilot additionally sets `PLAY_FLOW_PILOT=1`.
- Baseline writes to the treatment evidence directory using `PLAY_FLOW_RESULTS_DIR`. Only identical new harness/protocol files are copied to baseline; no baseline gameplay files change.
- Each raw file carries exact seeds/scope, complete startup states and hashes, game-only source hash, original-helper/harness/protocol hashes. Resume rejects mismatches. UI-only changes do not invalidate gameplay evidence.
- `evidence/integrity.json` records baseline game files checked against the reviewed manifest and original helper/benchmark hashes. Archived traffic source and the baseline-to-treatment Sim patch preserve the rejected candidate and make the small treatment change inspectable.
- Merge complete shards with `PLAY_FLOW_MERGE=<prefix> vitest run scripts/play-flow-balance-verify.test.ts`; compare with `PLAY_FLOW_BASELINE=<baseline-prefix> PLAY_FLOW_VERIFY=<treatment-prefix> vitest run scripts/play-flow-balance-verify.test.ts`.

## Exact scope, hashes and checks

- Baseline game hash: `c81346116b3956830810fdd5ac3764e3de4c876a179563ea653a0385b8b7a893`.
- Final 10% game hash: `050f12965e50cf3edc0a2a3b8916b69a9222c4c1c0e5b4e74376b107dc6b84d9`.
- Rejected 20% game hash: `befd511da7a1c5e5a4757fac4a2862178d34b8c02b4a4bdb7efc2596a3527f5e`.
- Only non-test gameplay differences from control: `sim.ts` and new `traffic.ts`. `candidate-source-manifest.json` verifies archived candidate reconstruction; `integrity.json` verifies every baseline game file against the reviewed manifest and the untouched old helpers/benchmark.
- Primary: 39 scenarios × 2 horizons × 30 seeds × 2 versions = 4,680 runs. Holdout: 3 scenarios × 2 horizons × 30 independent seeds × 2 versions = 360 runs. Paid-restock mechanism: 2 scenarios × 1 horizon × 30 fixed holdout seeds × 2 versions = 120 runs. Preserved pilots: 9 scenarios × 2 horizons × 2 pilot seeds × 3 versions = 108 runs. Total retained economic simulations: 5,268, excluding small contract tests and the old benchmark.
- Main, holdout and mechanism use independent manifests and exact recorded seed lists. The full experiment uses `(0x706c6179 + i*2654435761)>>>0`; holdout uses `(0x686f6c64 + i*2654435761)>>>0`; pilots use `[0x70696c6f,0x74657374]`.
- Contract suite: four new test files, 9 tests passed and 8 opt-in runs skipped when run without lab flags. TypeScript check passed. Full-data reader: 5 tests passed, one merge-only test skipped. Old 12-seed balance benchmark passes unchanged at 10%.
- Runtime: baseline slowest shard 1,439s; treatment exact durations remain in per-shard logs. Parallel shards change neither seeds nor clocks. No gameplay or benchmark changes were made by the balance verification work; no commit or push was made.

## Suggested short release note

“Gentle ±10% traffic waves retain the average arrival budget. Across 4,680 fixed-seed main simulations we found no clear sustained overall operating-profit decline in the tested routes and stages. High-pressure bakery play still has a small short-window stockout/rating tradeoff, also seen in an independent holdout; a single extra pantry restock does not remove that production-timing limit.”
