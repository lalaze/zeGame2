# Signature drink balance and operational evidence

## Reproduction

Run `npx vitest run src/game/signature-operations.test.ts src/game/signature-balance.test.ts --silent=false`.

The default suite has twelve passing tests and one opt-in final lab. Tests cover all four bases in actual service, dose-based forecasts, restocking, poor-budget recovery, atomic shortage handling, a custom/bakery combo, ingredient accounting, practice/reviews, mid-close restoration, restoration after payment, exactly-once settlement, and recipe-sensitive quality under service review caps. No UI save or live port is used.

The balance test uses seeds 12, 98, 143, 180 game seconds of arrivals, 0.05-second updates, followed by graceful closing until accepted service finishes. Every scenario has identical initial staff, machine, tables, layout, neutral café style, plentiful stock, all stock dishes unlocked at level 1, and only the named drink on sale. Marketing is either 0 or 12. The only custom trial occurs before opening; its quarter-portion consumption is separate from service ingredient cost. Results are averages across three seeds; currency is game coins.

Unlock expenditure is deliberately excluded, so these are service comparisons, not total progression ROI. The rich recipe requires cream to have been legitimately unlocked in ordinary play. VIP randomness, physical walking/seating and service-driven reputation all remain active. Seeds are deterministic per scenario, but changing recipe duration changes subsequent random draws, so these are reproducible scenario comparisons rather than perfectly paired customer cohorts. `missed` is the game's recorded losses; it does not count every hypothetical arrival prevented by the existing service-rate cap.

## Final evidence: 30 fixed seeds, equal raw-material budget

Run `SIGNATURE_BALANCE_LAB=1 npx vitest run src/game/signature-balance.test.ts --silent=false` to reproduce. The completed run took approximately 8.3 seconds and passed all four balance tests. The default suite retains a quick three-seed pilot and skips the full lab.

Raw evidence: [balance-raw.json](evidence/balance-raw.json), with all 480 individual runs, the pre-fixed 30-seed list, protocol, inputs, and summaries. Each stock/custom pair resets the exact same LCG stream. Service timing changes how later draws are assigned to events, so random-number streams are identical but customer-event cohorts are not forcibly aligned.

All paired runs start with 1,000 coins, zero pantry inventory, the same unlocked stock dishes at level 1, default machine/staff/comfort/tables, neutral style, no kitchen and no companion menu dish. They buy complete recipe sets through the real ingredient-purchase API with a 300-coin cap. Purchases total 299 or 300 coins because recipe quantities are indivisible; unspent cash remains in the account. No income is reinvested and there is no restocking. Normal pressure uses marketing 0; peak uses marketing 12. The comparison holds arrival duration at 180 seconds with 0.05-second updates, then gracefully drains accepted orders. Marketing upgrades are identical within each pair; their sunk costs and the common unlocked assets are excluded equally.

A custom trial consumes a quarter serving from the purchased inventory before opening. Its one-time R&D cost is listed separately. Reported consumption includes all service ingredients, even if the order is ultimately lost. Waste is consumption less the recipe cost of successfully delivered portions. Remaining pantry value is conserved: purchase = trial + service consumption + remaining inventory. Cash net = revenue − full purchase; earned margin = revenue − service consumption − trial. Neither treats leftover inventory as consumed. Every run asserts these identities. Observed service waste was zero in these representative pairs; the harness measures rather than assumes zero waste.

The pairs are coffee (custom beans1/milk2 vs latte), tea (custom tea1/milk1 vs black tea), milk (custom milk2/sugar1 vs hot chocolate), and fruit (custom fruit1/milk1/sugar1 vs smoothie). Stock hot chocolate is a milk-containing comparator, not a pure milk recipe. Smoothie has an existing level-1 price of 16,000 because it belongs to late progression; its huge revenue is deliberately reported, not normalized away. This experiment cannot establish late-game economic parity.

### Purchase and R&D allocation

| Pair | Stock purchase | Custom purchase | Stock trial | Custom trial |
|---|---:|---:|---:|---:|
| Coffee | 300 | 300 | 0 | 1.25 |
| Tea | 300 | 300 | 0 | 1.00 |
| Milk | 299 | 300 | 0 | 1.25 |
| Fruit | 299 | 299 | 0 | 5.75 |

### Mean observed financial outcomes, 30 seeds per row

