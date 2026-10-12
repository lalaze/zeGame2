# Reproduce the economy audit

## Git checkout: restore compact evidence first

Authoritative raw JSON is committed as deterministic `.json.gz` files (about8MB total compressed, rather than134MB including discarded pilots). Restore it before using dataset-dependent commands:

```sh
npm run balance:restore
node scripts/restore-economy-evidence.mjs --verify-only
```

`COMPRESSED-EVIDENCE.json` verifies both compressed and original SHA256/byte counts. Restoration validates every file before writing and refuses to overwrite modified JSON. Expanded JSON, pilot/pre-layout runs and the redundant patch export stay local and ignored. This changes packaging only; the original numerical data and hashes are unchanged.

All commands run in the existing cloud checkout. They do not open a browser, touch a player save, access credentials, commit, push, or deploy.

## Current-version validation

```sh
npm run balance:restore
npm test
npm run build
npm run balance             # existing historical menu/clicking regression
npm run balance:compare     # compare restored historical datasets without simulating new gameplay
npm run balance:recovery    # current v2 source, six paired cases, label emergency-recovery-v2
```

`npm test` skips six opt-in expensive generators. Their completed evidence is committed; only the recovery-v2 generator describes the latest source. The older `balance:lab`, `balance:frontier`, `balance:long`, `balance:long-supplement` and `balance:fixed-clock` commands are historical-runner entry points, not commands to run indiscriminately over the restored evidence. Some default labels reject changed source; the frontier writer can replace its fixed output. Never run those old writers in a directory containing evidence you want to preserve.

## Exact historical source reproduction

The pre-fix reference is `57df94e60899a3067d1313a2980d32b4d591be48`. Create a disposable source directory in the same filesystem; do not overwrite the working checkout or restored data:

```sh
ROOT="$PWD"
BASE="$(mktemp -d /tmp/tiny-bean-baseline.XXXXXX)"
git archive 57df94e60899a3067d1313a2980d32b4d591be48 | tar -x -C "$BASE"
ln -s "$ROOT/node_modules" "$BASE/node_modules"
cp scripts/economy-lab.ts scripts/economy-lab.test.ts "$BASE/scripts/"
(cd "$BASE" && ECONOMY_LAB=1 ECONOMY_LABEL=baseline \
  ECONOMY_GIT_HEAD=57df94e60899a3067d1313a2980d32b4d591be48 \
  ./node_modules/.bin/vitest run scripts/economy-lab.test.ts --silent=false --disableConsoleIntercept)
```

For the October11 pre-rescue candidate, make a second disposable export of the same base, then copy only the checked-in `src/game/economy.ts` and `src/game/kitchen.ts` over its originals; those two fixes are unchanged by the rescue extension. Do not add `recovery.ts` to that historical source tree. Copy the applicable frozen experiment scripts, use a separate output directory and compare its production fingerprint with the recorded `0b73358c...` before trusting reproduction. For emergency-v1, use its preserved original delivery archive; current v2 changes furniture reachability and its runner case catalog.

For exploratory runs of an older generator against new gameplay, always use a disposable copy and a fresh output label when supported. Such a run is new evidence, not a reproduction of historical source. Do not bypass fingerprint checks or overwrite restored datasets. The uncompressed SHA256 values in RESULTS-MANIFEST.json remain authoritative.

## Resume and termination

Every completed scenario is a 30-seed atomic checkpoint. Run the identical command from the identical source/runner to resume skipped completed batches. A source or experiment-design mismatch stops safely; do not bypass the guard. For intentional new source, use a fresh label, e.g. `ECONOMY_LABEL=balanced_v2 npm run balance:lab` and compare explicitly with `node scripts/compare-economy.mjs baseline balanced_v2`.

`ECONOMY_FILTER` restricts IDs by substring, e.g. `ECONOMY_FILTER=early/initial npm run balance:lab`. Filtered output is partial until all 98 scenarios exist. Remove the filter and rerun to finish. Individual simulations drain accepted service after the fixed 180-second open window and fail verification if they cannot settle within the bounded closing window. The long test timeout is two hours; an interruption still retains completed scenario checkpoints.

