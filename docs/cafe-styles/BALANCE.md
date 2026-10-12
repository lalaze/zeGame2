# Route balance: original matrix and earned-capability follow-up

**Original matrix and earned-capability pressure follow-up complete, 2026-10-12.** The actual `Sim` finished **9,720 samples**: 108 untouched scenarios × 30 seeds, plus 216 final focus/control scenarios × 30 seeds. Every sample has the same 1,800-second clock, including natural closing drain. The existing artifact verifier passes its five tests and declared pairwise gates, but those gates are insufficient for the stronger requirement that garden have a genuinely nondominated niche. The wider, separately preregistered earned-capability analysis below addresses that coverage gap and preserves the original failure.

**Bottom line:** all six routes operate profitably under the reasonable-stock base policy and have a measurable focus benefit. They are not equally strong, and this experiment does **not** establish six equally competitive optimal choices. In particular, garden's late route-shaped investment does not pay back within the window, and garden is mean-dominated in all nine identical-asset cells. These limits are retained rather than corrected with benchmark rewards.

**Follow-up outcome:** the separately preregistered earned-capability union completed another **2,100 samples** (1,050 training and 1,050 disjoint holdout). Garden on black tea + scone passed 33 of 34 frozen holdout edges, its own-plain benefit and its downside, but its frozen profit advantage over same-menu cats was inconclusive: **+23,924 coins [−29,614, 77,462]**. The stronger auxiliary gate therefore remains unmet. A separate review decision authorized the originally planned paid-pressure sustainability regression despite that failure. All **2,100 pressure samples** are now complete: all 70 cells have positive operating-profit lower bounds, with zero constrained restocks or failed promotion bookings. Feature reproduces all 34 frozen edges; rush reproduces 33 and clearly favors cats on the failed profit edge. This does not turn the failed base cats-profit claim into a pass. See [the complete follow-up report](EARNED-UNION-RESULTS.md) and [the independent requirement-by-requirement acceptance review](ACCEPTANCE.md).

## What passed, and what did not follow from it

- All **18 route × capital-stage base-pressure cells** have a positive operating-profit lower 95% bound and **zero cash-constrained restocks** across their 30 seeds. The lowest lower bound is 21,024 coins. This establishes positive operations within this window under the declared purchasing policy, not unlimited-horizon sustainability or optimal play.
- All **108 focused cells**, including promoted traffic, have a positive operating-profit lower bound; the smallest is 1,367 coins.
- Each style has a material paired benefit against the **same menu and paid portfolio with focus disabled**, and a material benefit over **at least one** other style on the literal identical-asset panel.
- That last gate does not mean best-in-cell or nondominated. A supplementary descriptive mean check finds common-asset nondominated counts of coffee **6/9**, bakery **1/9**, cats **3/9**, takeaway **9/9**, garden **0/9**, community **1/9**. Bakery, garden and community are never strictly best on a recorded mean metric; zero-waste/rating ties are possible. This is a post-completion mean diagnostic, not a significance test or a new acceptance criterion. See [all frontier diagnostic rows](results/final-v1-frontier-diagnostic.json).
- Of 3,240 focused samples, **2,428 recover their own capital** by the cutoff and **812 are right-censored**. Positive operating profit must not be called capital payback.
- No corrected full-run sample hit the accounting or >300-second drainage guard. Maximum final absolute cash/asset reconciliation error is below **0.000000062 coins**.

## Fairness and interpretation

[The full comparison contract](COMPARISON-CONTRACT.md) records purchasing APIs, menus, progress, seeds, equations, promotion fees and reproducible commands.

The **common-assets** panel pays identical capital, ownership and retained cash for all six policies at each stage. Its actual capital / purchase cash / retained initial cash are early **1,568.42 / 1,576.42 / 223.58**, mid **13,177.40 / 13,197.40 / 1,802.60**, late **305,902.60 / 305,940.60 / 44,059.40** coins. The difference between capital and purchase cash is prepaid first cat-care packs. All rooms, furniture, cats, recipe levels and research are charged.

The **route-purchases** panel instead uses equal funding of **1,800 / 15,000 / 350,000**, with route-shaped paid purchases and cash retained as an asset. Its spent capital is deliberately reported rather than falsely called equal investment. Literal matched capital is supplied by the other panel. Capital has zero assumed resale value; raw pantry, unused care and unused paid promotion airtime retain cost value. Live unpaid food remains expensed.

These are capital-stage fixtures with common endowed day/experience, not the actual style-checklist stages or proof of fresh-save reachability. [Separate fresh-save evidence](progression/README.md) covers 18 earned progression trajectories and 54 real stage-save round trips. [Browser evidence](screens/README.md) distinguishes those saves from synthetic rendering fixtures.

## Same-portfolio focus effects

