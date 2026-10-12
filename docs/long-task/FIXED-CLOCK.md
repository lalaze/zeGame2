# Exact 1,800-second economy comparison

## Findings

All routes were rerun against the real simulation for exactly 1,800 total elapsed seconds, including closing service. This is an independent fixed-clock experiment, not a rescaling of day-end summaries. The candidate has 20 routes × 30 seeds; the immutable baseline has the same two recovery routes × 30 seeds. All 660 trajectories use exactly 36,000 ticks of 0.05 seconds.

Attraction spending on upgraded fast espresso remains profitable after controlling total elapsed time and keeping all in-flight food expensed:

- early/espresso-ten-cat: paired terminal net-liquid advantage 1,824.58 [1,476.10, 2,173.06] coins; positive in 30/30 seeds, against the same paid espresso-ten control.
- early/espresso-ten-noteLocal: paired terminal net-liquid advantage 7,212.41 [6,657.89, 7,766.93] coins; positive in 30/30 seeds, against the same paid espresso-ten control.
- early/espresso-ten-cat-noteLocal: paired terminal net-liquid advantage 9,354.34 [8,947.00, 9,761.69] coins; positive in 30/30 seeds, against the same paid espresso-ten control.

These are terminal advantages at 1,800 seconds. The supplement does not estimate the first payback timestamp or establish a globally optimal reinvestment strategy. Earlier first-payback results remain specific to their separately documented equal-open-window experiments.

- Mid fixed owned-assets menu choices, ordered by mean terminal net-liquid gain: bakery 4,068.03; all 3,962.63; high 2,591.27; mixed 1,769.60; fast 927.00.
- Expanded fixed owned-assets menu choices, ordered by mean terminal net-liquid gain: mixed 66,271.87; high 61,006.80; all 29,536.63; bakery 29,389.80; fast 2,298.33.

The mid-stage bakery/all difference is not resolved at this sample size: bakery leads by 105.40 coins, but the paired 95% interval is −29.81 to 240.61 (17/30 positive seeds). Expanded mixed exceeds high by 5,265.07 [4,056.94, 6,473.19], positive in all 30 seeds. These are comparisons among the tested fixed menus only.

Expanded high-menu attraction remains uncertain at this exact horizon: cat adds 507.34 [−646.49, 1,661.17], noteLocal adds 822.30 [−506.35, 2,150.94], and their combination adds 694.01 [−553.62, 1,941.64]. All three intervals include zero; their positive means do not establish a reliable gain.

## Clock and accounting method

- Each route starts from the same cash, raw pantry, recipes, facilities and staff within its stage. Stage endowments are early 1,200, mid 10,000 and expanded 50,000 cash plus the common fixtures described in raw metadata. Early espresso upgrades and cat adoption are paid from that initial cash. The later-stage recipe/facility ownership is an equal experimental fixture, not a free progression recommendation.
- Every opening lasts exactly 180 seconds. Doors then close and previously accepted service drains naturally. Settling a finished day and preparing the next day take zero simulation time. Consequently routes can spend different fractions of the same 1,800 seconds open or closing and can finish different numbers of business days.
- Administrative transitions occur only before a remaining tick. At the exact horizon there is no extra close, settlement, reopening, purchase, cancellation, service drain or future revenue. The current day remains open or closing with its actual state.
- Primary net-liquid gain is change in cash + raw pantry at purchase cost + unused care/promotion prepayments. This is an accounting definition, not a claim that food or prepayments can be sold or refunded.
- Revenue and operating costs include every settled report plus the current unfinished day exactly once. The identity is: net-liquid gain = cumulative revenue − consumed ingredients − consumed care − consumed promotion − intervention capital. Adoption includes the first care pack; its value is prepaid care rather than capital. Cash inflows/outflows are independently reconciled.
- All paid food on shelves, in kitchen batches and allocated to accepted-but-unpaid customers remains expensed in the primary metric. Its original ingredient cost is reported separately as a physical diagnostic, never added to cash or primary gain. No sale proceeds, salvage, refund or liquidation value is imagined.
- Kitchen batches match the inProduction quantities. Shelf goods and customer allocations are disjoint. Customer allocations count unique undelivered customers only, excluding queue/toCounter and paid/abandoned visits. Pass/server references are deduplicated because they overlap during pickup. Drink/bakery and pass/tray/counter subtotals are overlapping descriptions, not extra assets. Lingering abandoned plates are reported separately.
- Ingredient cost not sold or live is total consumed ingredients minus ingredient cost of actual sales minus live food cost. Unfinished food is therefore not mislabeled as realized waste. Closed-day stale cost is also retained separately.
- No clicks, goal rewards, rescue cash, debt, offline income or reinvestment is introduced. Forecast purchasing uses the real cash-constrained restock function. Promotions renew only during preparation after expiration. Global room height and kitchen geometry reset before every sample.
- Thirty predetermined seeds are paired. A shared seed does not guarantee customer-identical random streams after strategies diverge. Intervals are descriptive Student-t mean intervals, t(29)=2.04523, with no multiple-comparison correction. Fixed-policy rankings do not establish an infinite-horizon optimum.