| Pressure | Base | Kind | Revenue | Service consumed | Waste | Remaining pantry | Cash net | Earned margin |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Normal | coffee | stock | 358.33 | 98.30 | 0.00 | 201.70 | 58.33 | 260.03 |
| Normal | coffee | custom | 321.33 | 150.00 | 0.00 | 148.75 | 21.33 | 170.08 |
| Normal | tea | stock | 355.80 | 71.87 | 0.00 | 228.13 | 55.80 | 283.93 |
| Normal | tea | custom | 302.40 | 134.93 | 0.00 | 164.07 | 2.40 | 166.47 |
| Normal | milk | stock | 750.00 | 299.00 | 0.00 | 0.00 | 451.00 | 451.00 |
| Normal | milk | custom | 321.33 | 150.00 | 0.00 | 148.75 | 21.33 | 170.08 |
| Normal | fruit | stock | 222933.33 | 299.00 | 0.00 | 0.00 | 222634.33 | 222634.33 |
| Normal | fruit | custom | 506.99 | 276.00 | 0.00 | 17.25 | 207.99 | 225.24 |
| Peak | coffee | stock | 359.33 | 99.00 | 0.00 | 201.00 | 59.33 | 260.33 |
| Peak | coffee | custom | 334.67 | 150.00 | 0.00 | 148.75 | 34.67 | 183.42 |
| Peak | tea | stock | 397.20 | 80.00 | 0.00 | 220.00 | 97.20 | 317.20 |
| Peak | tea | custom | 308.00 | 136.00 | 0.00 | 163.00 | 8.00 | 171.00 |
| Peak | milk | stock | 786.00 | 299.00 | 0.00 | 0.00 | 487.00 | 487.00 |
| Peak | milk | custom | 334.67 | 150.00 | 0.00 | 148.75 | 34.67 | 183.42 |
| Peak | fruit | stock | 225066.67 | 299.00 | 0.00 | 0.00 | 224767.67 | 224767.67 |
| Peak | fruit | custom | 496.64 | 276.00 | 0.00 | 17.25 | 197.64 | 214.89 |

### Mean observed service outcomes, 30 seeds per row

Wait is recorded from each actual successful customer handoff, averaged within each run, then across seeds. Review averages include failed visits/stockouts and therefore need not track successful-customer waits. Missed counts follow the existing game's accounting and exclude potential arrivals suppressed by its service-cap logic.

| Pressure | Base | Kind | Served | Missed | Successful wait seconds | Review average |
|---|---|---|---:|---:|---:|---:|
| Normal | coffee | stock | 32.77 | 0.00 | 16.47 | 3.89 |
| Normal | coffee | custom | 30.00 | 0.00 | 23.73 | 3.56 |
| Normal | tea | stock | 35.93 | 0.00 | 8.24 | 4.07 |
| Normal | tea | custom | 33.73 | 0.00 | 14.22 | 4.00 |
| Normal | milk | stock | 23.00 | 13.33 | 6.26 | 2.90 |
| Normal | milk | custom | 30.00 | 0.00 | 23.73 | 3.56 |
| Normal | fruit | stock | 13.00 | 21.33 | 7.86 | 2.14 |
| Normal | fruit | custom | 12.00 | 21.80 | 17.55 | 2.02 |
| Peak | coffee | stock | 33.00 | 0.00 | 34.72 | 3.06 |
| Peak | coffee | custom | 30.00 | 0.00 | 37.12 | 2.45 |
| Peak | tea | stock | 40.00 | 0.00 | 28.88 | 3.16 |
| Peak | tea | custom | 34.00 | 0.00 | 33.53 | 3.15 |
| Peak | milk | stock | 23.00 | 59.40 | 20.71 | 1.76 |
| Peak | milk | custom | 30.00 | 0.00 | 37.12 | 2.45 |
| Peak | fruit | stock | 13.00 | 69.10 | 23.07 | 1.40 |
| Peak | fruit | custom | 12.00 | 59.43 | 32.74 | 1.32 |

### Decision-relevant interpretation

- No risk-free custom advantage appears in these four pairs. Coffee and tea customs earn less than their stock comparators and have longer actual waits. A theoretical higher quality score does not automatically survive service bottlenecks.
- Milk custom has a useful budget-resilience tradeoff: 30 served and no stockouts in this sample, versus hot chocolate's 23 served and substantial stockout losses. Its average rating is better under both pressures, but profit is lower and successful customers wait longer. This is a credible use case, not universal superiority.
- Fruit custom has no demonstrated economic edge over unlocked smoothie. Both exhaust almost all usable portions, and custom's quarter-serving trial reduces delivered capacity by one in this fixed purchase allocation. Its fewer peak missed visits do not imply higher throughput: custom serves 12 versus 13, and differing service/arrival timing changes the attempted visits.
- Costly or heavily dosed recipes must be evaluated with working-capital demand, R&D consumption and service pressure. More theoretical margin per cup does not guarantee more cash or happier customers.
- Static espresso and latte numbers in the original three-seed unlimited-stock baseline remained exactly unchanged after custom-quality integration. The raw-budget protocol is an additional comparison, not a replacement or silent alteration of that baseline.