All figures below are **focus minus plain**, with paired descriptive 95% intervals in brackets. The selected examples are exploratory; all 108 pairs and seed wins remain in the [acceptance artifact](results/final-v1-acceptance.json). “pp” means percentage points. Lower loss/waste is better; higher profit/rating is better. The loss advantages shown also survive the conservative pending-guest sensitivity.

| Focus; common-asset scenario | Net-liquid profit Δ, coins [95% CI] | Lost-guest rate Δ, pp [95% CI] | Waste Δ, coins [95% CI] | Terminal rating Δ [95% CI] | Selected metric seed wins |
| --- | ---: | ---: | ---: | ---: | ---: |
| coffee; early/base | 775.2 [618.7, 931.8] | 0.01 [-0.06, 0.08] | 0.0 [0.0, 0.0] | 0.000 [0.000, 0.000] | 29/30 (netLiquidProfit) |
| bakery; early/base | 549.2 [454.2, 644.1] | -2.21 [-2.58, -1.83] | -56.1 [-60.8, -51.5] | 0.180 [0.142, 0.217] | 30/30 (wasteCost) |
| cats; mid/base | 633.2 [384.2, 882.1] | 0.26 [0.05, 0.46] | -18.1 [-31.7, -4.6] | -0.021 [-0.059, 0.016] | 23/30 (netLiquidProfit) |
| takeaway; mid/rush | 423.8 [204.0, 643.7] | -0.02 [-0.09, 0.06] | 0.0 [0.0, 0.0] | 0.168 [0.150, 0.185] | 30/30 (rating) |
| garden; early/rush | 559.3 [298.2, 820.3] | -4.03 [-5.71, -2.36] | 2.3 [-7.5, 12.0] | 0.017 [-0.048, 0.081] | 24/30 (lossRate) |
| community; early/rush | -30.2 [-112.8, 52.3] | -5.83 [-6.48, -5.18] | 0.0 [0.0, 0.0] | 0.068 [0.044, 0.092] | 30/30 (lossRate) |

Mechanisms and costs remain visible:

- **Coffee:** real coffee experience/research earns a premium, while coffee preparation takes 12% longer. The profit gate passes in all 18 focus pairs; these fixtures do not demonstrate an observed profit penalty from the slower preparation, so none is invented.
- **Bakery:** actual kitchen work is faster, with real food production and spoilage. A bakery-only menu has no explicit per-order focus price penalty, and kitchen/cook capital is already shared with its plain control. This is a local operating benefit, not an extra focus investment cost. Profit's mean improves in 16/18 cells; the two negative means have intervals spanning zero. Only 11/18 pass the material profit gate. Combo-heavy policies deserve separate future evaluation.
- **Cats:** the illustrated mid/base premium costs a **0.26 pp** higher loss rate [0.05, 0.46] and longer dwell. Adoption, comfort and every consumed care pack are paid.
- **Takeaway:** counter routing adds **112.2 served guests** [106.9, 117.4] in the illustrated rush cell, with a 6% eligible-ticket discount. In early/feature, the same focus instead loses **761.4 coins** [−914.0, −608.9], with no positive-profit seed. It is not a free revenue premium.
- **Garden:** tea/pair premiums compete with longer seated stays, delivery travel and baking. The early/rush loss improvement is **4.03 pp**, but its conservative pending-outcome improvement is **3.10 pp** [1.41, 4.78]. The late investment failure is shown below.
- **Community:** service/review benefits accompany 10% fewer arrivals. The early/rush loss improvement remains **4.71 pp** [4.06, 5.36] under the worst pending-outcome bound, so it is not merely fewer raw losses from fewer visitors. Early/base profit is **229.2 coins lower** [−301.5, −156.8].

## Between-route comparisons with literally identical investment

These selected pairs use the same common assets, stage progress, clock and seed set. Menus differ as part of the route policy, so they do not isolate the focus effect; the table above does. Each pair is favorable on its named metric, not necessarily on the others.

| Route; scenario | Comparator | Material advantage [95% CI] | Seed wins | Visible cost / limit |
| --- | --- | ---: | ---: | --- |
| coffee; early/base | cats | Profit, coins: 524.0 [357.9, 690.0] | 27/30 | No material rating or loss-rate gain |
| bakery; mid/base | cats | Rating: 0.085 [0.053, 0.117] | 25/30 | Waste +231.9 coins; profit interval includes zero |
| cats; early/base | takeaway | Profit, coins: 729.1 [531.8, 926.5] | 27/30 | No material rating or loss-rate gain |
| takeaway; mid/rush | coffee | Loss rate, pp: -3.35 [-3.55, -3.15] | 30/30 | Profit −84,627.6 coins; rating +0.360 |
| garden; mid/base | bakery | Profit, coins: 4,742.4 [4,351.2, 5,133.6] | 30/30 | Waste +486.1 coins; rating −0.153 |
| community; mid/rush | garden | Rating: 0.396 [0.310, 0.481] | 29/30 | Profit −15,563.5 coins; loss rate also improves |

