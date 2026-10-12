# Thirty-day operating and intervention checks

## Main findings

- Early low-level espresso: ginger remains below hold in all 30 seeds at day 30 (mean net advantage −316.60, 95% interval −349.84 to −283.36); ten paid espresso upgrades produce +89,538.33 (88,940.19 to 90,136.48) and recover in all seeds.
- Mid latte-only: ginger, noteLocal, and their combination all finish below the same-menu hold in all 30 seeds. One ginger seed briefly repays capital, then loses the advantage by day 30. First payback is not a durable-success guarantee.
- Expanded flatwhite-only: ginger’s mean +1,755.47 has an interval overlapping zero (−415.42 to 3,926.35) and is terminal-positive in 19/30 seeds. noteLocal produces +3,043.87 (537.47 to 5,550.26), positive in 22/30; combined ginger plus noteLocal produces +3,970.53 (2,025.11 to 5,915.96), positive in 23/30. Both cat-containing arms cross capital payback in 28/30 seeds, substantially more than remain positive at the end.
- The [upgraded-espresso supplement](LONG-HORIZON-SUPPLEMENT.md) provides a strong positive-return counterpart: on the same fast, upgraded product, ginger, noteLocal, and combined spending finish ahead in all 30 seeds, with mean net advantages +6,501.70, +21,513.12, and +29,539.45 respectively. Attraction is not universally a poor investment; sale margin and capacity to serve extra demand matter.

These are observed comparisons of fixed policies. Do not turn the early-cat result into a universal nerf, treat one temporary payback crossing as permanent success, or infer a dynamic investment optimum from a thirty-day menu-hold study. The supplemental control matches the main paid espresso-ten batch exactly.

## Scope and accounting

This extends eleven representative fixed policies to 30 days with 30 predetermined seeds each (9,900 cafe-days). It uses the actual shared sample implementation, 0.05-second Sim steps, 180 seconds open per day, and accepted-service drain capped at 300 seconds. These are thirty-day observations, not infinite-horizon optimality or a reinvestment strategy study.

Early starts with espresso only: hold, ginger adoption, and ten espresso-level purchases. Mid holds a latte-only menu; expanded holds a flatwhite-only menu. Each later stage compares hold, ginger, renewed noteLocal, and ginger plus renewed noteLocal. Comparisons are within the same stage endowment and menu. Initial later ownership/staff/regions are common fixtures, not free purchases attributed to the intervention or actual progression paths. Exact fixtures and their capital valuation are in result metadata.

All intervention costs are charged by actual game functions. Ginger adoption includes care: adoption cash is split into non-refundable capital and prepaid care. Care used and promotion airtime used are operating expenses. Promotions renew in preparation when expired; noteLocal spans two 180-second open days. Ingredients are forecast-restocked subject to cash; residual pantry and prepaid care/promotion remain in liquid wealth. No click income, reward claims, debt, revenue injection, rescue financing, or reinvestment is added.

Net-liquid profit is final cash plus inventory/prepayments at cost minus starting liquid wealth. It equals cumulative operating profit minus intervention capital; every simulated day is checked by the imported runner. Capital has no assumed resale value. Formula-based mean confidence intervals are descriptive normal approximations (mean ±1.96×sample SD/√30), not simultaneous tests; raw seed results and SDs remain available. Near-zero count intervals can extend below zero without implying negative observed losses.

Same predetermined seed labels are paired across strategies; different event paths do not imply customer-identical random draws. A first payback crossing can reverse later. We separately report terminal positive net advantage and the first day from which advantage stays positive through observed day 30. This is bounded persistence through the observation window, not a guarantee about subsequent days.

## Thirty-day outcomes

