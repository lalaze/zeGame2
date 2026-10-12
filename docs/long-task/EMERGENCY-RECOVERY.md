# One-bean emergency recovery: paired simulation evidence

## Version 2 final evidence and preserved history

Historical version 1 raw data, summaries, verification and logs remain unchanged under the unversioned emergency-recovery names. Its 300 trajectories cover the five original cases and the prior conservative comfort gate. The original runner is preserved byte-for-byte inside tiny-bean-cafe-emergency-recovery-2026-10-12.zip. Version 2 repeats those cases on the revised source and adds the genuine comfort-placement deadlock. Historical version 1 is not current-source evidence.

Historical v1 production hash: `9866eacb3962a968dfd53f648a8d2cb8d251ecd2f9bd1292b617c155204fc847`. Historical v1 runner/helper hash: `9fe90898603ed7d2ce2a629bc596dc7a9f652a4eba70c93f40eaa00308beb94d`.

## Result

Approved one-bean aid restores economically stranded cafes in all 90 tested rescue trajectories, including when espresso was initially absent from the menu. Each received exactly one bean and made sales within the fixed observation window. Matched no-rescue controls made no sales and remained at zero resources.

- Espresso already selected: earned profit excluding the donated bean 661.37 [642.56, 680.17] coins at 1,800 seconds. First sale occurred between 4.65 and 6.90 seconds.
- Espresso initially off-menu: earned profit excluding the donated bean 1,153.23 [1,091.67, 1,214.80] coins. First sale occurred between 4.65 and 29.65 seconds. Existing latte selection was preserved when espresso was enabled.
- The genuine comfort-placement deadlock also recovers in all 30 seeds with one bean; its matched controls cannot make sales or earn the inaccessible goal. Its exact terminal profits and intervals appear in the outcome table.
- Normal early, mid and expanded policies received zero beans. All 90 seed pairs produced byte-identical observed economic results, settled reports, terminal serialized game states and terminal Sim snapshots with and without eligibility polling.

Exactly one bean per successful action is the rule. Exactly one action per rescued trajectory is an observed result, not a lifetime quota: a cafe can qualify again only after becoming genuinely stranded again. The new bean itself prevents repeated clicks or reloads from accumulating a stockpile.

## Design

- Six cases × 30 fixed seeds × two policies = 360 trajectories, each exactly 1,800 total simulation seconds / 36,000 real Sim updates at 0.05 seconds. Both sides share the exact starting state and seed.
- The two exhausted-goal cases start with zero cash, every pantry ingredient at zero, exhausted one-off goals and an already owned espresso recipe. The off-menu case additionally owns americano/latte and selects latte only. These are controlled late-insolvency fixtures, not claims about a fresh new game with unclaimed goal rewards.
- Representative normal fixtures are early espresso, mid espresso+roll and expanded flatwhite+cookie. They retain the original common stage cash/assets from the frozen lab helper. No costs or existing ownership are altered to make rescue eligibility more likely.
- The rescue policy polls canEmergencyRestock each tick after any natural day settlement and calls emergencyRestock only when eligible. The control never calls the new API. Normal pairs therefore test 36,000 polling opportunities each without an economic effect.
- Each opening lasts 180 seconds; accepted service then drains naturally. Preparation/settlement takes zero simulated time. No grant, purchase, forced settlement, service drain or extra revenue is added after the exact cutoff.
- A successful action must add exactly one bean, preserve cash/revenue/totalEarned and other ingredients, preserve all existing menu selections, enable espresso, and immediately reject a second action without mutation.
- No clicks, investment, paid advertising, adoption, reward claims, debt, offline income or other rescue resources are added. Forecast stock purchases use the real game restock function.
- Source and runner hashes guard atomic per-case checkpoints and resume. The frozen earlier experiments are neither rewritten nor reinterpreted as current-source evidence. The new comparison toggles rescue on the same new source; it is not a rerun of the original source tree.

## Aid accounting

The bean is an in-kind contribution valued at its purchase cost of one coin. It is never sales revenue and never enters totalEarned. When consumed, the game expenses its ingredient cost normally.

- Net cash-plus-pantry/prepayment resource gain = operating profit + granted ingredient value.
- Earned net profit excluding aid = resource gain − grant value = operating profit in these no-investment fixtures.
- Cash ledger: final cash = initial cash + actual sales revenue − ingredient purchase spending. The in-kind bean never appears as cash.
- Operating profit includes every closed report plus the live unfinished day exactly once. Food on the shelf, in kitchen production or accepted undelivered orders remains expensed; its cost is a separate diagnostic and is never credited as future sales or salvage.
- A successful seed therefore has total resource gain exactly one coin higher than its earned profit in this experiment. Claims below use earned profit to avoid presenting the grant itself as business income.

