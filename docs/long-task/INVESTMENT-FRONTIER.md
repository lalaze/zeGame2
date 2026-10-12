# Paid investment frontier: espresso versus later unlock routes

## Finding

Cheap espresso upgrades are an excellent early route, but do not dominate indefinitely. With every recipe prerequisite and the kitchen paid for, the tested later route beats espresso at 100k, 10m, 1b, and 100b starting budgets; espresso wins at 1,200. These are fixed-policy counterexamples, not a global optimum or a recommendation to spend all late-game wealth on one recipe. No gameplay changes were made.

## Reproduce and scope

Run `npm run balance:frontier` (equivalent to `INVESTMENT_FRONTIER=1 npx vitest run scripts/investment-frontier.test.ts --silent=false --disableConsoleIntercept`). Raw per-seed/day results, source fingerprint and analytical sweep are in `results/investment-frontier.json`. Ordinary test runs validate route construction and skip the costly experiment. Results are atomically replaced after each finished scenario; top-level `complete` remains false until all ten scenarios have the expected 30 unique fixed seeds and eight daily records, with no drain timeouts. Metadata includes separate gameplay-source and runner SHA-256 fingerprints. The verified execution log is `logs/investment-frontier.log`.

- Five independent equal-starting-wealth experiments, ten simulated routes, 30 predetermined seed labels each, eight days per route: 2,400 simulated cafe-days. Same seed labels across routes; diverging event paths do not imply identical customers. An extra repeat of seed 0 per route verifies determinism.
- All use actual `Sim.update` with 0.05-second steps, 180 seconds admitting customers, then drain accepted service for at most 300 seconds. All 2,400 recorded days drained without timeout.
- Start from starter furniture and espresso Lv1 only; pantry is zero for every route, with the stated total cash budget. There are no free later unlocks, upgrades, kitchen, cats, regions, or promotions. The starter state is a common endowment, while the budget is experimental capital rather than measured progression earnings.
- Buy each preceding recipe in the target category at Lv1, then the target; buy the 800-coin kitchen if required. Select only the target recipe. Reserve two forecast days of ingredients as cash, then buy the maximum target levels affordable outside that reserve. This includes levels of espresso, whose first level is free.
- Restock through actual forecast/affordability functions before each day; no injected stock or cash. Keep all residual cash and pantry. No click income, recipe reinvestment, staff/marketing improvements, or intervention during opening. Kitchen is staffed by its included cook.
- Capital outlay is actual recipe/kitchen cash spent. Operating profit expenses used/wasted ingredients. Net-liquid profit is final cash plus pantry at ingredient cost minus starting cash; every seed reconciles this to operating profit minus capital. Capital has no assumed resale value.
- The budgets are capital scales, not claimed real gameplay stages or time-to-unlock. Large budgets deliberately retain the same starter staffing to isolate menu capital, so they do not represent a sensible complete late-game build.

## Analytical screen (not simulation)

For every affordable single-target route at each budget, evaluate actual `salePrice`, `servingCost`, `serviceCapacity`, and `arrivalRate`. Rank by min(arrival, service capacity) × serving margin. This proxy ignores actual navigation, seating, customer reviews, VIPs, kitchen production and waste. It selects one later route for simulation, not the winner among all possible simulated or mixed-menu policies.

| Budget | Proxy-leading target | Level | Proxy margin/second | Espresso proxy margin/second |
|---:|---|---:|---:|---:|
| 1,200.00 | espresso | 25 | 59.80 | 59.80 |
| 100,000.00 | roll | 52 | 686.10 | 375.81 |
| 10,000,000.00 | fruittea | 28 | 8,584.04 | 1,088.44 |
| 1,000,000,000.00 | rye | 30 | 133,630.40 | 2,394.04 |
| 100,000,000,000.00 | brioche | 32 | 2,068,068.80 | 5,628.01 |

At 1,200, espresso is the proxy leader; americano is the highest-ranked alternative and the simulated comparator. Price milestones and exponentially growing upgrade costs explain the transitions: early espresso buys many levels cheaply, while later base prices eventually outweigh its level advantage. Milestone discontinuities make exact crossover budgets non-monotonic.

## Paid setups

Unlock cost includes target Lv1 and all preceding category recipes, plus kitchen when required; espresso starts at Lv1. Capital additionally includes subsequent target-level purchases. Reserves are held in cash and procurement is paid during preparation.

