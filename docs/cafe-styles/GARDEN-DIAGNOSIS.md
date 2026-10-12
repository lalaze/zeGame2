# Garden dominance diagnosis and proposed next experiment

**Status: stronger route-balance acceptance remains unmet.** No gameplay changes or new simulation trials have been made for this diagnosis. The completed `final-v1` evidence is preserved unchanged; its older pairwise gates are not enough to certify a genuine garden frontier niche.

## Exact failure

Coffee dominates garden in all nine original common-asset mean comparisons. Its paired descriptive 95% intervals favor coffee on **all five metrics in every cell**, and every loss-rate comparison survives the conservative pending-outcome bound. This is not just a close mean ranking. Intervals are not simultaneous/multiplicity-adjusted.

| Garden cell | All mean-dominating routes |
| --- | --- |
| early/base | coffee, cats, takeaway |
| early/feature | coffee, cats, takeaway |
| early/rush | coffee, cats, takeaway |
| mid/base | coffee |
| mid/feature | coffee |
| mid/rush | coffee |
| late/base | coffee, cats, takeaway |
| late/feature | coffee, cats, takeaway |
| late/rush | coffee, cats, takeaway, community |

The only ambiguous component among those mean-dominance links is late/base cats versus garden waste: cats improves 13.77 coins, CI [−15.68, 43.21], 17/30 seed wins. Coffee and takeaway still robustly dominate that cell. All paired rows and wins are retained in [the machine-readable diagnostic](results/garden-v1-diagnostic.json).

Below, deltas are **coffee minus garden**, so negative loss/waste and positive profit/rating/served favor coffee. Each bracket is a paired 95% interval over 30 seeds; loss units are percentage points.

| Cell | Net profit Δ, coins | Loss rate Δ, pp | Waste Δ, coins | Rating Δ | Served Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| early/base | 3,483.5 [3,291.5, 3,675.4] | -2.13 [-2.41, -1.84] | -135.5 [-147.3, -123.7] | 0.096 [0.062, 0.130] | 9.5 [7.1, 12.0] |
| early/feature | 5,277.1 [5,062.4, 5,491.7] | -7.68 [-8.11, -7.25] | -64.1 [-74.6, -53.6] | 0.380 [0.332, 0.427] | 63.3 [58.9, 67.7] |
| early/rush | 12,964.6 [12,694.2, 13,234.9] | -38.68 [-39.74, -37.62] | -26.7 [-32.7, -20.6] | 0.899 [0.852, 0.946] | 397.2 [384.8, 409.5] |
| mid/base | 34,787.2 [34,065.3, 35,509.0] | -2.28 [-2.57, -2.00] | -902.9 [-939.6, -866.3] | 0.183 [0.144, 0.221] | 14.8 [11.0, 18.5] |
| mid/feature | 44,212.5 [43,316.8, 45,108.1] | -6.53 [-6.99, -6.07] | -773.9 [-790.7, -757.0] | 0.294 [0.246, 0.343] | 59.5 [53.3, 65.7] |
| mid/rush | 69,190.9 [68,292.0, 70,089.8] | -15.28 [-15.70, -14.87] | -725.9 [-730.4, -721.3] | 0.413 [0.341, 0.484] | 181.4 [176.6, 186.3] |
| late/base | 3,471.5 [2,438.0, 4,504.9] | -9.85 [-10.34, -9.36] | -693.8 [-715.0, -672.5] | 0.592 [0.482, 0.702] | 89.0 [82.3, 95.8] |
| late/feature | 4,969.3 [3,942.2, 5,996.4] | -12.94 [-13.56, -12.32] | -717.5 [-741.2, -693.8] | 0.469 [0.361, 0.578] | 111.9 [103.7, 120.0] |
| late/rush | 6,417.6 [5,129.6, 7,705.7] | -10.82 [-11.52, -10.12] | -799.4 [-843.3, -755.4] | 0.603 [0.493, 0.714] | 137.6 [128.6, 146.7] |