## Equal-clock outcomes

All rows have exactly 1,800 total seconds. Open/closing seconds and completed days below are seed means. Live-food cost is excluded from primary gain.

| Route | Net-liquid gain, 95% interval | Open seconds | Closing seconds | Completed days | Served | Rating | Live food at ingredient cost |
|---|---:|---:|---:|---:|---:|---:|---:|
| early/none | 928.27 [912.40, 944.13] | 1,780.05 | 19.96 | 9.00 | 390.90 | 4.50 | 0.33 |
| early/espresso-ten | 30,028.74 [29,640.02, 30,417.47] | 1,780.05 | 19.96 | 9.00 | 390.90 | 4.50 | 0.33 |
| early/espresso-ten-cat | 31,853.33 [31,406.03, 32,300.62] | 1,781.43 | 18.57 | 9.00 | 421.87 | 4.50 | 0.57 |
| early/espresso-ten-noteLocal | 37,241.15 [36,874.73, 37,607.57] | 1,777.30 | 22.70 | 9.00 | 488.27 | 4.50 | 0.53 |
| early/espresso-ten-cat-noteLocal | 39,383.09 [38,981.28, 39,784.89] | 1,777.71 | 22.29 | 9.00 | 524.13 | 4.50 | 0.73 |
| mid/fast | 927.00 [908.88, 945.12] | 1,781.48 | 18.53 | 9.00 | 391.60 | 4.50 | 0.60 |
| mid/high | 2,591.27 [2,552.64, 2,629.89] | 1,764.87 | 35.13 | 9.00 | 314.67 | 3.92 | 3.40 |
| mid/bakery | 4,068.03 [3,963.46, 4,172.61] | 1,777.46 | 22.54 | 9.00 | 388.10 | 4.38 | 47.50 |
| mid/mixed | 1,769.60 [1,721.31, 1,817.89] | 1,752.83 | 47.17 | 9.00 | 393.47 | 4.48 | 34.40 |
| mid/all | 3,962.63 [3,886.94, 4,038.32] | 1,776.70 | 23.30 | 9.00 | 373.50 | 3.75 | 24.17 |
| expanded/fast | 2,298.33 [2,262.48, 2,334.18] | 1,558.99 | 241.01 | 8.00 | 981.90 | 3.85 | 10.27 |
| expanded/high | 61,006.80 [60,090.86, 61,922.74] | 1,558.03 | 241.97 | 8.00 | 966.73 | 3.83 | 42.27 |
| expanded/bakery | 29,389.80 [28,964.41, 29,815.19] | 1,638.46 | 161.54 | 8.97 | 724.50 | 3.00 | 220.87 |
| expanded/mixed | 66,271.87 [65,465.74, 67,077.99] | 1,625.27 | 174.73 | 8.33 | 900.97 | 3.12 | 172.00 |
| expanded/all | 29,536.63 [28,971.41, 30,101.85] | 1,557.36 | 242.64 | 8.00 | 999.67 | 3.51 | 594.07 |
| expanded/high-cat | 61,514.14 [60,658.94, 62,369.34] | 1,553.87 | 246.13 | 8.00 | 980.70 | 3.75 | 44.00 |
| expanded/high-noteLocal | 61,829.10 [61,078.97, 62,579.22] | 1,553.06 | 246.94 | 8.00 | 986.27 | 3.63 | 42.13 |
| expanded/high-cat-noteLocal | 61,700.81 [60,904.14, 62,497.48] | 1,555.59 | 244.42 | 8.00 | 986.30 | 3.57 | 42.80 |
| recovery/one-coin-shared | 1,153.23 [1,091.67, 1,214.80] | 1,784.65 | 15.35 | 9.00 | 224.20 | 4.42 | 2.33 |
| recovery/nine-coin-complex | 3,230.67 [3,124.03, 3,337.30] | 1,785.28 | 14.72 | 9.00 | 226.27 | 4.22 | 6.20 |

## Paired terminal comparisons

Controls share initial endowments. Mid/expanded menu comparisons differ only in menu selection; early espresso-ten pays for ten upgrades. Cat/promotion comparisons use the same paid-upgrade or high-menu control. Recovery probes use only their matching baseline, never a rich normal fixture.