| Budget | Target | Level | Unlock/kitchen cost | Total capital | Stock reserve | Residual cash before stocking |
|---:|---|---:|---:|---:|---:|---:|
| 1,200.00 | espresso | 25 | 0.00 | 1,058.67 | 84.00 | 141.33 |
| 1,200.00 | americano | 12 | 40.00 | 965.33 | 84.00 | 234.67 |
| 100,000.00 | espresso | 64 | 0.00 | 94,084.41 | 84.00 | 5,915.59 |
| 100,000.00 | roll | 52 | 830.00 | 91,181.09 | 320.00 | 8,818.91 |
| 10,000,000.00 | espresso | 105 | 0.00 | 9,812,910.02 | 84.00 | 187,089.98 |
| 10,000,000.00 | fruittea | 28 | 61,790.00 | 9,546,734.37 | 3,572.00 | 453,265.63 |
| 1,000,000,000.00 | espresso | 145 | 0.00 | 913,107,673.76 | 84.00 | 86,892,326.24 |
| 1,000,000,000.00 | rye | 30 | 4,777,180.00 | 966,107,917.36 | 640.00 | 33,892,082.64 |
| 100,000,000,000.00 | espresso | 186 | 0.00 | 95,161,429,486.82 | 84.00 | 4,838,570,513.18 |
| 100,000,000,000.00 | brioche | 32 | 374,777,180.00 | 97,606,047,335.92 | 640.00 | 2,393,952,664.08 |

## Eight-day simulated financial results

Normal intervals for near-zero losses can extend below zero; that is an approximation artifact, not negative observed losses. All brackets are descriptive normal-approximation 95% intervals for the sample mean (mean ± 1.96 × sample SD / √30), not individual-seed ranges or multiple-comparison-adjusted claims. Raw SDs are retained in JSON. Negative net-liquid profit means capital was not recovered within the eight-day window; it does not mean operations lost money.

| Budget | Target | Operating profit [95% CI] | Net-liquid profit [95% CI] |
|---:|---|---:|---:|
| 1,200.00 | espresso | 106,573.70 [104,936.43, 108,210.97] | 105,515.03 [103,877.76, 107,152.30] |
| 1,200.00 | americano | 46,431.87 [45,841.45, 47,022.28] | 45,466.54 [44,876.13, 46,056.96] |
| 100,000.00 | espresso | 669,550.50 [659,282.94, 679,818.07] | 575,466.09 [565,198.53, 585,733.66] |
| 100,000.00 | roll | 1,064,399.31 [1,051,691.68, 1,077,106.94] | 973,218.22 [960,510.59, 985,925.85] |
| 10,000,000.00 | espresso | 1,939,095.86 [1,909,366.48, 1,968,825.24] | -7,873,814.16 [-7,903,543.54, -7,844,084.79] |
| 10,000,000.00 | fruittea | 14,681,710.01 [14,473,909.29, 14,889,510.73] | 5,134,975.64 [4,927,174.92, 5,342,776.36] |
| 1,000,000,000.00 | espresso | 4,265,022.26 [4,199,637.01, 4,330,407.51] | -908,842,651.50 [-908,908,036.75, -908,777,266.25] |
| 1,000,000,000.00 | rye | 214,699,413.87 [211,819,723.50, 217,579,104.23] | -751,408,503.50 [-754,288,193.86, -748,528,813.13] |
| 100,000,000,000.00 | espresso | 10,026,341.95 [9,872,637.11, 10,180,046.80] | -95,151,403,144.86 [-95,151,556,849.71, -95,151,249,440.02] |
| 100,000,000,000.00 | brioche | 3,044,886,553.60 [2,990,907,413.50, 3,098,865,693.70] | -94,561,160,782.32 [-94,615,139,922.42, -94,507,181,642.22] |

### Paired later-route minus espresso net-liquid advantage

Same-seed pairing; approximate 95% mean intervals. Positive values favor the later route.

| Budget | Later target | Paired advantage [95% CI] | Later wins / 30 |
|---:|---|---:|---:|
| 1,200.00 | americano | -60,048.49 [-61,588.98, -58,508.00] | 0 |
| 100,000.00 | roll | 397,752.13 [382,533.83, 412,970.43] | 30 |
| 10,000,000.00 | fruittea | 13,008,789.80 [12,810,898.84, 13,206,680.77] | 30 |
| 1,000,000,000.00 | rye | 157,434,148.00 [154,566,409.94, 160,301,886.06] | 30 |
| 100,000,000,000.00 | brioche | 590,242,362.54 [536,258,738.17, 644,225,986.91] | 30 |

The 1b and 100b routes still have large unrecovered capital after eight days, even though later routes beat espresso. The next section compares the exact idle-cash benchmark and records which routes recover capital; diversified/reinvesting strategies are not simulated, so these results do not justify buying all affordable levels or rank full-game play styles.

## Full capital recovery and retain-cash benchmark

The **retain-cash, do-not-open benchmark has net-liquid profit exactly 0**: no ingredients, sales, or purchases occur, and starting cash is retained. This is an accounting comparator, not a simulated operating strategy. Every net-liquid entry above is also that route’s gain/loss versus this benchmark. Keeping the cafe operating without new recipe capital, or investing only part of the budget, could do better; neither policy is measured here.

“Own capital recovered” means cumulative actual operating profit first covers the route’s entire recipe/kitchen purchase cost. This differs from incremental paired payback versus espresso, which is not calculated here. Censored means unrecovered by day 8; no extrapolated payback date is supplied.