Garden still benefits from its own focus and can beat a weaker comparator. For example, mid/base garden versus bakery earns +4,742.4 net coins [4,351.2, 5,133.6], with 30/30 wins, but wastes 486.1 more coins and scores 0.153 fewer stars. That establishes a pairwise tradeoff, not a nondominated garden niche.

## Attribution supported by current evidence

### 1. Early is a pre-pastry transition, not a complete pairing strategy

The original early menu is blacktea + **roll**, and roll is bread. `teaPastryMeal` requires tea + **pastry**. Thus early garden never exercises the 12% paired-ticket premium or 50% eligible-pair probability, while its tea orders still get 80% seating and +6 seconds dwell. The regular 6% tea premium can apply. Preserve this as a valid transition-stage result, but do not present it as the complete afternoon-tea pairing strategy.

### 2. Equal ownership was valid; productive menu allocation was narrow

All compared common portfolios have genuinely identical paid assets/capital. However, identical ownership does not make every menu earn equally:

| Stage | Coffee menu price levels before tips/style | Garden menu price levels before tips/style |
| --- | --- | --- |
| Early | espresso Lv5: 20.33 | blacktea Lv1: 9; roll Lv2: 17.42 |
| Mid | cappuccino Lv2: 76.22 | hotchoc Lv1: 30; scone Lv1: 32 |
| Late | flatwhite Lv1: 60 | lemontea Lv1: 55; cookie Lv1: 60 |

Late takeaway's cortado is also Lv1 but sells for150 before modifiers. Its level costs16,000 versus lemontea's2,800; this Lv1 difference is not equal productive investment. The common round-robin rule plus expensive prerequisite assets leaves many late productive capabilities near their minimum.

### 3. Late rooms consume most of the shared capital

Reading→greenhouse→terrace costs259,200 coins, roughly85% of the shared305,902.60 capital. Every late target recipe remains Lv1, no signatures are purchased, and only two baristas, servers and cooks are available. These exact facts are in raw setup metadata.

The route-shaped garden portfolio spends a comparable305,102.52 capital but has lemonteaLv4, cookieLv3, both signatures and three of each worker. Pre-tip prices are278.67/212. Its base operating profit is230,956.86 versus50,274.63 for common garden. That large allocation sensitivity does not erase the within-common dominance; it limits generalization from this particular late fixture.

The actual pre-existing earned garden late snapshots use **blacktea25 + scone25 with signatures**, not lemontea1 + cookie1. Their paid capital is423,081–423,330, cash70,164–172,699, and pantry929–965. Fixed seed1592594996 reaches late at2,264.85 seconds with423,330.27 capital,156,940.23 cash and950 pantry. Its source fingerprint matches final-v1. This supports deriving a new fixture from recorded stage capability rather than choosing a convenient larger budget after seeing outcomes.

### 4. Throughput, food cost and ticket value both matter

Mid/base coffee collects106.23 revenue per served guest versus garden63.59. Garden wastes902.9 coins and serves14.8 fewer guests. Pending guests average2.9 versus3.1; live food costs6.8 versus202.2. Neither is large enough to explain the34,787 profit gap.

Late/base garden actually collects **more per served guest** than coffee (123.03 versus89.63), but serves89 fewer, wastes693.8 and spends278.7 seconds closing versus239.3. Garden's extra seating/dwell, real pairing workload and delivery through the multi-room layout are plausible mechanisms consistent with these records. The data do not causally separate them: a new controlled ablation would be required before attributing an exact share to each.

### 5. The fixed 30-minute horizon is not the explanation

Coffee's served/open-second and operating-profit/open-second paired intervals also favor coffee in all nine cells. The conservative pending-guest loss bounds remain positive throughout. Dropping common capital cannot reverse a same-capital ranking, and excluding closing time does not rescue it. A longer real horizon may affect payback, but the current evidence does not establish a ranking reversal.

## Static equal-productive-capital check

These are actual price/level formulas, **not new Sim outcomes**. Start with the genuine starter espresso. Lemontea prerequisites cost990 (blacktea90+hotchoc900), total Lv1 unlock3,790. Cortado prerequisites cost5,360 (americano40+latte120+cappuccino1,200+flatwhite4,000), total Lv1 unlock21,360. Each recipe buys the largest integer level fitting the same cap and keeps residual cash.

