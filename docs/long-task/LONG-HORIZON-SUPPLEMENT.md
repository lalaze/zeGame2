# Thirty-day upgraded-espresso attraction supplement

## Main finding

Fast upgraded espresso provides a concrete positive-return attraction case. Against the same paid espresso-ten control, ginger adds 6,501.70 net coins over 30 days (95% mean interval 5,678.62–7,324.78), noteLocal adds 21,513.12 (20,642.45–22,383.80), and their combination adds 29,539.45 (28,704.53–30,374.37). All three finish ahead in every seed. Cat capital first recovers on days 1–10; the combined arm on days 1–2. Positive advantage remains sustained through day 30 from days 1–10 for cat, days 1–3 for promotion, and days 1–2 for the combination.

This is evidence against calling cats or promotions universally poor investments. Their value depends on sale margin and capacity to serve added demand. It does not mean combined advertising is always best, nor establish an optimal menu/upgrade policy. The shared espresso-ten control matches the main 30-day dataset exactly for all 30 seeds.

## Scope and accounting

This extends four upgraded-espresso fixed policies to 30 days with 30 predetermined seeds each (3,600 cafe-days). It uses the actual shared sample implementation, 0.05-second Sim steps, 180 seconds open per day, and accepted-service drain capped at 300 seconds. These are thirty-day observations, not infinite-horizon optimality or a reinvestment strategy study.

All four scenarios start from the same early fixture, pay for ten espresso upgrades, and sell espresso only. The control buys those upgrades without attraction spending; interventions add ginger, renewed noteLocal, or both. Pairing against the upgraded control isolates attraction on a fast, high-margin product. Exact common fixtures and their capital valuation are in result metadata. No additional staff, kitchen, or marketing is endowed beyond the early fixture.

All intervention costs are charged by actual game functions. Ginger adoption includes care: adoption cash is split into non-refundable capital and prepaid care. Care used and promotion airtime used are operating expenses. Promotions renew in preparation when expired; noteLocal spans two 180-second open days. Ingredients are forecast-restocked subject to cash; residual pantry and prepaid care/promotion remain in liquid wealth. No click income, reward claims, debt, revenue injection, rescue financing, or reinvestment is added.

Net-liquid profit is final cash plus inventory/prepayments at cost minus starting liquid wealth. It equals cumulative operating profit minus intervention capital; every simulated day is checked by the imported runner. Capital has no assumed resale value. Formula-based mean confidence intervals are descriptive normal approximations (mean ±1.96×sample SD/√30), not simultaneous tests; raw seed results and SDs remain available. Near-zero count intervals can extend below zero without implying negative observed losses.

Same predetermined seed labels are paired across strategies; different event paths do not imply customer-identical random draws. A first payback crossing can reverse later. We separately report terminal positive net advantage and the first day from which advantage stays positive through observed day 30. This is bounded persistence through the observation window, not a guarantee about subsequent days.

## Thirty-day outcomes

| Scenario | Operating profit [95% CI] | Net-liquid profit [95% CI] | Lost customers [95% CI] | Waste cost [95% CI] | Final rating [95% CI] |
|---|---:|---:|---:|---:|---:|
| early/initial/espresso-ten | 92,536.23 [91,912.99, 93,159.48] | 92,379 [91,755.75, 93,002.24] | 0 [0, 0] | 0 [0, 0] | 4.5 [4.5, 4.5] |
| early/initial/espresso-ten-cat | 99,329.93 [98,685.12, 99,974.74] | 98,880.7 [98,235.89, 99,525.51] | 0.57 [0.17, 0.96] | 0 [0, 0] | 4.5 [4.49, 4.5] |
| early/initial/espresso-ten-noteLocal | 114,049.36 [113,444.06, 114,654.65] | 113,892.12 [113,286.83, 114,497.41] | 0 [0, 0] | 0 [0, 0] | 4.5 [4.5, 4.5] |
| early/initial/espresso-ten-cat-noteLocal | 122,367.69 [121,650.49, 123,084.88] | 121,918.45 [121,201.26, 122,635.64] | 0.27 [0.08, 0.45] | 0 [0, 0] | 4.5 [4.49, 4.5] |

## Paired intervention versus same-stage hold

Capital payback is the first cumulative incremental operating profit covering incremental capital. Pure promotion has no capital, so capital payback/censoring is not applicable; its expense is already deducted from operating profit. Every terminal advantage includes all charged adoption, consumed care, and consumed promotion costs.

| Scenario | Terminal net advantage [95% CI] | First capital recovery /30 | Capital censored /30 | First recovery days | Positive at day 30 /30 | Recovered then nonpositive /30 | Sustained-positive start days (through day 30 only) |
|---|---:|---:|---:|---|---:|---:|---|
| early/initial/espresso-ten-cat | 6,501.7 [5,678.62, 7,324.78] | 30 | 0 | 1–10 | 30 | 0 | 1–10 |
| early/initial/espresso-ten-noteLocal | 21,513.12 [20,642.45, 22,383.8] | N/A | N/A | N/A | 30 | N/A | 1–3 |
| early/initial/espresso-ten-cat-noteLocal | 29,539.45 [28,704.53, 30,374.37] | 30 | 0 | 1–2 | 30 | 0 | 1–2 |

## Reproducibility and limitations

Run `ECONOMY_LONG_HORIZON_SUPPLEMENT=1 npx vitest run scripts/economy-long-horizon-supplement.test.ts --silent=false --disableConsoleIntercept`. Atomic, resumable batches are saved in `results/economy-long-horizon-supplement.json`; an interrupted file remains `complete:false`. SHA-256 fingerprints cover gameplay and both shared and extension runners. A fingerprint mismatch refuses to resume; archive the old dataset rather than mixing code versions. Partial seed batches resume safely. Ordinary tests only validate the design.

No spending/traffic policy is optimized here. Fixed single-drink fixtures are intentionally narrow; bakery dynamics, all-menu complexity, huge-budget progression, subjective cosmetic value, and dynamic upgrade decisions require other evidence. A negative intervention advantage does not mean the cafe as a whole loses money. These results should inform choices, not flatten distinct strategies or imply that all cats/promotions have identical returns.

Metadata:

```json
{
  "gameFingerprint": "0b73358c463ed8805ac4d16e7d0c831eec28bfed99fb0b5b19b7156422bd76cf",
  "runnerFingerprint": "8903f00cbedbafdd1a90a7e5375bba651b71abd402a17f1d808c1d498b596075",
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
    }
  ]
}
```

Validation: complete 4/4 scenarios, 30 fixed seeds each, 30 reconciled daily records per seed, no drain timeouts, current gameplay/shared-runner/extension-runner hashes verified. Execution log: `logs/economy-long-horizon-supplement.log`. See the [main study](LONG-HORIZON.md) for lower-margin and capacity-constrained comparisons.