| Route | Control | Net-liquid difference, 95% interval | Positive seeds | Live food cost difference (not credited) |
|---|---|---:|---:|---:|
| early/espresso-ten | early/none | 29,100.48 [28,727.52, 29,473.44] | 30/30 | 0.00 |
| early/espresso-ten-cat | early/espresso-ten | 1,824.58 [1,476.10, 2,173.06] | 30/30 | 0.23 |
| early/espresso-ten-noteLocal | early/espresso-ten | 7,212.41 [6,657.89, 7,766.93] | 30/30 | 0.20 |
| early/espresso-ten-cat-noteLocal | early/espresso-ten | 9,354.34 [8,947.00, 9,761.69] | 30/30 | 0.40 |
| mid/high | mid/fast | 1,664.27 [1,624.35, 1,704.18] | 30/30 | 2.80 |
| mid/bakery | mid/fast | 3,141.03 [3,034.27, 3,247.79] | 30/30 | 46.90 |
| mid/mixed | mid/fast | 842.60 [792.17, 893.03] | 30/30 | 33.80 |
| mid/all | mid/fast | 3,035.63 [2,957.83, 3,113.44] | 30/30 | 23.57 |
| expanded/high | expanded/fast | 58,708.47 [57,796.62, 59,620.31] | 30/30 | 32.00 |
| expanded/bakery | expanded/fast | 27,091.47 [26,674.42, 27,508.51] | 30/30 | 210.60 |
| expanded/mixed | expanded/fast | 63,973.53 [63,173.73, 64,773.33] | 30/30 | 161.73 |
| expanded/all | expanded/fast | 27,238.30 [26,675.25, 27,801.35] | 30/30 | 583.80 |
| expanded/high-cat | expanded/high | 507.34 [-646.49, 1,661.17] | 17/30 | 1.73 |
| expanded/high-noteLocal | expanded/high | 822.30 [-506.35, 2,150.94] | 14/30 | -0.13 |
| expanded/high-cat-noteLocal | expanded/high | 694.01 [-553.62, 1,941.64] | 18/30 | 0.53 |

## Same-clock before/after recovery

The baseline snapshot retains original gameplay from commit 57df94e. Both variants use the identical fixed-clock runner and identical initial assets for each probe, including exhausted one-off goals. The baseline alone is run only for these two recovery routes.

| Probe | Baseline gain | Candidate gain, 95% interval | Paired improvement, 95% interval | Served before → after |
|---|---:|---:|---:|---:|
| recovery/one-coin-shared | 0.00 | 1,153.23 [1,091.67, 1,214.80] | 1,153.23 [1,091.67, 1,214.80] | 0.00 → 224.20 |
| recovery/nine-coin-complex | 0.00 | 3,230.67 [3,124.03, 3,337.30] | 3,230.67 [3,124.03, 3,337.30] | 0.00 → 226.27 |

The recovery result addresses fragmented affordable restocking. It does not add recovery money or claim that a cafe with zero cash, zero usable stock and no remaining goal rewards can recover.

## Verification and reproduction

- All 660 trajectories satisfy the exact clock and pre-horizon settlement conditions. Maximum independent cash/operating-accounting residual: 2.91e-10 coins.
- The fixed-clock suite and strict standalone TypeScript check pass. Tests cover exact cutoff without settlement, deterministic replay, layout independence, kitchen/shelf/order deduplication, pass/server overlap and abandoned food.
- Both reviewers independently checked the clock and accounting design. Final read-only review independently verified all 660 raw horizons, source/design hashes, same-stage assets, operating/cash ledgers and every summary/paired statistic; no material correction was required.
- Each completed 30-seed route is an atomic checkpoint. Resume requires unchanged production-source hash, shared-helper/runner hash, selected route scope and seeds. There is a 24-hour opt-in test timeout; normal test runs skip the experiment.
- Completed candidate execution took 599.39 seconds; baseline recovery took 5.08 seconds. Both opt-in suites passed all five tests without a timeout.
- One-seed pilot observations: upgraded espresso ~0.2s, mid mixed ~0.6s, expanded all ~4.0s per 1,800-second trajectory. Pilot data are not used in 30-seed conclusions.

Candidate, from the main checkout:

```sh
FIXED_CLOCK=1 FIXED_CLOCK_LABEL=fixed-clock-balanced npx vitest run scripts/economy-fixed-clock.test.ts --silent=false --disableConsoleIntercept
```

Baseline, from the immutable baseline checkout with the identical new fixed-clock script and shared lab helper copied in (no gameplay edits):

```sh
FIXED_CLOCK=1 FIXED_CLOCK_SCOPE=recovery FIXED_CLOCK_LABEL=fixed-clock-baseline npx vitest run scripts/economy-fixed-clock.test.ts --silent=false --disableConsoleIntercept
```

Quick unit tests and strict typecheck:

```sh
npx vitest run scripts/economy-fixed-clock.test.ts
npx tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types node --skipLibCheck --strict scripts/economy-fixed-clock.test.ts
```

Artifacts:

- results/fixed-clock-balanced.json and fixed-clock-balanced-summary.json: all 20 candidate routes and raw seeds
- results/fixed-clock-baseline.json and fixed-clock-baseline-summary.json: both original-source recovery routes
- results/fixed-clock-verification.json: independent clock/ledger checks and paired recovery effects
- results/fixed-clock-pilot-final.json: pilot using the final frozen runner
- logs/fixed-clock-balanced.log, fixed-clock-baseline.log and fixed-clock-pilot.log: execution results

Frozen runner/helper SHA256: `63aee12430bb5667072429799d607724500886c42aa24bdc55c18edaf189e822`.
Candidate production SHA256: `0b73358c463ed8805ac4d16e7d0c831eec28bfed99fb0b5b19b7156422bd76cf`.
Baseline production SHA256: `bac26fdeeedff87c4a8d8e8d0beb6e3b8f01eb2265a98b1045f0d9cba6709f66`.
