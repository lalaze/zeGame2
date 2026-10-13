# Per-flag review and disposition

Decision: keep the frozen 10% candidate and disclose the localized high-pressure bakery tradeoff. The three original flags remain in the machine-readable comparison; acceptance is a reviewed tradeoff, not a rewritten gate. All intervals below are paired descriptive 95% t intervals.

## route-purchases/early/rush/bakery/focus

| Horizon | Profit Δ% | Loss Δpp [95% CI] | Rating Δ [95% CI] | Pending baseline → wave | Accepted-food cost baseline → wave | Peak queue baseline → wave |
|---|---:|---:|---:|---:|---:|---:|
| 180s | -6.96 | -0.18 [-0.54, 0.19] | -0.0120 [-0.0269, 0.0029] | 0.600 → 0.733 | 0.000 → 0.000 | 1.033 → 1.000 |
| 1800s | 0.06 | 0.04 [-0.26, 0.34] | -0.0537 [-0.1001, -0.0073] | 1.400 → 1.633 | 3.067 → 3.600 | 1.033 → 1.533 |

Primary arrival attempts by phase (baseline → wave; exposure is 60/30/60/30 seconds):
- calm: 21.37 → 19.80
- rising: 10.30 → 10.23
- busy: 19.57 → 21.93
- easing: 9.67 → 9.10

Primary all-pending-lost sensitivity: loss-rate delta 0.05pp. Accepted-food cost is ingredient expense, never cash salvage or future sale credit.

Disposition: retain the original −6.96% profit flag, but do not treat it as demonstrated capacity deterioration. Every primary seed served exactly 9 guests in both versions and ingredient expense matched. Exact fixed-price revenue reconstruction gives mean VIP counts 0.400 → 0.233 (VIP revenue multiplier 5); this fully explains the mean profit difference. Pending accepted-food cost is zero. Profit Δ−141.65 has CI [−310.07,+26.76]. The independent holdout profit delta is +4.23%; original 1,800-second profit delta is +0.06%.

Remaining service caution: the high-pressure early fixture is already strongly stock-limited in both versions. The independent 1,800-second holdout rating decline is −0.098 [−0.145,−0.051], just inside the original gate. It remains disclosed. One paid 90-second restock helps both early fixtures but does not make this an all-service-cost-free result.

## route-purchases/early/rush/community/focus

| Horizon | Profit Δ% | Loss Δpp [95% CI] | Rating Δ [95% CI] | Pending baseline → wave | Accepted-food cost baseline → wave | Peak queue baseline → wave |
|---|---:|---:|---:|---:|---:|---:|
| 180s | -5.45 | -0.38 [-1.22, 0.46] | -0.0105 [-0.0505, 0.0295] | 0.633 → 0.567 | 0.000 → 0.000 | 6.000 → 6.000 |
| 1800s | -1.50 | 0.24 [-0.17, 0.65] | 0.0293 [0.0055, 0.0531] | 6.967 → 6.933 | 2.333 → 2.267 | 6.000 → 6.000 |

Primary arrival attempts by phase (baseline → wave; exposure is 60/30/60/30 seconds):
- calm: 21.33 → 18.80
- rising: 9.87 → 10.43
- busy: 20.07 → 21.87
- easing: 10.23 → 9.70

Primary all-pending-lost sensitivity: loss-rate delta -0.48pp. Accepted-food cost is ingredient expense, never cash salvage or future sale credit.

Disposition: retain the original −5.45% profit flag, but do not claim a repeated wave-driven capacity loss. Every primary seed served exactly 26 guests in both versions with identical ingredient expense; exact fixed-price revenue reconstruction gives VIP counts 1.300 → 0.900, fully accounting for the mean profit difference. Profit Δ−199.96 has CI [−416.99,+17.06]. The independent holdout is −0.48%, and original 1,800-second profit is −1.50%, without loss/rating gate crossings. Pending counts and accepted-food costs do not explain the short-window revenue difference.

## route-purchases/mid/rush/bakery/focus

| Horizon | Profit Δ% | Loss Δpp [95% CI] | Rating Δ [95% CI] | Pending baseline → wave | Accepted-food cost baseline → wave | Peak queue baseline → wave |
|---|---:|---:|---:|---:|---:|---:|
| 180s | -0.50 | 1.93 [0.72, 3.15] | -0.1173 [-0.1976, -0.0370] | 1.467 → 1.400 | 6.200 → 5.133 | 0.967 → 0.967 |
| 1800s | 0.40 | 0.22 [-0.22, 0.66] | 0.0053 [-0.0765, 0.0872] | 1.500 → 1.667 | 8.800 → 6.467 | 1.000 → 1.000 |

Primary arrival attempts by phase (baseline → wave; exposure is 60/30/60/30 seconds):
- calm: 27.40 → 24.63
- rising: 13.83 → 14.23
- busy: 27.93 → 31.47
- easing: 13.63 → 13.77

Primary all-pending-lost sensitivity: loss-rate delta 1.83pp. Accepted-food cost is ingredient expense, never cash salvage or future sale credit.

Disposition: accept and disclose a genuine localized short-window tradeoff. Stockouts rise 11.43 → 13.23; rating falls 4.205 → 4.088 and the paired interval is below zero. Loss rises 13.79% → 15.72%. The independent holdout repeats the direction: rating −0.0987 [−0.1734,−0.0240], loss +1.65pp [+0.36,+2.94]. The slight pending/accepted-food differences do not erase this signal, including the all-pending-lost sensitivity.

The batch/shelf supply-timing explanation is consistent with observed arrivals shifting into the busy interval (27.93 → 31.47), near-identical peak queue and slightly shorter waits among served customers (3.900 → 3.871 seconds). A paid extra pantry restock at 90 seconds leaves mid-stage served/lost/rating results exactly unchanged. The unchanged kitchen uses an average-demand reorder trigger and real batch-processing/walking lead times. This supports a production/shelf timing mismatch, rather than a raw-pantry shortage remedied by one extra purchase; it does not isolate a specific station as the sole cause.

The original 1,800-second comparison is profit +0.40%, rating +0.0053 [−0.0765,+0.0872], lost rate +0.22pp [−0.22,+0.66]. Holdout 1,800-second profit is −0.52% and rating +0.0267. Those results limit a sustained-deterioration claim but do not erase the replicated short-window cost.

## Limits

- Last-50 terminal ratings are path- and endpoint-sensitive; intervals and independent replication remain visible instead of assuming every difference is noise.
- Shared seed labels are not identical customer cohorts. Shifted service events change later RNG consumption and realized VIP outcomes.
- These are synthetic paid portfolios and specified promotion/stock policies, plus fresh/signature sanity panels. No claim covers arbitrary layouts, every possible menu or every player action.
- All 78 original cells, the full raw seed rows, the separate holdout and paid-restock results remain in the evidence folder. No prices, patience, gates or sample selection were changed.
