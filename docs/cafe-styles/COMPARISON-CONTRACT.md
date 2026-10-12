# Six-style comparison contract

Status: the original matrix is complete, but the stronger requirement for a genuinely nondominated garden niche is not met. Preserve those results; see [the diagnosis](GARDEN-DIAGNOSIS.md) and [the separately frozen earned-union follow-up](EARNED-UNION-PREREGISTRATION.md). Passing the original pairwise verifier is not overall completion.

## What is being compared

This is a controlled experiment against the actual `Sim`, purchasing APIs, kitchen, stock, navigation, seats, reviews, care, promotions and closing process. It is not a substitute economy model and is not proof of a fresh-save progression path.

The pre-registered matrix is:

- Two panels: `common-assets` and `route-purchases`.
- Three capital-stage fixtures: early 1,800 coins, mid 15,000, late 350,000.
- Three pressure policies: base has no campaign; feature buys actual `noteLocal` (+25% traffic, 50 coins for 360 open seconds); rush buys actual `clipStar` (+100%, 180 coins for 180 open seconds). A campaign renews during preparation when it has expired and is affordable. Actual charged expenses, leftover prepaid airtime and failed bookings are recorded. These are paid marketing policies, not cost-free exogenous traffic multipliers.
- Six menu/operating policies: coffee, bakery, cats, takeaway, garden, community.
- Thirty predetermined seeds: `(0x5eed1234 + i * 2654435761) >>> 0`, i = 0…29.
- Untouched baseline has 108 plain-policy scenarios. Final code has 216 scenarios, one focused and one no-focus control for each portfolio/menu/pressure combination.

Every same-stage comparison starts with the same total funding, starter espresso and furniture, zero raw pantry, neutral reputation, calendar day, recipe experience, tutorial-reward exclusion, and observation clock. No cash, stock, room, recipe, research, paid furniture, cat or staff investment is silently gifted to an individual policy.

### Panel A: equal actual capital and ownership

`common-assets` pays for the identical shared portfolio before selecting a menu/focus. The purchase ledger, item levels, staff, kitchen, cats, rooms, decoration, signatures, unspent cash and starting progress are asserted identical across all six policies within each stage. This panel is the strict equal-investment comparison. Recurring expenses during operation can legitimately differ because the style changes activity or open/closing time; every difference is included in profit.

The shared portfolio contains the prerequisites of all six menus. It also includes a paid ginger cat, cactus sill, machine upgrades and a legally placed wall poster. Later stages pay for additional cats, staff, comfort and rooms, including all prerequisites of the terrace in the late fixture. Remaining investment cash buys menu levels in an identical declared round-robin order. Exact transactions, item levels and coordinates are preserved in each dataset's setup metadata.

This panel deliberately pays for capabilities that some policies do not use. It isolates operating choices on one matched asset base; it is not a recommended purchase plan.

### Panel B: equal funding, route-shaped capital

`route-purchases` starts from the same starter ownership and stage progress, buys the relevant recipe prerequisite chains and kitchen, then the declared route equipment, cats, room prerequisites, decoration and eligible signatures. It then cycles selected-menu level purchases until the next affordable level no longer fits outside the protected working reserve.

Every purchase uses the real gameplay API and its actual cash deduction. All policies protect 12% of initial funding as working cash. Their spent capital differs because prices and indivisible purchases differ. Funding equals purchase cash plus unspent cash exactly; the capital and prepaid-care split is independently reconciled.

Equal funding is not mislabeled as equal spent capital. The panel shows the practical opportunity cost of route-shaped purchases, while Panel A supplies the literal matched-capital comparison. No leftover money is destroyed merely to force equal spending. Maximal menu-level investment is a transparent fixed policy, not a claim of optimal reinvestment.

## Starting progress and provenance

Stage fixtures have days 1/10/30 and 0/100/300 prior served portions per recipe, respectively. The same declared experience is available to every policy, even if its portfolio does not unlock a recipe. Research is never free: when selected, it uses the real research API and pays its real cost. Starting rating is neutral and empty, rather than a synthetic perfect reputation.