## Three-seed plentiful-stock smoke baseline (not final budget evidence)

| Drink | Recipe | Price | Ingredient cost | Prep seconds | Margin/prep second |
|---|---|---:|---:|---:|---:|
| Stock espresso | beans 1 | 3.00 | 1.00 | 1.20 | 1.67 |
| Stock latte | beans 1, milk 1 | 10.00 | 3.00 | 5.00 | 1.40 |
| Custom black | beans 1 | 3.60 | 1.00 | 3.65 | 0.71 |
| Custom milky | beans 1, milk 2 | 10.00 | 5.00 | 5.45 | 0.92 |
| Custom rich | beans 1, milk 1, cream 2, sugar 2 | 48.40 | 29.00 | 8.40 | 2.31 |

Margin/prep second is theoretical and excludes walking, seating, VIPs, tips and abandoned prepared orders. Measured daily profit below is revenue minus all consumed service ingredients, including waste.

| Drink | Marketing | Served | Missed | Profit | Review average |
|---|---:|---:|---:|---:|---:|
| Stock espresso | 0 | 35.67 | 0 | 95.33 | 4.08 |
| Stock latte | 0 | 33.00 | 0 | 271.00 | 3.81 |
| Custom black | 0 | 36.00 | 0 | 112.80 | 4.05 |
| Custom milky | 0 | 30.00 | 0 | 190.00 | 3.66 |
| Custom rich | 0 | 20.00 | 4 | 646.13 | 2.47 |
| Stock espresso | 12 | 107.33 | 0 | 226.67 | 4.24 |
| Stock latte | 12 | 33.00 | 0 | 284.33 | 3.07 |
| Custom black | 12 | 43.00 | 0 | 121.40 | 3.16 |
| Custom milky | 12 | 30.00 | 0 | 190.00 | 2.43 |
| Custom rich | 12 | 20.00 | 7 | 452.53 | 2.23 |

## Findings, implemented repair and remaining considerations

- No free espresso replacement: custom black earns a slightly better single-cup margin, but its 3.65-second preparation versus 1.2 seconds hurts throughput and ratings under pressure. Regression coverage preserves that tradeoff.
- The rich recipe is profitable but not universally dominant: it serves fewer guests, loses more orders, spends far more ingredients and gets substantially worse reviews. Ingredients are consumed when preparation starts; only successful handoffs generate revenue and practice. This is a genuine service risk, not a fabricated price penalty.
- Repaired a dominated-choice weakness: custom coffee with two milk still costs more than latte, prepares more slowly, and sells for the same price, but now has actual sensory quality 4.3 versus stock latte’s unpracticed 4.0. Prompt service produces a 4.3-star rather than 4.0-star review. Skilled/mastered custom practice adds 0.3/0.5, yielding 4.6/4.8 without raising the price. Integration coverage confirms the tradeoff and proves that slow service still caps the review at 3.0. This removes strict dominance on taste; it does not prove a profit advantage. In these fixed-staff samples milky still earns less and gets worse overall ratings because its service delay outweighs the quality benefit.
- The cost-plus rule rewards expensive inputs with larger absolute margins. At low demand the rich recipe leads the sampled profit comparison, despite its review damage. Future tuning should evaluate whole-day and multi-day reputation alongside profit; reducing the markup on expensive additions or adding diminishing returns is safer than granting an across-the-board custom price bonus. The parent implementation added bounded sensory quality; price, ingredient cost and preparation formulas remain unchanged.
- Custom prices are fixed while stock dish prices scale with purchased levels. These level-1 results do not establish late-game viability. Before adding custom price upgrades, compare custom pricing against current unlocked stock tiers, and keep the immutable recipe identity distinct from any purchased progression.
- Signature practice is recipe-keyed and awarded at handoff, so testing, naming, menu switching, preparation and refreshing do not grant experience. Three active custom recipes, six saved recipes and unique canonical recipe IDs constrain menu-variety duplication.

Recipe quality is 4.0 baseline, +0.1 for one add-on, +0.2 for double milk or cream (not stacked), −0.2 for double sugar, −0.1 for double spice, and −0.1 for three add-ons, bounded to 3.7–4.3 before practice. The rich sample therefore has quality 3.9, not a guaranteed taste improvement merely from using costly ingredients. These are gameplay rules, not nutritional or real-world recipe judgments.

## Limits

This is deterministic model evidence, not a visual usability test. The final 480-run lab is a one-day budget comparison; it does not claim long-term economic balance, statistical independence of state-coupled events, exhaustive recipe optimization, or late-game custom/static parity. Exact snapshots cover real service and settlement but are supplemented by the dedicated persistence/corruption suite owned by the persistence workstream.