Coffee leads common-asset mean profit in all early/mid cells; takeaway leads it in late cells. The pairwise successes above therefore should not be marketed as each route becoming the overall profit winner. Garden's focus helps its own tea policy, but the current fixed menus/investment policy do not produce an economic frontier niche for it. No reward money, free room or benchmark-only multiplier was introduced to hide that result.

## Route-shaped base-policy economics and payback

Means over 30 seeds, with no campaign. “Losses” include missed guests, door losses and waiting queues sent home at closing. Full intervals, cash balances, purchase ledgers, care costs and pending guests are in the raw/summary artifacts. All 18 cells have zero cash-constrained restocks. Paid first care is separate from capital, so capital + retained cash need not equal funding exactly.

| Capital stage | Route | Paid capital | Initial retained cash | Operating profit | Net after capital | Recovered by 1,800s | Lost guests | Waste cost | Terminal rating |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| early | coffee | 1,521.0 | 279.0 | 162,892.2 | 161,371.2 | 30/30 | 0.3 | 0.0 | 4.50 |
| early | bakery | 1,584.0 | 216.0 | 78,966.9 | 77,382.9 | 30/30 | 19.9 | 210.7 | 4.27 |
| early | cats | 1,520.8 | 271.2 | 117,932.2 | 116,411.3 | 30/30 | 0.4 | 0.0 | 4.50 |
| early | takeaway | 1,518.7 | 281.3 | 133,140.6 | 131,622.0 | 30/30 | 0.0 | 0.0 | 4.50 |
| early | garden | 1,551.4 | 248.6 | 21,273.3 | 19,721.9 | 30/30 | 8.5 | 144.0 | 4.40 |
| early | community | 1,567.0 | 233.0 | 46,982.9 | 45,416.0 | 30/30 | 3.8 | 0.0 | 4.48 |
| mid | coffee | 11,138.8 | 3,861.2 | 163,445.2 | 152,306.4 | 30/30 | 0.8 | 0.0 | 5.00 |
| mid | bakery | 12,485.2 | 2,514.8 | 59,852.5 | 47,367.3 | 30/30 | 10.2 | 322.7 | 4.96 |
| mid | cats | 12,981.5 | 1,998.5 | 306,870.5 | 293,889.0 | 30/30 | 80.4 | 50.4 | 3.63 |
| mid | takeaway | 12,555.4 | 2,444.6 | 323,886.5 | 311,331.1 | 30/30 | 1.0 | 0.0 | 5.00 |
| mid | garden | 12,298.8 | 2,701.2 | 85,034.8 | 72,736.0 | 30/30 | 2.2 | 613.9 | 4.57 |
| mid | community | 13,135.7 | 1,864.3 | 378,293.0 | 365,157.3 | 30/30 | 4.4 | 137.3 | 4.78 |
| late | coffee | 293,521.9 | 56,478.1 | 1,997,784.9 | 1,704,263.0 | 30/30 | 1.0 | 0.0 | 5.00 |
| late | bakery | 304,617.6 | 45,382.4 | 1,166,608.5 | 861,990.9 | 30/30 | 11.1 | 796.8 | 4.94 |
| late | cats | 298,115.0 | 51,847.0 | 2,105,760.2 | 1,807,645.2 | 30/30 | 49.3 | 871.5 | 4.03 |
| late | takeaway | 271,390.2 | 78,609.8 | 1,072,720.1 | 801,329.9 | 30/30 | 0.9 | 0.0 | 5.00 |
| late | garden | 305,102.5 | 44,897.5 | 230,956.9 | -74,145.7 | 0/30 | 9.9 | 796.0 | 4.22 |
| late | community | 295,195.7 | 54,804.3 | 2,052,417.2 | 1,757,221.6 | 30/30 | 5.2 | 539.5 | 4.96 |

Late garden earns **230,956.9** operating coins but spends **305,102.5** capital, leaving mean net **−74,145.7**. Its 30 payback times are all `null` (censored at 1,800 seconds), not zero. Across the matrix, payback is own-capital recovery, not incremental payback versus another policy. The retained 180-second checkpoints verify consistency; exact first crossing comes from the fingerprinted tick-level generator.

## Pressure, censoring and other limits