| Budget | Route | Own capital recovered / 30 | Censored / 30 | Observed first recovery day range |
|---:|---|---:|---:|---|
| 1,200 | espresso | 30 | 0 | 1–1 |
| 1,200 | americano | 30 | 0 | 1–1 |
| 100,000 | espresso | 30 | 0 | 1–2 |
| 100,000 | roll | 30 | 0 | 1–1 |
| 10,000,000 | espresso | 0 | 30 | Unrecovered |
| 10,000,000 | fruittea | 30 | 0 | 5–6 |
| 1,000,000,000 | espresso | 0 | 30 | Unrecovered |
| 1,000,000,000 | rye | 0 | 30 | Unrecovered |
| 100,000,000,000 | espresso | 0 | 30 | Unrecovered |
| 100,000,000,000 | brioche | 0 | 30 | Unrecovered |

Both 1b and 100b maximal-spend routes are worse than retain-cash over the observed eight days. Their positive paired advantages establish only that these later recipes outperform equally budgeted maximal espresso spending. They do not recommend purchasing either route or imply indefinite optimality. At 10m fruittea recovers its full capital in all 30 seeds, whereas maximal espresso does not recover it in any seed.

## Service, ingredient waste, and final rating

Served/lost/waste are eight-day totals; rating is the final day report rating. Lost includes missed customers and door losses. Waste is total ingredient expense minus recipe cost of sold servings, so it includes baked stock that goes stale and other paid ingredients that never sell.

| Budget | Target | Served [95% CI] | Lost [95% CI] | Waste cost [95% CI] | Final rating [95% CI] |
|---:|---|---:|---:|---:|---:|
| 1,200.00 | espresso | 316.30 [314.19, 318.41] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 4.50 [4.50, 4.50] |
| 1,200.00 | americano | 313.73 [311.92, 315.55] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 4.50 [4.50, 4.50] |
| 100,000.00 | espresso | 316.30 [314.19, 318.41] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 4.50 [4.50, 4.50] |
| 100,000.00 | roll | 277.77 [277.25, 278.29] | 21.87 [20.94, 22.79] | 213.73 [210.76, 216.71] | 4.16 [4.11, 4.20] |
| 10,000,000.00 | espresso | 316.30 [314.19, 318.41] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 4.50 [4.50, 4.50] |
| 10,000,000.00 | fruittea | 305.50 [303.87, 307.13] | 0.10 [-0.04, 0.24] | 0.00 [0.00, 0.00] | 4.43 [4.41, 4.46] |
| 1,000,000,000.00 | espresso | 316.30 [314.19, 318.41] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 4.50 [4.50, 4.50] |
| 1,000,000,000.00 | rye | 286.53 [285.35, 287.71] | 17.17 [15.88, 18.46] | 373.87 [366.46, 381.27] | 4.23 [4.20, 4.27] |
| 100,000,000,000.00 | espresso | 316.30 [314.19, 318.41] | 0.00 [0.00, 0.00] | 0.00 [0.00, 0.00] | 4.50 [4.50, 4.50] |
| 100,000,000,000.00 | brioche | 261.13 [260.44, 261.82] | 31.67 [30.77, 32.56] | 342.93 [337.42, 348.44] | 4.02 [3.98, 4.06] |

## Interpretation and balance recommendation

Do not nerf espresso merely because it dominates initial item spending. The paid kitchen/roll route provides an observed intermediate transition, tea becomes competitive at a larger budget, and expensive bakery routes can overcome much higher purchase costs. These counterexamples preserve a useful early espresso identity without locking the whole economy into that item.

This narrow investment experiment does not establish that every recipe is useful at every point, that a proxy leader is globally optimal, or that broad menus, aesthetics, cats, and promotion strategies should be flattened into equal yields. Variety, role-play, visual preference, combos, and service tradeoffs are separate legitimate goals. Any balance change should be supported by the wider menu/service/cat/promotion experiments, and progression-time testing with reinvestment would be a separate study.

## Validation

- Paid-prerequisite/kitchen/reserve construction assertions pass.
- Same-seed reruns match exactly for every simulated route. Route construction resets scene height and kitchen layout before forecasts; an explicit prior-layout-contamination regression passes.
- All recorded samples reconcile wealth and profit accounting and have no closing timeout.
- `npx tsc --noEmit` passes; this harness changes no production source.
- Gameplay source SHA-256 at execution: `0b73358c463ed8805ac4d16e7d0c831eec28bfed99fb0b5b19b7156422bd76cf`.

## Related thirty-day operating evidence

See [the fixed-policy long-horizon study](LONG-HORIZON.md) and [its upgraded-espresso attraction supplement](LONG-HORIZON-SUPPLEMENT.md) for actual 30-day intervention returns, first-crossing versus terminal payback, and stage-sensitive cat/promotion outcomes. These complement, rather than replace, this paid-unlock capital comparison.
