# Traffic economic comparison: waves10-pilot-v1

9 scenarios × 2 horizons × 2 paired seeds = 36 paired observations. 7 cells cross a pre-registered review threshold.

Baseline game hash: c81346116b3956830810fdd5ac3764e3de4c876a179563ea653a0385b8b7a893
Treatment game hash: 050f12965e50cf3edc0a2a3b8916b69a9222c4c1c0e5b4e74376b107dc6b84d9

Profit percentage uses the absolute baseline mean. Intervals are paired 95% descriptive intervals, not adjusted for multiple comparisons. Rating is the game latest-50 score (neutral padding before 20 reviews). Loss includes closing queue removals; unresolved guests remain in its denominator. Full raw rows and all metrics/phase/pending sensitivities are in JSON.

| Scenario @ seconds | Baseline profit | Treatment profit | Profit Δ [95% CI] | Profit Δ% | Lost rate Δ pp [95% CI] | Rating Δ [95% CI] | Flags |
|---|---:|---:|---:|---:|---:|---:|---|
| route-purchases/early/base/coffee/focus@180 | 16353.25 | 16009.01 | -344.24 [-701.01, 12.54] | -2.11 | 0.00 [0.00, 0.00] | -0.012 [-0.026, 0.001] | none |
| route-purchases/early/base/coffee/focus@1800 | 167711.56 | 165323.60 | -2387.97 [-118609.00, 113833.06] | -1.42 | 0.00 [0.00, 0.00] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/rush/bakery/focus@180 | 2121.28 | 2121.28 | 0.00 [0.00, 0.00] | 0.00 | 1.12 [-2.08, 4.33] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/rush/bakery/focus@1800 | 85990.69 | 83872.59 | -2118.10 [-10246.77, 6010.57] | -2.46 | 0.69 [-2.90, 4.29] | -0.105 [-1.439, 1.229] | rating |
| route-purchases/mid/base/cats/focus@180 | 30349.10 | 29924.05 | -425.05 [-66508.03, 65657.93] | -1.40 | 0.21 [-2.50, 2.93] | -0.037 [-2.036, 1.961] | none |
| route-purchases/mid/base/cats/focus@1800 | 305834.05 | 301782.71 | -4051.34 [-40235.95, 32133.27] | -1.32 | -1.77 [-3.77, 0.22] | 0.220 [-2.067, 2.507] | none |
| route-purchases/mid/rush/takeaway/focus@180 | 60581.32 | 61889.80 | 1308.48 [-15317.33, 17934.29] | 2.16 | -0.55 [-7.52, 6.42] | 0.040 [-0.468, 0.548] | none |
| route-purchases/mid/rush/takeaway/focus@1800 | 612681.97 | 623793.12 | 11111.16 [-30543.91, 52766.22] | 1.81 | -0.06 [-0.84, 0.71] | 0.000 [0.000, 0.000] | none |
| route-purchases/late/base/garden/focus@180 | 23970.88 | 24422.64 | 451.77 [-4813.17, 5716.71] | 1.88 | -1.69 [-23.23, 19.84] | 0.070 [-2.090, 2.230] | none |
| route-purchases/late/base/garden/focus@1800 | 243395.77 | 229874.72 | -13521.05 [-105447.07, 78404.97] | -5.56 | -0.44 [-1.67, 0.79] | -0.320 [-1.591, 0.951] | profit, rating |
| route-purchases/late/rush/community/focus@180 | 317471.34 | 322322.14 | 4850.80 [-4162.98, 13864.58] | 1.53 | 2.02 [-21.82, 25.86] | -0.090 [-0.979, 0.799] | lossRate |
| route-purchases/late/rush/community/focus@1800 | 2832887.98 | 2772869.30 | -60018.68 [-1053664.73, 933627.37] | -2.12 | -0.31 [-23.50, 22.89] | -0.060 [-0.568, 0.448] | none |
| sanity/fresh/base@180 | 99.50 | 98.50 | -1.00 [-13.71, 11.71] | -1.01 | 0.00 [0.00, 0.00] | -0.006 [-0.077, 0.066] | none |
| sanity/fresh/base@1800 | 933.00 | 947.00 | 14.00 [-519.66, 547.66] | 1.50 | 0.00 [0.00, 0.00] | 0.000 [0.000, 0.000] | none |
| sanity/signature-heavy/mid/base@180 | 234.32 | 217.02 | -17.30 [-207.33, 172.73] | -7.38 | 0.00 [0.00, 0.00] | -0.010 [-0.239, 0.219] | profit |
| sanity/signature-heavy/mid/base@1800 | 2444.46 | 2133.51 | -310.95 [-1250.44, 628.55] | -12.72 | -0.97 [-7.08, 5.14] | 0.189 [-0.332, 0.710] | profit |
| sanity/signature-heavy/mid/rush@180 | 169.30 | 236.21 | 66.90 [-482.11, 615.91] | 39.52 | 7.94 [-16.66, 32.54] | -0.435 [-1.388, 0.518] | lossRate, rating |
| sanity/signature-heavy/mid/rush@1800 | 2621.51 | 2393.94 | -227.57 [-2310.86, 1855.71] | -8.68 | 1.26 [-8.94, 11.47] | -0.184 [-2.141, 1.773] | profit, rating |