Those common experience/calendar fixtures are explicitly endowed experimental progress. Neither they nor the cash budgets establish that a real player has reached that state. Fresh-save runs must separately start with the actual starter beans, ordinary goals and earned cash, and record legal purchase order, elapsed play time, reloads and ending state. Browser screenshots of fixtures demonstrate actual rendering, not organic progression. Real fresh-save screenshots must be labeled separately.

The untouched source snapshot was copied before style hooks changed, from tracked-clean HEAD `3d9c6b95914a52f100db582608f424a9af2bd683`. Its gameplay SHA-256 is `5c0d2f7464a95274172b8c62f95083822abb8cc111f04edd41d96643a85bba4e`. Existing older economic datasets have a different source fingerprint and cannot serve as this task's untouched baseline.

## Exact clock and closing

Each sample advances exactly 36,000 real `Sim.update` calls at 0.05 seconds: 1,800 seconds total. Opening windows last 180 seconds. The game then closes its doors, naturally drains accepted service, closes its books, prepares and immediately reopens. Preparation and administrative transitions use zero simulated time. Natural service drain consumes the same fixed clock as opening time.

No final settlement, forced sale, extra drain, restock, new booking or future revenue occurs at or after the cutoff. Terminal live service remains live. A drainage time above 300 seconds is an explicit failed sample, not a forced cancellation that conceals a pathfinding or kitchen failure. No warm-up is removed from the primary result.

The previous 8/30-day runner remains useful for long-horizon settled-day diagnostics, but it provides variable extra drain time to different policies. It must not be presented as this equal-elapsed-time comparison.

## Economic ledger

Starting liquid wealth is the entire stage funding envelope. At the exact terminal clock:

`liquid wealth = cash + raw pantry at purchase cost + unused cat care at purchase cost + unused promotion airtime at purchase cost`

`net-liquid profit = terminal liquid wealth − starting funding`

`net-liquid profit = revenue − consumed ingredients − consumed cat care − consumed promotion airtime − purchased capital`

Cat adoption includes its first care pack. That paid care is prepaid supply, not capital; the adoption price minus that pack is sunk capital. Recipe levels, kitchen, staff/equipment, rooms, paid décor/furniture and research are sunk capital with zero assumed resale value.

An independent total cash identity checks:

`terminal cash = initial cash + actual sale revenue − portfolio cash − ingredient purchases − campaign purchases − care refills`

Care refill spending in each row is inferred from consumed care plus terminal prepaid care minus initially included care. It is not a separately observed transaction ledger; the total cash identity independently checks the resulting aggregate spending.

Prepared shelf food, kitchen work and accepted unpaid orders remain expensed in primary wealth. Their physical ingredient cost is reported separately, without invented salvage, refund or guaranteed future-sale value. Accepted orders are deduplicated by customer rather than adding overlapping barista/pass/server representations.

Waste is consumed ingredient cost less sold ingredient cost less eligible live paid food at the cutoff. Closed-day stale food is also recorded separately. The generator computes sold-food ingredient cost from real sales, but that intermediate is not retained in each row: the artifact reader independently checks waste bounds and live-food sums, rather than claiming it can reconstruct the exact waste subtraction. This avoids calling a still-live drink or oven batch terminal waste, and avoids crediting it as liquid wealth.

## Guest outcomes

Report net-liquid profit, operating profit, actual cash profit, served guests, missed guests, door losses, queue removals at closing, total unmet demand, waste, rating, care, promotion spending, actual opening time and closing time.

`missed + doorLost` alone is incomplete: `Sim.beginClosing` sends the waiting queue home without incrementing either counter. Therefore `unmetDemand = missed + doorLost + queueRemovedAtClosing`, while the components stay visible. Terminal active unpaid guests are reported separately; they are pending, not already lost or served. Missing add-ons are not counted as lost guests.

