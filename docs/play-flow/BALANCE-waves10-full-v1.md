# Traffic economic comparison: waves10-full-v1

39 scenarios × 2 horizons × 30 paired seeds = 2340 paired observations. 3 cells cross a pre-registered review threshold.

Baseline game hash: c81346116b3956830810fdd5ac3764e3de4c876a179563ea653a0385b8b7a893
Treatment game hash: 050f12965e50cf3edc0a2a3b8916b69a9222c4c1c0e5b4e74376b107dc6b84d9

Profit percentage uses the absolute baseline mean. Intervals are paired 95% descriptive intervals, not adjusted for multiple comparisons. Rating is the game latest-50 score (neutral padding before 20 reviews). Loss includes closing queue removals; unresolved guests remain in its denominator. Full raw rows and all metrics/phase/pending sensitivities are in JSON.

| Scenario @ seconds | Baseline profit | Treatment profit | Profit Δ [95% CI] | Profit Δ% | Lost rate Δ pp [95% CI] | Rating Δ [95% CI] | Flags |
|---|---:|---:|---:|---:|---:|---:|---|
| route-purchases/early/base/coffee/focus@180 | 14233.57 | 14373.51 | 139.93 [-225.09, 504.95] | 0.98 | 0.00 [0.00, 0.00] | -0.001 [-0.007, 0.004] | none |
| route-purchases/early/base/coffee/focus@1800 | 161624.53 | 161640.42 | 15.89 [-2020.70, 2052.49] | 0.01 | -0.07 [-0.13, -0.01] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/base/bakery/focus@180 | 7985.07 | 7992.15 | 7.08 [-188.91, 203.08] | 0.09 | -0.43 [-1.12, 0.25] | 0.014 [-0.009, 0.037] | none |
| route-purchases/early/base/bakery/focus@1800 | 78936.32 | 78874.58 | -61.74 [-1372.79, 1249.30] | -0.08 | -0.10 [-0.56, 0.37] | 0.009 [-0.052, 0.071] | none |
| route-purchases/early/base/cats/focus@180 | 10556.06 | 10682.48 | 126.42 [-178.14, 430.98] | 1.20 | 0.00 [0.00, 0.00] | -0.003 [-0.008, 0.002] | none |
| route-purchases/early/base/cats/focus@1800 | 117980.43 | 117882.93 | -97.50 [-2194.74, 1999.74] | -0.08 | 0.02 [-0.04, 0.09] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/base/takeaway/focus@180 | 11889.27 | 11909.44 | 20.18 [-8.50, 48.85] | 0.17 | 0.00 [0.00, 0.00] | 0.001 [-0.000, 0.002] | none |
| route-purchases/early/base/takeaway/focus@1800 | 133242.60 | 133231.81 | -10.79 [-668.67, 647.09] | -0.01 | 0.00 [0.00, 0.00] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/base/garden/focus@180 | 2060.05 | 2085.97 | 25.92 [-93.64, 145.47] | 1.26 | -0.36 [-0.86, 0.15] | 0.011 [-0.005, 0.026] | none |
| route-purchases/early/base/garden/focus@1800 | 21461.02 | 21447.04 | -13.98 [-567.14, 539.18] | -0.07 | 0.25 [-0.06, 0.55] | -0.038 [-0.092, 0.016] | none |
| route-purchases/early/base/community/focus@180 | 4497.56 | 4376.88 | -120.68 [-294.34, 52.99] | -2.68 | 0.00 [0.00, 0.00] | 0.000 [-0.006, 0.006] | none |
| route-purchases/early/base/community/focus@1800 | 47336.31 | 46682.97 | -653.34 [-1562.09, 255.41] | -1.38 | 0.42 [0.14, 0.69] | -0.024 [-0.040, -0.007] | none |
| route-purchases/early/rush/coffee/focus@180 | 29269.35 | 28718.92 | -550.42 [-1881.44, 780.59] | -1.88 | 0.00 [0.00, 0.00] | -0.002 [-0.014, 0.010] | none |
| route-purchases/early/rush/coffee/focus@1800 | 317305.18 | 317843.95 | 538.77 [-2886.95, 3964.48] | 0.17 | -0.13 [-0.22, -0.05] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/rush/bakery/focus@180 | 2036.29 | 1894.63 | -141.65 [-310.07, 26.76] | -6.96 | -0.18 [-0.54, 0.19] | -0.012 [-0.027, 0.003] | profit |
| route-purchases/early/rush/bakery/focus@1800 | 83169.04 | 83220.86 | 51.82 [-1600.38, 1704.01] | 0.06 | 0.04 [-0.26, 0.34] | -0.054 [-0.100, -0.007] | none |
| route-purchases/early/rush/cats/focus@180 | 21284.25 | 21226.18 | -58.07 [-759.52, 643.39] | -0.27 | 0.00 [0.00, 0.00] | -0.002 [-0.015, 0.011] | none |
| route-purchases/early/rush/cats/focus@1800 | 229043.34 | 229026.91 | -16.43 [-1957.79, 1924.93] | -0.01 | -0.14 [-0.29, 0.02] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/rush/takeaway/focus@180 | 24081.50 | 24283.71 | 202.21 [-232.19, 636.61] | 0.84 | 0.00 [0.00, 0.00] | -0.003 [-0.007, 0.001] | none |
| route-purchases/early/rush/takeaway/focus@1800 | 260321.29 | 260661.69 | 340.40 [-3007.62, 3688.41] | 0.13 | 0.00 [0.00, 0.00] | 0.000 [0.000, 0.000] | none |
| route-purchases/early/rush/garden/focus@180 | 764.20 | 745.27 | -18.93 [-78.35, 40.50] | -2.48 | 1.02 [-0.08, 2.12] | -0.048 [-0.098, 0.002] | none |
| route-purchases/early/rush/garden/focus@1800 | 21943.93 | 21963.70 | 19.77 [-343.12, 382.66] | 0.09 | 0.82 [0.36, 1.27] | 0.056 [-0.026, 0.137] | none |
| route-purchases/early/rush/community/focus@180 | 3667.25 | 3467.29 | -199.96 [-416.99, 17.06] | -5.45 | -0.38 [-1.22, 0.46] | -0.010 [-0.050, 0.030] | profit |
| route-purchases/early/rush/community/focus@1800 | 49900.13 | 49149.99 | -750.14 [-1587.79, 87.51] | -1.50 | 0.24 [-0.17, 0.65] | 0.029 [0.006, 0.053] | none |
| route-purchases/mid/base/coffee/focus@180 | 15392.29 | 15290.07 | -102.22 [-644.40, 439.96] | -0.66 | 0.28 [-0.66, 1.21] | -0.011 [-0.049, 0.026] | none |
| route-purchases/mid/base/coffee/focus@1800 | 164595.91 | 164023.96 | -571.95 [-3003.72, 1859.83] | -0.35 | 0.01 [-0.10, 0.11] | 0.000 [0.000, 0.000] | none |
| route-purchases/mid/base/bakery/focus@180 | 5527.09 | 5380.38 | -146.71 [-360.46, 67.04] | -2.65 | 1.23 [-0.54, 3.01] | -0.049 [-0.120, 0.023] | none |
| route-purchases/mid/base/bakery/focus@1800 | 59623.84 | 59538.29 | -85.56 [-1124.88, 953.77] | -0.14 | 0.18 [-0.28, 0.63] | -0.005 [-0.052, 0.042] | none |
| route-purchases/mid/base/cats/focus@180 | 31041.16 | 30224.98 | -816.18 [-2586.48, 954.12] | -2.63 | 0.92 [-0.97, 2.81] | 0.048 [-0.039, 0.135] | none |
| route-purchases/mid/base/cats/focus@1800 | 308254.95 | 301284.59 | -6970.36 [-11756.08, -2184.65] | -2.26 | 0.69 [-0.08, 1.47] | 0.039 [-0.070, 0.148] | none |
| route-purchases/mid/base/takeaway/focus@180 | 30381.16 | 30206.70 | -174.46 [-422.38, 73.46] | -0.57 | 0.22 [-0.04, 0.48] | -0.009 [-0.020, 0.001] | none |
| route-purchases/mid/base/takeaway/focus@1800 | 322710.21 | 320704.04 | -2006.17 [-6271.63, 2259.29] | -0.62 | 0.04 [0.01, 0.07] | 0.000 [0.000, 0.000] | none |
| route-purchases/mid/base/garden/focus@180 | 7952.64 | 8285.74 | 333.11 [-57.20, 723.41] | 4.19 | -0.59 [-1.61, 0.44] | 0.045 [-0.011, 0.101] | none |
| route-purchases/mid/base/garden/focus@1800 | 84281.32 | 84748.48 | 467.16 [-868.02, 1802.35] | 0.55 | -0.10 [-0.36, 0.17] | -0.004 [-0.057, 0.049] | none |
| route-purchases/mid/base/community/focus@180 | 36570.03 | 36089.80 | -480.23 [-2144.63, 1184.16] | -1.31 | 0.51 [-0.82, 1.85] | -0.022 [-0.079, 0.035] | none |
| route-purchases/mid/base/community/focus@1800 | 376715.30 | 374785.98 | -1929.32 [-9136.27, 5277.63] | -0.51 | 0.25 [-0.05, 0.55] | -0.001 [-0.064, 0.062] | none |
| route-purchases/mid/rush/coffee/focus@180 | 31087.73 | 30985.91 | -101.82 [-1178.12, 974.48] | -0.33 | -0.76 [-1.57, 0.05] | 0.056 [-0.003, 0.115] | none |
| route-purchases/mid/rush/coffee/focus@1800 | 319829.52 | 321372.91 | 1543.39 [-2774.78, 5861.56] | 0.48 | -0.24 [-0.36, -0.13] | 0.001 [-0.001, 0.002] | none |
| route-purchases/mid/rush/bakery/focus@180 | 9600.73 | 9552.52 | -48.21 [-386.56, 290.13] | -0.50 | 1.93 [0.72, 3.15] | -0.117 [-0.198, -0.037] | rating |
| route-purchases/mid/rush/bakery/focus@1800 | 88779.98 | 89132.88 | 352.91 [-1087.84, 1793.65] | 0.40 | 0.22 [-0.22, 0.66] | 0.005 [-0.077, 0.087] | none |
| route-purchases/mid/rush/cats/focus@180 | 30863.33 | 31905.57 | 1042.24 [-379.76, 2464.24] | 3.38 | -0.10 [-1.67, 1.47] | 0.057 [-0.012, 0.126] | none |
| route-purchases/mid/rush/cats/focus@1800 | 304582.04 | 308153.97 | 3571.93 [-2984.64, 10128.50] | 1.17 | 0.23 [-0.22, 0.68] | 0.087 [0.012, 0.161] | none |
| route-purchases/mid/rush/takeaway/focus@180 | 60843.35 | 60581.75 | -261.60 [-1104.42, 581.23] | -0.43 | -0.03 [-0.58, 0.52] | 0.003 [-0.036, 0.041] | none |
| route-purchases/mid/rush/takeaway/focus@1800 | 623050.34 | 626388.58 | 3338.24 [-2022.18, 8698.65] | 0.54 | -0.02 [-0.07, 0.03] | 0.000 [0.000, 0.000] | none |
| route-purchases/mid/rush/garden/focus@180 | 12025.70 | 12662.25 | 636.56 [-44.56, 1317.67] | 5.29 | -0.35 [-2.06, 1.37] | 0.008 [-0.086, 0.102] | none |
| route-purchases/mid/rush/garden/focus@1800 | 120548.57 | 119892.15 | -656.42 [-2950.64, 1637.80] | -0.54 | -0.02 [-0.72, 0.68] | 0.025 [-0.050, 0.100] | none |
| route-purchases/mid/rush/community/focus@180 | 58390.10 | 56824.65 | -1565.46 [-4369.25, 1238.34] | -2.68 | 0.30 [-1.90, 2.51] | -0.037 [-0.167, 0.093] | none |
| route-purchases/mid/rush/community/focus@1800 | 515732.46 | 516514.97 | 782.51 [-7374.07, 8939.08] | 0.15 | -0.18 [-0.74, 0.37] | 0.101 [0.006, 0.195] | none |
| route-purchases/late/base/coffee/focus@180 | 185859.15 | 189705.71 | 3846.56 [-2400.92, 10094.04] | 2.07 | 0.62 [-0.49, 1.74] | -0.024 [-0.069, 0.021] | none |
| route-purchases/late/base/coffee/focus@1800 | 2007135.44 | 1998338.69 | -8796.75 [-33993.10, 16399.61] | -0.44 | 0.06 [-0.08, 0.20] | 0.000 [0.000, 0.000] | none |
| route-purchases/late/base/bakery/focus@180 | 105329.16 | 104765.96 | -563.20 [-4314.40, 3188.00] | -0.53 | 0.75 [-0.98, 2.48] | -0.030 [-0.101, 0.040] | none |
| route-purchases/late/base/bakery/focus@1800 | 1158193.09 | 1149220.29 | -8972.81 [-27680.00, 9734.39] | -0.77 | 0.15 [-0.28, 0.57] | -0.083 [-0.149, -0.016] | none |
| route-purchases/late/base/cats/focus@180 | 222377.96 | 216276.82 | -6101.13 [-15768.11, 3565.85] | -2.74 | -0.29 [-1.94, 1.36] | -0.065 [-0.146, 0.015] | none |
| route-purchases/late/base/cats/focus@1800 | 2099707.49 | 2077012.42 | -22695.06 [-62743.96, 17353.83] | -1.08 | 0.16 [-0.49, 0.81] | -0.069 [-0.163, 0.025] | none |
| route-purchases/late/base/takeaway/focus@180 | 99326.32 | 99326.12 | -0.20 [-212.98, 212.58] | -0.00 | 0.07 [-0.20, 0.35] | -0.003 [-0.014, 0.008] | none |
| route-purchases/late/base/takeaway/focus@1800 | 1066937.32 | 1071494.96 | 4557.64 [-6015.94, 15131.22] | 0.43 | 0.01 [-0.02, 0.04] | 0.000 [0.000, 0.000] | none |
| route-purchases/late/base/garden/focus@180 | 23164.96 | 23774.61 | 609.64 [-859.26, 2078.55] | 2.63 | 0.35 [-0.86, 1.57] | -0.008 [-0.065, 0.049] | none |
| route-purchases/late/base/garden/focus@1800 | 230118.91 | 228306.45 | -1812.46 [-6215.54, 2590.63] | -0.79 | 0.03 [-0.34, 0.39] | -0.031 [-0.103, 0.042] | none |
| route-purchases/late/base/community/focus@180 | 193051.74 | 189871.39 | -3180.34 [-12258.03, 5897.34] | -1.65 | -0.21 [-1.93, 1.50] | 0.026 [-0.050, 0.102] | none |
| route-purchases/late/base/community/focus@1800 | 2015080.97 | 2025578.61 | 10497.64 [-22239.10, 43234.37] | 0.52 | -0.02 [-0.40, 0.36] | 0.016 [-0.018, 0.050] | none |
| route-purchases/late/rush/coffee/focus@180 | 380462.69 | 378813.79 | -1648.91 [-15352.06, 12054.24] | -0.43 | 0.72 [-0.30, 1.73] | -0.051 [-0.123, 0.021] | none |
| route-purchases/late/rush/coffee/focus@1800 | 3930529.99 | 3932726.60 | 2196.60 [-45913.48, 50306.68] | 0.06 | 0.08 [-0.04, 0.20] | 0.000 [0.000, 0.000] | none |
| route-purchases/late/rush/bakery/focus@180 | 205777.73 | 206840.77 | 1063.04 [-5563.36, 7689.44] | 0.52 | -0.08 [-1.23, 1.07] | 0.003 [-0.073, 0.079] | none |
| route-purchases/late/rush/bakery/focus@1800 | 1956328.00 | 1956329.52 | 1.53 [-27720.85, 27723.90] | 0.00 | 0.27 [-0.12, 0.65] | 0.027 [-0.048, 0.101] | none |
| route-purchases/late/rush/cats/focus@180 | 321225.88 | 318278.16 | -2947.72 [-18201.30, 12305.87] | -0.92 | -0.32 [-2.32, 1.68] | 0.012 [-0.119, 0.143] | none |
| route-purchases/late/rush/cats/focus@1800 | 2980726.24 | 2980270.21 | -456.02 [-38303.95, 37391.90] | -0.02 | -0.14 [-0.66, 0.37] | -0.039 [-0.137, 0.058] | none |
| route-purchases/late/rush/takeaway/focus@180 | 201439.82 | 201511.70 | 71.88 [-2522.64, 2666.40] | 0.04 | 0.63 [0.07, 1.19] | -0.045 [-0.086, -0.005] | none |
| route-purchases/late/rush/takeaway/focus@1800 | 2087265.13 | 2086611.50 | -653.63 [-27002.90, 25695.64] | -0.03 | 0.07 [0.01, 0.12] | 0.000 [0.000, 0.000] | none |
| route-purchases/late/rush/garden/focus@180 | 32178.94 | 33788.33 | 1609.39 [-33.79, 3252.58] | 5.00 | -0.46 [-2.10, 1.17] | 0.056 [-0.083, 0.195] | none |
| route-purchases/late/rush/garden/focus@1800 | 313735.08 | 316274.51 | 2539.43 [-2090.90, 7169.76] | 0.81 | -0.04 [-0.72, 0.64] | -0.085 [-0.201, 0.031] | none |
| route-purchases/late/rush/community/focus@180 | 287042.47 | 296112.87 | 9070.40 [-1219.27, 19360.07] | 3.16 | 0.69 [-0.59, 1.97] | -0.065 [-0.138, 0.007] | none |
| route-purchases/late/rush/community/focus@1800 | 2775618.21 | 2792513.89 | 16895.68 [-27846.75, 61638.11] | 0.61 | -0.34 [-0.91, 0.23] | 0.042 [-0.056, 0.140] | none |
| sanity/fresh/base@180 | 82.33 | 83.63 | 1.30 [-1.49, 4.09] | 1.58 | 0.00 [0.00, 0.00] | -0.004 [-0.008, 0.001] | none |
| sanity/fresh/base@1800 | 921.03 | 920.30 | -0.73 [-18.66, 17.19] | -0.08 | -0.05 [-0.11, 0.01] | 0.000 [0.000, 0.000] | none |
| sanity/signature-heavy/mid/base@180 | 197.63 | 206.53 | 8.90 [-3.82, 21.62] | 4.50 | -0.00 [-1.53, 1.52] | 0.003 [-0.041, 0.048] | none |
| sanity/signature-heavy/mid/base@1800 | 2278.45 | 2254.90 | -23.54 [-91.84, 44.76] | -1.03 | 0.02 [-0.49, 0.53] | -0.006 [-0.028, 0.016] | none |
| sanity/signature-heavy/mid/rush@180 | 203.50 | 204.58 | 1.08 [-22.90, 25.06] | 0.53 | -0.32 [-1.62, 0.97] | 0.011 [-0.056, 0.077] | none |
| sanity/signature-heavy/mid/rush@1800 | 2524.21 | 2518.32 | -5.89 [-79.05, 67.27] | -0.23 | 0.36 [-0.02, 0.75] | -0.026 [-0.119, 0.067] | none |