1. **Paid marketing is a policy, not guaranteed exposure.** Feature buys +25% `noteLocal`; rush buys +100% `clipStar`. The same plan/rules apply to every route, but insufficient cash or different open/drain time can change realized exposure. Across focused samples there are **621 constrained-restock events** in 390 samples, and **95 failed campaign bookings** in 58 samples, confined to 13 promoted-pressure cells. Fees and remaining airtime are fully valued. None occurs in the 18 reasonable-stock base cells. Do not describe every rush row as continuously enjoying +100% traffic.
2. **Loss rate is observed at a fixed cutoff.** Its denominator includes pending guests. Original results, resolved-outcome sensitivity and a worst-case pending bound are retained together. Four otherwise favorable focus loss-rate cells fail the stronger bound: common mid/base bakery; common late/rush bakery; route-purchase mid/feature bakery; route-purchase late/base community. Six between-route apparent advantages also fail it. The conservative audit refinement was added after pilot/partial inspection and never rescues an unfavorable original result.
3. **Rating is the latest 50 reviews at the terminal clock**, not full-window average satisfaction. Guest throughput alone cannot satisfy the favorable-route acceptance gate, and fewer raw losses alone never qualifies.
4. **Operating profit is not total investment profit.** Whole-funded portfolios deliberately buy price levels and sink capital. Stock is purchased, care recurs, promotion prepayments retain value, and live food is not granted salvage or future revenue. The runner's waste calculation uses sold-food cost, but that intermediate is not retained per row; the verifier checks waste bounds/live-food sums rather than pretending to independently reconstruct the entire waste subtraction. Care-refill spending is inferred from care balances and consumption; the aggregate cash identity is independently reconstructed.
5. **This is a fixed-policy fixture experiment.** Shared portfolios buy unused capabilities, synthetic recipe experience is common, layouts are fixed, and recipe-level spending is not optimized. Real progression uses a different reinvestment policy. These results cannot establish universal balance across arbitrary menus, layouts, staffing or players.
6. **Intervals are descriptive t29 intervals.** Seeds are paired labels; different paths consume randomness differently. Selected examples and the mean-frontier diagnostic are exploratory, with no multiplicity correction or untouched holdout. A broad “each route is optimal somewhere” claim remains unestablished.

## Untouched baseline and repair separation

The untouched baseline is the source copied from tracked-clean commit `3d9c6b95914a52f100db582608f424a9af2bd683` before any style code changed. Its 3,240 samples use the identical final runner design. Historical datasets with other fingerprints were not substituted.

Final **plain** versus untouched **plain** changes are reported separately: 49 of the 108 cells have a changed mean on at least one recorded metric. The largest mean net change is the late/feature cat route portfolio, **+221,294.6 coins** [194,991.4, 247,597.9]. These before/after differences include the chair-access and paid-care forecast repairs and are not attributed to focus. The final focus/plain pairs hold those repairs constant. The experiment does not separately isolate each repair's causal contribution.

An initial legal fern placement exposed a >300-second chair-access drain failure. The original partial files/logs remain in [pre-correction evidence](results/pre-correction/). The corrected benchmark uses a paid cactus sill plus wall poster in both sources; it does not force-close stuck service. The actual chair-clearance fix has separate [navigation evidence](navigation/).

## Artifacts, fingerprints and verification

- [Untouched complete raw data](results/untouched-v4.json) and [30-seed summary](results/untouched-v4-summary.json)
- [Final complete raw data](results/final-v1.json) and [30-seed summary](results/final-v1-summary.json)
- [Acceptance, paired intervals, seed wins and all limitations](results/final-v1-acceptance.json)
- [Post-completion mean-frontier diagnostic](results/final-v1-frontier-diagnostic.json)
- [Final merge log](results/final-v1-merge.log) and [five-test acceptance log](results/final-v1-verification.log)
- Individual baseline/final shard JSON, summaries and logs are retained beside the merged files for exact resumption/audit.

Game fingerprints:

- Untouched: `5c0d2f7464a95274172b8c62f95083822abb8cc111f04edd41d96643a85bba4e`
- Final: `9c47eab7d2f2b1fe47e094df3f22c41f6a6a51043c338e952a6de37a27352c4d`
- Shared runner: `547d41cd492f63746f333ce8c70612bdbd3bed17d79aa1852a5c2dfb14387b1e`

Fast complete-evidence verification:

```sh
CAFE_STYLE_VERIFY=1 ./node_modules/.bin/vitest run scripts/cafe-style-verify.test.ts --maxWorkers=1
```

This reruns no simulation. It checks all 30 seeds, exact coverage/clock, current source and harness fingerprints, independently recomputed ledgers/counters, payback consistency, common-asset equality and every focus/plain portfolio. An incompatible source/design/scope/seed refuses reuse. [Exact full-run, shard, resume and merge commands](COMPARISON-CONTRACT.md#exact-commands-for-the-delivered-labels) are documented separately. Gameplay changes require newly labeled source-matched evidence, not reinterpretation of these rows.
