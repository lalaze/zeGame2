# Traffic economic comparison: waves20-pilot-v1

9 scenarios × 2 horizons × 2 paired seeds = 36 paired observations. 11 cells cross a pre-registered review threshold.

Baseline game hash: c81346116b3956830810fdd5ac3764e3de4c876a179563ea653a0385b8b7a893
Treatment game hash: befd511da7a1c5e5a4757fac4a2862178d34b8c02b4a4bdb7efc2596a3527f5e

Profit percentage uses the absolute baseline mean. Intervals are paired 95% descriptive intervals, not adjusted for multiple comparisons. Rating is the game latest-50 score (neutral padding before 20 reviews). Loss includes closing queue removals; unresolved guests remain in its denominator. Full raw rows and all metrics/phase/pending sensitivities are in JSON.

| Scenario @ seconds | Baseline profit | Treatment profit | Profit Δ [95% CI] | Profit Δ% | Lost rate Δ pp [95% CI] | Rating Δ [95% CI] | Flags |
|---|---:|---:|---:|---:|---:|---:|---|
| route-purchases/early/base/coffee/focus@180 | 16353.25 | 14201.10 | -2152.15 [-29485.14, 25180.83] | -13.16 | 0.00 [0.00, 0.00] | 0.000 [0.000, 0.000] | profit |
| route-purchases/early/base/coffee/focus@1800 | 167711.56 | 162396.23 | -5315.33 [-46558.57, 35927.91] | -3.17 | 0.13 [-1.49, 1.74] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/rush/bakery/focus@180 | 2121.28 | 1696.32 | -424.96 [-5824.59, 4974.67] | -20.03 | 0.99 [-0.50, 2.48] | 0.030 [-0.351, 0.411] | profit |
| route-purchases/early/rush/bakery/focus@1800 | 85990.69 | 79725.65 | -6265.03 [-31843.71, 19313.64] | -7.29 | -0.32 [-18.09, 17.44] | -0.105 [-0.550, 0.340] | profit, rating |
| route-purchases/mid/base/cats/focus@180 | 30349.10 | 30199.56 | -149.55 [-35030.74, 34731.65] | -0.49 | 7.88 [-37.97, 53.73] | -0.092 [-1.897, 1.712] | lossRate |
| route-purchases/mid/base/cats/focus@1800 | 305834.05 | 304633.93 | -1200.12 [-144429.49, 142029.24] | -0.39 | -1.08 [-3.49, 1.33] | -0.160 [-0.668, 0.348] | rating |
| route-purchases/mid/rush/takeaway/focus@180 | 60581.32 | 61889.80 | 1308.48 [-15317.33, 17934.29] | 2.16 | 0.49 [-20.19, 21.18] | -0.040 [-1.565, 1.485] | none |
| route-purchases/mid/rush/takeaway/focus@1800 | 612681.97 | 640479.82 | 27797.85 [-17785.28, 73380.98] | 4.54 | 0.00 [-3.00, 3.00] | 0.000 [0.000, 0.000] | none |
| route-purchases/late/base/garden/focus@180 | 23970.88 | 22841.89 | -1128.98 [-19845.44, 17587.48] | -4.71 | 3.28 [1.87, 4.69] | -0.090 [-0.217, 0.037] | lossRate |
| route-purchases/late/base/garden/focus@1800 | 243395.77 | 223387.00 | -20008.77 [-33572.08, -6445.45] | -8.22 | 1.20 [-3.37, 5.78] | -0.180 [-2.721, 2.361] | profit, rating |
| route-purchases/late/rush/community/focus@180 | 317471.34 | 299705.44 | -17765.90 [-49017.32, 13485.52] | -5.60 | 1.81 [-13.63, 17.25] | -0.170 [-0.551, 0.211] | profit, rating |
| route-purchases/late/rush/community/focus@1800 | 2832887.98 | 2659291.66 | -173596.32 [-741025.95, 393833.31] | -6.13 | 0.91 [-29.93, 31.75] | 0.010 [-0.879, 0.899] | profit |
| sanity/fresh/base@180 | 99.50 | 84.50 | -15.00 [-294.54, 264.54] | -15.08 | 0.00 [0.00, 0.00] | 0.019 [-0.222, 0.260] | profit |
| sanity/fresh/base@1800 | 933.00 | 867.00 | -66.00 [-370.95, 238.95] | -7.07 | 0.00 [0.00, 0.00] | 0.000 [0.000, 0.000] | profit |
| sanity/signature-heavy/mid/base@180 | 234.32 | 246.18 | 11.86 [-168.78, 192.49] | 5.06 | 0.00 [0.00, 0.00] | -0.014 [-0.356, 0.327] | none |
| sanity/signature-heavy/mid/base@1800 | 2444.46 | 2442.62 | -1.84 [-835.82, 832.15] | -0.08 | -0.50 [-12.52, 11.51] | 0.174 [-0.410, 0.758] | none |
| sanity/signature-heavy/mid/rush@180 | 169.30 | 201.74 | 32.44 [-206.69, 271.57] | 19.16 | -1.27 [-17.35, 14.82] | 0.039 [-0.685, 0.763] | none |
| sanity/signature-heavy/mid/rush@1800 | 2621.51 | 2520.69 | -100.83 [-840.01, 638.36] | -3.85 | 0.59 [-1.44, 2.62] | 0.018 [-0.262, 0.298] | none |