The original `lossRate = unmetDemand / arrivalAttempts` includes terminal pending guests in the denominator. It is the **observed-by-cutoff** loss rate, not an eventual loss probability. The verifier retains this original paired result and additionally reports a resolved-outcomes rate and a conservative pending-outcome bound. For a favorable loss-rate claim it assumes all treatment pending guests fail while every control pending guest succeeds, then requires the same 0.5 percentage-point mean improvement and positive paired lower confidence bound. This stronger sensitivity rule was added after the pilot and partial full-matrix review identified censoring risk; it can reject an original favorable result but cannot rescue an unfavorable one. Every disagreement stays in the acceptance artifact.

Rating is the terminal score from the latest 50 reviews, not the average of every guest's satisfaction over the window. Longer waits and departed guests can affect which reviews reach that terminal window.

The stock policy is the actual forecast bake and cash-constrained restock. Cash-constrained restocks and failed campaign bookings are retained so a nominal rush row is not mistaken for guaranteed full exposure. The forecast is an approximation: it does not fully model travel, servers, seat occupancy, pass blockage, long kitchen paths or review feedback.

## Payback and inference

Own-portfolio payback is the first observed actual tick at which cumulative operating profit covers purchased capital. An unrecovered investment is `null`, right-censored at 1,800 seconds, never zero seconds. Terminal recovery is reported separately because an earlier crossing can reverse. Stored 180-second checkpoints validate consistency with the tick-level crossing, but cannot independently establish its exact first tick; that claim depends on the fingerprinted generator. This is not incremental payback against another portfolio.

Focused versus no-focus rows use identical paid ownership, menus, progress, initial cash and seed labels. Their paired net-profit, served, unmet-demand, waste and rating deltas isolate the focus effect on final code. Focus selection has no purchase price, so incremental capital payback is not applicable. Historical-before versus final-plain changes are reported separately from focus effects.

Thirty-seed summaries retain means, SDs, medians, ranges and descriptive Student t29 intervals. Different policies consume the RNG on different paths; shared seeds do not mean identical individual customers. Confidence intervals are not adjusted for searching many scenarios. A selected favorable cell is exploratory until its mechanism is reproduced on an independent fixed holdout seed set.

Meaningful route evidence must name a predeclared, mechanically defensible metric and its tradeoff. A route does not have to maximize every metric, and a lower-profit but reliable/capacity-saving route must show the economic cost openly. Faster bakery-only kitchen work can be an unqualified local gain on the same portfolio; do not invent a downside if the experiment finds none. No reward money or benchmark-only multipliers are added to manufacture a winner.

## Verification and resumption

Ordinary focused tests validate matrix shape, paid assets, exact common ownership/progress, reserve protection, exact cutoff, layout reset, reconciliation and supported focus changes. They do not run the full economic matrix. Full evidence is opt-in with `CAFE_STYLE_LAB=1`.

Each raw result includes source/design fingerprints, scenario identity and seeds. Partial files are explicitly incomplete. A source/design/scope/seed mismatch refuses resumption. Partial batches checkpoint every five seeds and completed scenarios checkpoint atomically. An incompatible correction gets a new label, preserving the prior data and failure reason.

The first one-seed pilot revealed a legal floor-fern placement that blocks a seated customer in the untouched game and exceeds the drain guard. Its partial data and failure logs are retained under `results/pre-correction`; the corrected comparison uses a paid cactus sill plus wall poster, which meets the same comfort/plant eligibility without an avoidable floor obstruction. This correction changes fixture design and is not claimed as a gameplay navigation fix.

### Current verified checkpoint and commands

The corrected untouched one-seed pilot completed all 108 scenarios in 232.68 seconds. Its maximum absolute economic/cash reconciliation error was below 0.00000003 coins. This is a smoke test, not the thirty-seed acceptance matrix.

For the common-asset pilot portfolio, actual paid capital / purchase cash / retained starting cash were:

- Early: 1,568.42277888 / 1,576.42277888 / 223.57722112 coins.
- Mid: 13,177.40 / 13,197.40 / 1,802.60 coins.
- Late: 305,902.60 / 305,940.60 / 44,059.40 coins.