The supported continuation mechanism here is polling shell process sessions to terminal exit, with local durable checkpoints for restart. There is no separately installed scheduler or promise that an abandoned shell will continue after its executor is destroyed. `PROGRESS.md` records active phases, logs and recovery steps.

## Evidence files

- `results/baseline.json`, `balanced.json`: raw 30-seed trajectories and full daily reports; final `complete: true` is required.
- `results/*-summary.json`: per-scenario distributions, investment comparisons and censored payback.
- `results/comparison.json`: strict paired before/after comparisons, including unchanged-scenario counts.
- `results/investment-frontier.json`: paid prerequisite/kitchen route setup, analytical screening and representative 30-seed simulations.
- `logs/`: baseline/candidate test, build, regression and long-run logs.
- `METHODOLOGY.md`: accounting, fairness and interpretation.
- `INVESTMENT-FRONTIER.md`: independent progression/dominance evidence.
- `LONG-HORIZON.md`, `LONG-HORIZON-SUPPLEMENT.md`: 30-day payback and reversal checks.
- `RECOVERY-DECISION.md`: absolute-insolvency gameplay choice, separate from the fixed restock defect.
- `REPORT.md`: final findings and limitations, written after terminal results are verified.

Pilot 0.1-second data is retained as explicitly named pilot material. Authoritative matrices use the actual application step of 0.05 seconds. All fixture endowments, fixed seeds, open durations and stock/capital policies are in raw metadata.

## Strict equal-total-time supplement

The original98-scenario matrix and30-day studies equalize daily open windows; their closing durations differ. They cannot alone establish strict same-total-time comparisons. An independent supplement uses exactly1800 simulated seconds (36000 updates at0.05 seconds), including natural closing service. It stops without post-horizon settlement, sales or purchases. See FIXED-CLOCK.md for terminal accounting, scope and results.

```sh
npm run balance:fixed-clock
# Original gameplay snapshot, recovery-only before comparison:
# from /workspace/shared/zeGame2-baseline-57df94e after copying the exact new runner
FIXED_CLOCK=1 FIXED_CLOCK_SCOPE=recovery FIXED_CLOCK_LABEL=fixed-clock-baseline npx vitest run scripts/economy-fixed-clock.test.ts --silent=false --disableConsoleIntercept
```

Resume the identical command only after the previous writer exits. Source/runner/seed/scope fingerprints must match; do not overwrite old evidence to bypass a mismatch. The fixed-clock supplement reports terminal advantage and unfinished-food diagnostics, not exact first-payback timestamps. Daily payback in older studies remains an equal-open-window measurement.

## Approved one-bean emergency recovery (2026-10-12)

The preparation dialog now offers a one-bean action only when normal recovery is unavailable. It enables already-owned espresso without dropping menu choices. See RECOVERY-DECISION.md for eligibility, repeated genuine insolvency and exact free-comfort layout reachability; EMERGENCY-RECOVERY.md contains seeded evidence.

```sh
npm run balance:recovery
npx vitest run src/game/recovery.test.ts src/ui/recovery.test.ts scripts/economy-recovery.test.ts
```

The final v2 experiment, including an owned-but-unplaceable comfort-goal fixture, uses six paired cases ×30 seeds ×2 policies =360 real1800-second trajectories. Compare calling the new eligibility/action API with not calling it under the same new source. It separately records the one-coin in-kind bean grant; the grant is not sales revenue or earned profit. Normal-route pairs require zero grants and byte-identical complete observed trajectories, serialized state and Sim snapshots. Atomic per-case checkpoints refuse changed source, runner or seeds.

Previous baseline/balanced/fixed-clock/frontier/long-horizon files are historical frozen evidence, not results generated by the new recovery version. Their hashes are retained. Because adding recovery.ts changes the production-source fingerprint, do not resume those old labels in the new checkout or overwrite the datasets. To reproduce the old revision, use the original2026-10-11 fixed-clock delivery overlay on the recorded base commit in a separate disposable directory; the new extension uses its own `emergency-recovery-v2` label; the first emergency version remains preserved under `emergency-recovery` and its original delivery ZIP. Neither command changes a real browser save.