| Scenario | Operating profit [95% CI] | Net-liquid profit [95% CI] | Lost customers [95% CI] | Waste cost [95% CI] | Final rating [95% CI] |
|---|---:|---:|---:|---:|---:|
| early/initial/none | 2,840.67 [2,815.4, 2,865.94] | 2,840.67 [2,815.4, 2,865.94] | 0 [0, 0] | 0 [0, 0] | 4.5 [4.5, 4.5] |
| early/initial/cat | 2,816.07 [2,789.63, 2,842.5] | 2,524.07 [2,497.63, 2,550.5] | 0.57 [0.17, 0.96] | 0 [0, 0] | 4.5 [4.49, 4.5] |
| early/initial/espresso-ten | 92,536.23 [91,912.99, 93,159.48] | 92,379 [91,755.75, 93,002.24] | 0 [0, 0] | 0 [0, 0] | 4.5 [4.5, 4.5] |
| mid/high/none | 7,921.3 [7,846.09, 7,996.51] | 7,921.3 [7,846.09, 7,996.51] | 5.3 [4.46, 6.14] | 0 [0, 0] | 3.85 [3.79, 3.9] |
| mid/high/cat | 7,746.07 [7,670.75, 7,821.39] | 7,454.07 [7,378.75, 7,529.39] | 24.77 [22.75, 26.79] | 0 [0, 0] | 3.66 [3.61, 3.71] |
| mid/high/noteLocal | 7,185.23 [7,116.88, 7,253.59] | 7,185.23 [7,116.88, 7,253.59] | 142.77 [139.6, 145.93] | 0 [0, 0] | 3.34 [3.31, 3.36] |
| mid/high/cat-noteLocal | 7,015.97 [6,937.99, 7,093.94] | 6,723.97 [6,645.99, 6,801.94] | 232.33 [228.35, 236.32] | 0 [0, 0] | 3.25 [3.23, 3.27] |
| expanded/high/none | 214,113.33 [212,419.89, 215,806.78] | 214,113.33 [212,419.89, 215,806.78] | 425.3 [413.81, 436.79] | 0 [0, 0] | 3.35 [3.26, 3.45] |
| expanded/high/cat | 216,160.8 [214,739.14, 217,582.46] | 215,868.8 [214,447.14, 217,290.46] | 652.97 [640.11, 665.82] | 0 [0, 0] | 3.24 [3.18, 3.3] |
| expanded/high/noteLocal | 217,157.2 [215,460.47, 218,853.93] | 217,157.2 [215,460.47, 218,853.93] | 1,218.57 [1,201.24, 1,235.89] | 0 [0, 0] | 3.24 [3.16, 3.32] |
| expanded/high/cat-noteLocal | 218,375.87 [217,151.85, 219,599.89] | 218,083.87 [216,859.85, 219,307.89] | 1,548.07 [1,534.43, 1,561.71] | 0 [0, 0] | 3.22 [3.14, 3.3] |

## Paired intervention versus same-stage hold

Capital payback is the first cumulative incremental operating profit covering incremental capital. Pure promotion has no capital, so capital payback/censoring is not applicable; its expense is already deducted from operating profit. Every terminal advantage includes all charged adoption, consumed care, and consumed promotion costs.

| Scenario | Terminal net advantage [95% CI] | First capital recovery /30 | Capital censored /30 | First recovery days | Positive at day 30 /30 | Recovered then nonpositive /30 | Sustained-positive start days (through day 30 only) |
|---|---:|---:|---:|---|---:|---:|---|
| early/initial/cat | -316.6 [-349.84, -283.36] | 0 | 30 | None | 0 | 0 | None |
| early/initial/espresso-ten | 89,538.33 [88,940.19, 90,136.48] | 30 | 0 | 1–1 | 30 | 0 | 1–1 |
| mid/high/cat | -467.23 [-561.15, -373.31] | 1 | 29 | 12–12 | 0 | 1 | None |
| mid/high/noteLocal | -736.07 [-841.15, -630.99] | N/A | N/A | N/A | 0 | N/A | None |
| mid/high/cat-noteLocal | -1,197.33 [-1,279.64, -1,115.03] | 0 | 30 | None | 0 | 0 | None |
| expanded/high/cat | 1,755.47 [-415.42, 3,926.35] | 28 | 2 | 1–9 | 19 | 9 | 1–30 |
| expanded/high/noteLocal | 3,043.87 [537.47, 5,550.26] | N/A | N/A | N/A | 22 | N/A | 1–30 |
| expanded/high/cat-noteLocal | 3,970.53 [2,025.11, 5,915.96] | 28 | 2 | 1–29 | 23 | 5 | 1–29 |

## Reproducibility and limitations

Run `ECONOMY_LONG_HORIZON=1 npx vitest run scripts/economy-long-horizon.test.ts --silent=false --disableConsoleIntercept`. Atomic, resumable batches are saved in `results/economy-long-horizon.json`; an interrupted file remains `complete:false`. SHA-256 fingerprints cover gameplay and both shared and extension runners. A fingerprint mismatch refuses to resume; archive the old dataset rather than mixing code versions. Partial seed batches resume safely. Ordinary tests only validate the design.