Capital differs from purchase cash only by the included unused care packs at this point. Within each stage those exact amounts and assets match every style. Inventory and recurring expenses are then purchased and expensed normally.

For a single full current-code run:

```sh
CAFE_STYLE_LAB=1 CAFE_STYLE_LABEL=styles-v1 npx vitest run scripts/cafe-style-balance.test.ts --silent=false --disableConsoleIntercept
```

To run six independently resumable shards, give each process `CAFE_STYLE_SHARDS=6`, `CAFE_STYLE_SHARD=0` through `5`, and labels `styles-v1-shard0` through `styles-v1-shard5`. All processes must use the same immutable source/harness snapshot and output directory. `CAFE_STYLE_RESULTS_DIR` can specify that output directory. Use `CAFE_STYLE_BASELINE=1` only with the untouched source snapshot to omit focus rows. `CAFE_STYLE_PILOT=1` explicitly restricts runs to one seed and must never be enabled for acceptance evidence.

After all six shards finish:

```sh
CAFE_STYLE_MERGE=styles-v1 npx vitest run scripts/cafe-style-balance.test.ts --silent=false --disableConsoleIntercept
```

The merge refuses missing/incomplete shards, overlapping scenarios, mismatched source/design/seed fingerprints and incomplete seed batches. Merged final summaries calculate focus/plain paired comparisons across shard boundaries. The 108-scenario untouched thirty-seed run is complete: all 3,240 samples are merged as `untouched-v4.json`, with its six immutable shard checkpoints retained.

### Completed-artifact acceptance reader

After `untouched-v4.json` and `final-v1.json` are completely merged, run:

```sh
CAFE_STYLE_VERIFY=1 npx vitest run scripts/cafe-style-verify.test.ts --silent=false --disableConsoleIntercept
```

This artifact-reader verifier checks the exact 30 seeds, 108/216 scenario coverage, untouched/current gameplay fingerprints, the current runner design, exact clock, independently reconstructed economic identities and event counters, purchase capital/care splits and reserves, payback/checkpoint consistency, closing-queue loss accounting, literally identical common-asset ledgers, and every route-purchase focus/plain portfolio. It does not simply trust stored zero residuals. It writes `results/final-v1-acceptance.json` before asserting the economic criteria, so a failure remains inspectable rather than disappearing into a summary.

Its reasonable-stock sustainability panel is the 18 focused route-purchase/base-pressure cells: each route at each capital stage must have positive operating-profit lower confidence bound and no cash-constrained procurement in any seed. Positive operating profit across all focused pressure cells is checked additionally, but no claim of capital recovery is implied.

The verifier keeps focus/plain comparisons, same-asset between-route comparisons and historical-before/final-plain repairs separate. A favorable between-route result means an advantage over at least one other style under identical assets; it does not mean best-in-cell, nondominated, or universally superior. Meaningful favorable-cell gates require a paired 95% improvement interval above zero and a mean improvement of at least one unit and 1% for money, served guests and waste; 0.5 percentage points for lost-guest rate; or 0.05 stars for rating. These deliberately modest materiality thresholds are declared before the full matrix completes. Fewer raw lost guests alone never qualifies. Served throughput is supporting evidence and cannot satisfy a route’s favorable-scenario requirement by itself. The output includes seed wins and all tradeoff metrics, and marks searched favorable cells exploratory because it does not apply a multiple-testing correction or claim global superiority.

The frozen final one-seed pilot completed all 216 cells with no accounting or drainage failure. Its gameplay fingerprint is `9c47eab7d2f2b1fe47e094df3f22c41f6a6a51043c338e952a6de37a27352c4d`, with design fingerprint `547d41cd492f63746f333ce8c70612bdbd3bed17d79aa1852a5c2dfb14387b1e`. The baseline and final full matrices use that same runner design. The full final matrix is now complete: all 6,480 final samples and 3,240 untouched samples are merged, and the five-test artifact verifier passes. Pilot confidence or winner counts are not acceptance evidence; see [the completed quantitative report](BALANCE.md) for full-matrix results and limits.

### Exact commands for the delivered labels

