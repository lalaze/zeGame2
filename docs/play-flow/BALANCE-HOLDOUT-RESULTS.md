# Independent holdout results

The six registered cells all remained within the strict review thresholds, but the bakery rating signal remains visible and must not be described as economic equivalence. Original full-matrix flags remain retained.

| Scenario @ seconds | Profit Δ% | Profit Δ [95% CI] | Lost Δpp [95% CI] | Rating Δ [95% CI] |
|---|---:|---:|---:|---:|
| route-purchases/early/rush/bakery/focus@180 | 4.23 | 84.99 [-42.77, 212.76] | -0.07 [-0.56, 0.43] | 0.0060 [-0.0100, 0.0220] |
| route-purchases/early/rush/bakery/focus@1800 | -0.38 | -313.41 [-1777.18, 1150.36] | -0.22 [-0.56, 0.12] | -0.0980 [-0.1449, -0.0511] |
| route-purchases/early/rush/community/focus@180 | -0.48 | -16.66 [-221.64, 188.31] | -0.01 [-0.72, 0.70] | -0.0102 [-0.0478, 0.0275] |
| route-purchases/early/rush/community/focus@1800 | 0.29 | 141.58 [-616.50, 899.66] | 0.57 [0.25, 0.89] | 0.0253 [0.0054, 0.0453] |
| route-purchases/mid/rush/bakery/focus@180 | -0.74 | -70.55 [-347.06, 205.97] | 1.65 [0.36, 2.94] | -0.0987 [-0.1734, -0.0240] |
| route-purchases/mid/rush/bakery/focus@1800 | -0.52 | -461.77 [-1870.55, 947.01] | 0.19 [-0.21, 0.59] | 0.0267 [-0.0487, 0.1020] |

## Interpretation

- The original early/rush bakery and community 180-second profit regressions did not replicate in the independent labels (+4.23% and −0.48%). This does not erase the primary observations.
- Mid/rush bakery 180-second rating deterioration repeated in direction and interval: −0.0987 stars, just inside the −0.1 review boundary. Lost rate rose +1.65pp. Its 1,800-second comparison did not show comparable profit/rating deterioration.
- Early/rush bakery 1,800-second rating fell −0.098 stars with its interval below zero, also close to the review boundary. A threshold-only green label would hide this.
- Ratings use the game terminal rolling latest-50 score, not all-day average. Loss bounds and pending food are preserved in the JSON; no pending sales were credited.

Baseline source: c81346116b3956830810fdd5ac3764e3de4c876a179563ea653a0385b8b7a893
Treatment source: 050f12965e50cf3edc0a2a3b8916b69a9222c4c1c0e5b4e74376b107dc6b84d9
Holdout runner/protocol hash: c920134b76d694afa3efc8a09adab78d5cc581693cd7d93fc66328cc4869f153

Raw rows: `evidence/baseline-holdout-v1.json` and `evidence/waves10-holdout-v1.json`; all paired metrics/food/phase summaries: `evidence/waves10-holdout-v1-comparison.json`.
