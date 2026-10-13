# Paid midpoint restock: diagnostic results

This experiment adds exactly one existing paid restock at 90 seconds to both versions, on the frozen holdout labels. It is not an acceptance replacement. Startup fingerprints match, the no-action loop matches the existing helper, and both cash and consumed-input wealth identities reconcile.

| Scenario | Mean refill cost baseline / waves | Baseline rating no refill → refill | Wave rating no refill → refill | Wave-minus-baseline rating after refill [95% CI] | Wave-minus-baseline lost rate after refill, pp [95% CI] |
|---|---:|---:|---:|---:|---:|
| route-purchases/early/rush/bakery/focus | 200.00 / 199.73 | 1.016 → 1.842 | 1.022 → 1.868 | 0.0260 [-0.0076, 0.0596] | -0.32 [-1.09, 0.45] |
| route-purchases/mid/rush/bakery/focus | 250.47 / 250.67 | 4.213 → 4.213 | 4.115 → 4.115 | -0.0987 [-0.1734, -0.0240] | 1.65 [0.36, 2.94] |

## Interpretation

- Early bakery: paid restock reduces stockouts in both versions. This supports the usefulness of an occasional pantry action under this deliberately high-pressure portfolio, but does not claim fully healthy service: loss remains about 61%.
- Mid bakery: served counts, observed lost rate and terminal rating are exactly unchanged by the one extra raw-material purchase. The wave rating/loss difference therefore survives this intervention. Extra inventory is paid and retained; it is not free margin.
- The unchanged kitchen code schedules batches with an average-demand reorder trigger and real processing/walking lead time (`src/game/kitchen.ts`, `bakeryPlan` and `nextBatch`). Alongside stockout counts and low service waits, the evidence is consistent with a short-lived baked-shelf supply/timing mismatch. This is an inference, not an isolated proof that one particular station is responsible.
- Do not promise that the new pantry shortcut eliminates the mid-stage bakery tradeoff, or use this diagnostic to replace no-action primary or holdout results.

Raw paid receipts and all accounting are in `evidence/baseline-mechanism-v1.json` and `evidence/waves10-mechanism-v1.json`; complete within-version and between-version summaries are in `evidence/waves10-mechanism-v1-comparison.json`.