No spending/traffic policy is optimized here. Fixed single-drink fixtures are intentionally narrow; bakery dynamics, all-menu complexity, huge-budget progression, subjective cosmetic value, and dynamic upgrade decisions require other evidence. A negative intervention advantage does not mean the cafe as a whole loses money. These results should inform choices, not flatten distinct strategies or imply that all cats/promotions have identical returns.

Metadata:

```json
{
  "gameFingerprint": "0b73358c463ed8805ac4d16e7d0c831eec28bfed99fb0b5b19b7156422bd76cf",
  "runnerFingerprint": "ad3c4fa29edcb7391677c0b791742824bbfb82550654c1c49f3daddad05c272d",
  "sharedRunnerFingerprint": "d15634cbdf304d95aa37301a4cc736a98593bcbcfd4a0df1ee78c22422177b58",
  "seeds": [
    1592594996,
    4247030757,
    2606499222,
    965967687,
    3620403448,
    1979871913,
    339340378,
    2993776139,
    1353244604,
    4007680365,
    2367148830,
    726617295,
    3381053056,
    1740521521,
    99989986,
    2754425747,
    1113894212,
    3768329973,
    2127798438,
    487266903,
    3141702664,
    1501171129,
    4155606890,
    2515075355,
    874543820,
    3528979581,
    1888448046,
    247916511,
    2902352272,
    1261820737
  ],
  "expectedSeedCountPerScenario": 30,
  "days": 30,
  "dt": 0.05,
  "openSeconds": 180,
  "fixtures": [
    {
      "stage": "early",
      "goalIndex": 15,
      "goalRewards": "exhausted/excluded",
      "starting": {
        "cash": 1200,
        "inventory": 50,
        "care": 0,
        "promotion": 0,
        "total": 1250
      },
      "items": {
        "espresso": 1,
        "americano": 0,
        "latte": 0,
        "cappuccino": 0,
        "flatwhite": 0,
        "cortado": 0,
        "mocha": 0,
        "vienna": 0,
        "macchiato": 0,
        "coldbrew": 0,
        "dirty": 0,
        "pourover": 0,
        "creamcoffee": 0,
        "affogato": 0,
        "blacktea": 0,
        "hotchoc": 0,
        "lemontea": 0,
        "chai": 0,
        "fruittea": 0,
        "hojicha": 0,
        "matcha": 0,
        "frappe": 0,
        "smoothie": 0,
        "milktea": 0,
        "matchafloat": 0,
        "roll": 0,
        "bagel": 0,
        "baguette": 0,
        "cheesebun": 0,
        "pretzel": 0,
        "focaccia": 0,
        "ciabatta": 0,
        "raisinbread": 0,
        "sourdough": 0,
        "rye": 0,
        "chocobread": 0,
        "shokupan": 0,
        "brioche": 0,
        "fruitbrioche": 0,
        "garlicbread": 0,
        "donut": 0,
        "scone": 0,
        "cookie": 0,
        "croissant": 0,
        "painchoc": 0,
        "brownie": 0,
        "cinnamon": 0,
        "muffin": 0,
        "creampuff": 0,
        "melonpan": 0,
        "eggtart": 0,
        "cake": 0,
        "swissroll": 0,
        "cheesecake": 0,
        "macaron": 0
      },
      "upgrades": {
        "marketing": 0,
        "machine": 0,
        "barista": 0,
        "server": 0,
        "cook": 0,
        "tables": 0
      },
      "kitchen": false,
      "regions": [],
      "fixtureCosts": {
        "recipes": 0,
        "upgrades": 0,
        "kitchen": 0,
        "regions": 0,
        "total": 0
      },
      "note": "Common owned fixture is endowed equally within stage, not paid again. Starter espresso/furniture are free. Working cash is experimental seed capital, not a claim about new-game progression."
    },
    {
      "stage": "mid",
      "goalIndex": 15,
      "goalRewards": "exhausted/excluded",
      "starting": {
        "cash": 10000,
        "inventory": 50,
        "care": 0,
        "promotion": 0,
        "total": 10050
      },
      "items": {
        "espresso": 1,
        "americano": 1,
        "latte": 1,
        "cappuccino": 0,
        "flatwhite": 0,
        "cortado": 0,
        "mocha": 0,
        "vienna": 0,
        "macchiato": 0,
        "coldbrew": 0,
        "dirty": 0,
        "pourover": 0,
        "creamcoffee": 0,
        "affogato": 0,
        "blacktea": 1,
        "hotchoc": 0,
        "lemontea": 0,
        "chai": 0,
        "fruittea": 0,
        "hojicha": 0,
        "matcha": 0,
        "frappe": 0,
        "smoothie": 0,
        "milktea": 0,
        "matchafloat": 0,
        "roll": 1,
        "bagel": 1,
        "baguette": 0,
        "cheesebun": 0,
        "pretzel": 0,
        "focaccia": 0,
        "ciabatta": 0,
        "raisinbread": 0,
        "sourdough": 0,
        "rye": 0,
        "chocobread": 0,
        "shokupan": 0,
        "brioche": 0,
        "fruitbrioche": 0,
        "garlicbread": 0,
        "donut": 1,
        "scone": 0,
        "cookie": 0,
        "croissant": 0,
        "painchoc": 0,
        "brownie": 0,
        "cinnamon": 0,
        "muffin": 0,
        "creampuff": 0,
        "melonpan": 0,
        "eggtart": 0,
        "cake": 0,
        "swissroll": 0,
        "cheesecake": 0,
        "macaron": 0
      },
      "upgrades": {
        "marketing": 0,
        "machine": 0,
        "barista": 0,
        "server": 0,
        "cook": 0,
        "tables": 0
      },
      "kitchen": true,
      "regions": [],
      "fixtureCosts": {
        "recipes": 730,
        "upgrades": 0,
        "kitchen": 800,
        "regions": 0,
        "total": 1530
      },
      "note": "Common owned fixture is endowed equally within stage, not paid again. Starter espresso/furniture are free. Working cash is experimental seed capital, not a claim about new-game progression."
    },
    {
      "stage": "expanded",
      "goalIndex": 15,
      "goalRewards": "exhausted/excluded",
      "starting": {
        "cash": 50000,
        "inventory": 50,
        "care": 0,
        "promotion": 0,
        "total": 50050
      },
      "items": {
        "espresso": 1,
        "americano": 1,
        "latte": 1,
        "cappuccino": 1,
        "flatwhite": 1,
        "cortado": 0,
        "mocha": 0,
        "vienna": 0,
        "macchiato": 0,
        "coldbrew": 0,
        "dirty": 0,
        "pourover": 0,
        "creamcoffee": 0,
        "affogato": 0,
        "blacktea": 1,
        "hotchoc": 1,
        "lemontea": 1,
        "chai": 0,
        "fruittea": 0,
        "hojicha": 0,
        "matcha": 0,
        "frappe": 0,
        "smoothie": 0,
        "milktea": 0,
        "matchafloat": 0,
        "roll": 1,
        "bagel": 1,
        "baguette": 1,
        "cheesebun": 1,
        "pretzel": 0,
        "focaccia": 0,
        "ciabatta": 0,
        "raisinbread": 0,
        "sourdough": 0,
        "rye": 0,
        "chocobread": 0,
        "shokupan": 0,
        "brioche": 0,
        "fruitbrioche": 0,
        "garlicbread": 0,
        "donut": 1,
        "scone": 1,
        "cookie": 1,
        "croissant": 0,
        "painchoc": 0,
        "brownie": 0,
        "cinnamon": 0,
        "muffin": 0,
        "creampuff": 0,
        "melonpan": 0,
        "eggtart": 0,
        "cake": 0,
        "swissroll": 0,
        "cheesecake": 0,
        "macaron": 0
      },
      "upgrades": {
        "marketing": 8,
        "machine": 4,
        "barista": 2,
        "server": 1,
        "cook": 1,
        "tables": 2
      },
      "kitchen": true,
      "regions": [
        "reading",
        "greenhouse"
      ],
      "fixtureCosts": {
        "recipes": 18430,
        "upgrades": 11240.21373046875,
        "kitchen": 800,
        "regions": 19200,
        "total": 49670.21373046875
      },
      "note": "Common owned fixture is endowed equally within stage, not paid again. Starter espresso/furniture are free. Working cash is experimental seed capital, not a claim about new-game progression."
    }
  ]
}
```

Validation: complete 11/11 scenarios, 30 fixed seeds each, 30 reconciled daily records per seed, no drain timeouts, current gameplay/shared-runner/extension-runner hashes verified. Execution log: `logs/economy-long-horizon.log`. The interrupted pre-layout-reset pilot is archived separately and is not included in these results.
