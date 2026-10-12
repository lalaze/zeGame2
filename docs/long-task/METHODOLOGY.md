# Economy experiment methodology

## What is being compared

Use the actual headless `Sim` and game purchase/production/settlement APIs, not a replacement revenue formula. Every scenario uses 30 or more deterministic PRNG seeds. Within a stage, menu-only alternatives share ownership, staff, layout, pantry, starting cash and open duration; these isolate selection, not unlock return. Separate capital-allocation arms debit actual purchases from a common budget and retain unspent cash. Stage fixtures are deliberately controlled snapshots, not claims about a unique player progression.

Preserve an immutable pre-change source snapshot and baseline per-seed results. Rerun the same runner, seeds, fixtures and schedules after changes. Atomic scenario checkpoints allow interrupted runs to resume without rerolling. Never regenerate a baseline under modified gameplay code.

## Accounting

- Operating profit = sales revenue − ingredients consumed − care consumed − promotion airtime consumed.
- Cash movement differs from operating profit because ingredients, care and campaigns are prepaid. Inventory and unused prepaid services are valued at purchase cost.
- Capital purchases are charged once in investment-adjusted results. Cat adoption includes the first care pack: capital equals adoption fee minus that pack's value. Subtracting the full adoption fee and later the included care again would double count.
- At settlement, cash + unused pantry + unused care + unused campaign airtime, plus capital spent, should reconcile to starting liquid assets + cumulative operating profit (with explicit goal grants separate, if enabled).
- Stale goods are already in ingredient consumption. Report their waste separately, never subtract their cost twice. Ingredient cost less recipe value of delivered sales also captures discarded accepted orders and unfinished work if applicable.
- One-off goal rewards are excluded from controlled recurring operating comparisons; they cannot provide an unlimited recovery path.

## Investment and uncertainty

Report capital, operating profit, investment-adjusted liquid gain, retained cash and remaining stock/prepayments separately. For investment payback, use incremental benefit against a paired no-investment policy, not gross sales or whole-shop profit. Where the horizon ends before recovery, record null/censored and the horizon; do not replace it by zero, infinity disguised as a number, or an extrapolated guarantee. Compare productive alternative uses of the same initial budget to expose opportunity cost.

Use paired seed differences, sample spread and a 95% mean-difference interval. Common seeds reduce some noise but strategies consume the RNG differently, so they do not guarantee identical customer histories. A single winner or an interval around one scenario does not establish global dominance. Distinguish cosmetic premiums, later-tier progression and legitimate service-versus-demand tradeoffs from defects. Review rating, lost demand and waste alongside profit.

## Scope limits

The simulation policy is an explicit, reproducible policy, not an optimal player or exhaustive search of all layouts/menu subsets. Model forecasts exclude some spatial delivery bottlenecks; actual simulation includes them. Fixed open durations should close gently and separately record closing service time, because forcibly cancelling accepted orders changes ratings and waste. Recovery probes must distinguish low ratings (recoverable through fresh reviews), unaffordable fragments (a restock algorithm defect), and absolute insolvency (requires an explicit gameplay rule).

## Service-window versus elapsed-time fairness

All main comparisons admit customers for exactly the same 8 × 180 seconds. Gentle settlement is allowed to finish already-accepted work; this adds strategy-dependent closing time, recorded separately. The strict comparison output also reports total elapsed game seconds and investment-adjusted net-liquid gain per elapsed hour. These are equal-open-window experiments, not a claim that each strategy used identical total game time. Closing overhead is not hidden or credited as additional customer-acquisition time.