## Paired outcomes

Intervals are descriptive Student-t mean intervals using t(29)=2.04523. Shared seeds do not imply identical customer draw paths after the rescue changes service. No multiple-comparison correction or general-optimality claim is made.

| Case | Beans granted per rescued/polled seed | Control earned profit | Rescue/polled earned profit, 95% interval | Total resource gain including aid | Recovery/byte-equality result |
|---|---:|---:|---:|---:|---|
| insolvent/espresso-on-menu | 1.00 | 0.00 | 661.37 [642.56, 680.17] | 662.37 | 30/30 recovered |
| insolvent/espresso-off-menu | 1.00 | 0.00 | 1,153.23 [1,091.67, 1,214.80] | 1,154.23 | 30/30 recovered |
| insolvent/comfort-placement-deadlock | 1.00 | 0.00 | 661.37 [642.56, 680.17] | 662.37 | 30/30 recovered |
| normal/early | 0.00 | 928.27 | 928.27 [912.40, 944.13] | 928.27 | 30/30 byte-identical |
| normal/mid | 0.00 | 1,769.60 | 1,769.60 [1,721.31, 1,817.89] | 1,769.60 | 30/30 byte-identical |
| normal/expanded | 0.00 | 66,271.87 | 66,271.87 [65,465.74, 67,077.99] | 66,271.87 | 30/30 byte-identical |

## Persistence and guard coverage

The quick regression suite uses the actual serialize/deserialize functions: the granted bean, exhausted goal state and enabled espresso survive reload, the existing latte remains selected, no cash/revenue is added, and a second grant is rejected without mutation. This is a serialization roundtrip test, not a browser save interaction.

Production gate tests separately cover accessible off-menu recipes, affordable full recipes, paid output, claimable/free-achievable goals, malformed state and inaccessible legacy shelf stock. The experiment is not a replacement for those eligibility tests. Version 2 replaces the historical owned-comfort upper-bound approximation with actual legal placement reachability. The added comfort-goal fixture owns art_cat (8), art_landscape (4) and poster_bakery (4), but only two height-3 paintings can fit the main room’s two 4-by-5 wall panels. Its legal maximum comfort is 12, below the current goal of 15; aid must not be withheld for the unreachable theoretical total of 16.

## Verification and files

- Independently reconstructed all 360 exact clocks and operating/cash ledgers. Maximum residual: 0 coins.
- The opt-in experiment completes all six paired cases. Four quick tests cover contribution accounting, the legal-placement deadlock, save/reload and deterministic normal-policy equality. Strict standalone TypeScript, including unused-local/parameter checks, passes.
- The version 2 final-source pilot passed all five tests in 6.57 seconds; the full run passed all five tests in 177.06 seconds. Pilot rows are not used for the 30-seed inference.
- New raw/summary/verification data: results/emergency-recovery-v2.json, emergency-recovery-v2-summary.json and emergency-recovery-v2-verification.json.
- Pilot data are separately named emergency-recovery-v2-pilot*.json. Execution logs use the emergency-recovery-v2 prefix.
- The experiment edits no production source or earlier economy-lab/fixed-clock runner. The recovery runner is versioned from v1 to v2, with v1 preserved in the historical ZIP. Historical raw, summary and verification files were checked byte-for-byte against that ZIP and remain unchanged. All five common case batches are also byte-identical between v1 and v2 results.

Run or resume:

```sh
EMERGENCY_RECOVERY=1 EMERGENCY_RECOVERY_LABEL=emergency-recovery-v2 npx vitest run scripts/economy-recovery.test.ts --silent=false --disableConsoleIntercept
```

Quick tests / strict typecheck:

```sh
npx vitest run scripts/economy-recovery.test.ts
npx tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types node --skipLibCheck --strict --noUnusedLocals --noUnusedParameters scripts/economy-recovery.test.ts
```

Current production SHA256: `4b3bbcd6bde58bd65e86851f465292e28b477d0b2b6e78fd7b04b5cecc2cc220`.
New runner/shared-helper SHA256: `79a3428846e53cc878a7914085dd4581d21c30203dc2e2dbd19e881609f9cac5`.
Historical fixed-clock candidate production SHA256 retained in prior data: `0b73358c463ed8805ac4d16e7d0c831eec28bfed99fb0b5b19b7156422bd76cf`.