Lemontea consumes23 ingredient coins and2.5 base prep seconds; cortado3 coins and2.6 seconds. Level cost grows by1.12, and normal price milestones are retained. Signatures are excluded from this table; they separately cost1,100/3,000 and require100 prior servings.

| Equal cap including prerequisites | Recipe | Level | Actual total spent | Retained cash | Raw price | Raw contribution / base prep second |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 6,000 | lemontea | 1 | 3,790.00 | 2,210.00 | 55.00 | 12.80 |
| 6,000 | cortado | unavailable | — | — | — | — |
| 15,000 | lemontea | 4 | 14,372.12 | 627.88 | 278.67 | 102.27 |
| 15,000 | cortado | unavailable | — | — | — | — |
| 30,000 | lemontea | 7 | 29,239.23 | 760.77 | 590.33 | 226.93 |
| 30,000 | cortado | 1 | 21,360.00 | 8,640.00 | 150.00 | 56.54 |
| 60,000 | lemontea | 11 | 58,822.83 | 1,177.17 | 1,274.53 | 500.61 |
| 60,000 | cortado | 3 | 59,350.40 | 649.60 | 530.00 | 202.69 |
| 120,000 | lemontea | 15 | 105,373.20 | 14,626.80 | 2,090.00 | 826.80 |
| 120,000 | cortado | 5 | 107,005.56 | 12,994.44 | 1,016.67 | 389.87 |

These equal-capital curves favor lemontea at feasible matched caps. They do **not** prove a garden niche, because they exclude focus, tips, VIPs, service overhead, travel, seats, stock, waste and capital recovery. They do show why the Lv1 margin comparison150−3 versus55−23 is insufficient grounds for changing ingredient costs or adding a larger premium.

## Follow-up plan approved and frozen separately

A new experiment must retain all original failures and use a new label/design fingerprint. Do not change gameplay first.

1. Anchor shared late ownership to the union of **all six** already-recorded actual late-stage snapshots at seed1592594996, generated before this dominance finding. Rebuy every prerequisite, item level, research, cat, room, décor/furniture and worker through actual APIs. Maxima/union rules and a deterministic legal common layout must be written before sampling. Resolve equipped-slot conflicts by a fixed capability/comfort rule, not outcomes. This is a derived common-capability fixture, not an organically earned single save.
2. Give every choice exactly the resulting same paid capital/ownership and total funding, including a declared12% working-cash reserve. Reconcile included prepaid care and retain all residual money. Common progress and initial rating must be identical and explicit. Do not merge saved cash or pantry endowments from six cafés.
3. Use every distinct pre-existing late growth menu as **the same candidate menu pool for all six focuses**, plus one no-focus control per menu. No garden-only menu optimization. Any compact/pair expansion must likewise be preregistered and available to every style.
4. Minimal targeted discovery is base pressure × all menus × six focuses+plain × the original30 fixed seeds. This is at most42 cells/1,260 samples if six distinct menus exist. Preserve the exact1,800-second clock, paid stock/care, loss accounting and no terminal bonus.
5. Garden must face **all competitor menu choices**, not only their original untuned menus. Require a material focus/plain benefit and a genuine nondominated tradeoff on primary outcomes; throughput alone or a noisy failure to reject dominance is insufficient. Fix the exact decision rule before running.
6. If a candidate survives, freeze it and confirm with a predeclared disjoint30-seed holdout. Then run the prespecified feature/rush regression for the affected scenario family. If it fails, report failure rather than selectively changing menus, budgets or premiums.

This diagnosis was completed before any follow-up samples. The five-menu earned-union plan was subsequently approved and frozen in [its immutable preregistration](EARNED-UNION-PREREGISTRATION.md); training began at 11:27 UTC. The final approved pool has five menus, 35 policies and 1,050 training samples. [Execution/results](EARNED-UNION-RESULTS.md) are recorded separately.