From the frozen final checkout, run each shard `N=0` through `7` (concurrency is optional; keep the total at or below available CPUs):

```sh
N=0
CAFE_STYLE_LAB=1 CAFE_STYLE_SHARDS=8 CAFE_STYLE_SHARD="$N" \
  CAFE_STYLE_LABEL="final-v1-shard$N" \
  CAFE_STYLE_RESULTS_DIR="$PWD/docs/cafe-styles/results" \
  ./node_modules/.bin/vitest run scripts/cafe-style-balance.test.ts --silent=false --disableConsoleIntercept
```

Repeating the exact command resumes compatible saved seeds rather than overwriting or redoing them. It refuses source, runner, scenario-scope or seed changes. Any deliberate design change needs a new label and both sides rerun.

For the untouched baseline, use the preserved pre-change game source at the recorded baseline commit and copy in the **same two harness files only**. From that checkout run each `N=0` through `5` with an absolute shared output path:

```sh
N=0
RESULTS=/absolute/path/to/zeGame2/docs/cafe-styles/results
CAFE_STYLE_LAB=1 CAFE_STYLE_BASELINE=1 CAFE_STYLE_SHARDS=6 CAFE_STYLE_SHARD="$N" \
  CAFE_STYLE_LABEL="untouched-v4-shard$N" CAFE_STYLE_RESULTS_DIR="$RESULTS" \
  ./node_modules/.bin/vitest run scripts/cafe-style-balance.test.ts --silent=false --disableConsoleIntercept
```

Once each set is complete, merge from the final checkout and verify the delivered artifacts:

```sh
CAFE_STYLE_MERGE=untouched-v4 ./node_modules/.bin/vitest run scripts/cafe-style-balance.test.ts --maxWorkers=1
CAFE_STYLE_MERGE=final-v1 ./node_modules/.bin/vitest run scripts/cafe-style-balance.test.ts --maxWorkers=1
CAFE_STYLE_VERIFY=1 ./node_modules/.bin/vitest run scripts/cafe-style-verify.test.ts --maxWorkers=1
```

The merge reads recorded shard metadata; it does not simulate or claim the current checkout is the baseline. The final verifier recomputes the current gameplay and runner fingerprints, checks the pinned untouched hash, and refuses stale evidence. Use `CAFE_STYLE_FINAL_LABEL` and `CAFE_STYLE_BASELINE_LABEL` only for alternate complete labels with the same pinned source/design contract. Do not use `CAFE_STYLE_PILOT=1` or a scenario filter for acceptance.


### Earned-capability follow-up and preserved failure

The [separate frozen protocol](EARNED-UNION-PREREGISTRATION.md) reconstructs a literal common paid union of the six pre-existing actual late-stage capabilities. Its five recorded menus are offered to all six focuses plus plain. It uses a separate fingerprinted runner, 30 training seeds and 30 disjoint holdout seeds, and freezes the selected menu plus every primary-metric comparison before holdout. Original source, accounting harness and v1 failures remain intact.

All 2,100 training/holdout samples completed. One frozen profit edge, garden versus same-menu cats, did not reproduce; that stricter auxiliary scientific gate remains failed. No metric substitution or replacement selection is allowed. A timestamped review decision separately authorized the originally planned feature/rush sustainability regression despite the failed conditional prerequisite. The original protocol is not rewritten, and the failed claim is not marked as passed. The [execution/results report](EARNED-UNION-RESULTS.md) contains the exact resumable training, holdout, merge and verification commands, all fingerprints, the genuine failed assertion and full paired results.


The authorized pressure regression is complete: all 70 cells / 2,100 samples have positive operating-profit lower bounds and no constrained restocks or failed campaign bookings. The pressure reader passes sustainability while retaining its false all-edge flag: feature confirms 34/34 frozen edges, rush 33/34, with a real cats profit advantage. The base-holdout reader still intentionally fails the original conjunctive gate. No test has been changed to assert that this failed gate passed. Complete scope, costs, censored payback and caveats are in the linked results and [independent acceptance review](ACCEPTANCE.md).
