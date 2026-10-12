# Earned-union follow-up: execution and results

Status: all 1,050 training and 1,050 independent holdout samples are complete. **The preregistered holdout acceptance failed on one of 34 frozen comparison edges.** The profit advantage over same-menu cats did not reproduce with a positive confidence bound. The other 33 edges, own-plain benefit and frozen downside passed. The original final-v1 dominance findings remain valid and preserved. After this result, an explicit review decision authorized the originally planned feature/rush phase as a sustainability regression. It ran from 12:10 to 12:40 UTC and completed all 2,100 samples. This departs from the original conditional sequencing, while leaving the failed gate, policy pool, seeds, metrics and gameplay unchanged.

## Frozen setup

- [Protocol and selection/holdout rule](EARNED-UNION-PREREGISTRATION.md)
- [Six-source snapshot manifest and exact five-menu pool](results/earned-late-union-input.json)
- [Actual API purchase ledger and reconstructed ownership](results/earned-late-union-setup.json)
- Source: `9c47eab7d2f2b1fe47e094df3f22c41f6a6a51043c338e952a6de37a27352c4d`
- Design: `c949700064750634c205c18d05729a91875c17129cff3e57fd3fbcc839d600ef`
- Paid capital: 724,267.3781053446; prepaid first care: 29; purchase cash: 724,296.3781053446
- Funding: 823,065; retained cash: 98,768.6218946554; required reserve: 98,767.80
- Shared comfort: 46; legal purchased bookshelf at main col31,row9 and poster at col27,row0; ordinary starter clock/mugrack retained

Two setup/real-Sim smoke tests passed. An independent read-only audit verified all six snapshot hashes, every ownership/progress maximum/union, the legal common layout and all ledger identities. The independent static quote differs from actual purchase deductions by less than 1e-8 coins.

## Execution

Training uses 35 policies × 30 original fixed seeds, split across eight resumable shards `earned-union-v1-training-shard0`…`7`. The immutable snapshot contains the unchanged final game and separate new frontier harness; the original v1 harness is not edited.

Each shard can be resumed from the same frozen source/design:

```sh
N=0
CAFE_STYLE_FRONTIER=1 FRONTIER_COHORT=training FRONTIER_SHARDS=8 FRONTIER_SHARD="$N" \
  FRONTIER_LABEL="earned-union-v1-training-shard$N" \
  ./node_modules/.bin/vitest run scripts/cafe-style-frontier.test.ts --maxWorkers=1
```

Set `FRONTIER_RESULTS_DIR` to an absolute shared result directory when running another source snapshot. Resume refuses a changed game, design, cohort, scenario scope or seed list. Preserve the original manifest/protocol byte-for-byte because they form the design fingerprint.

After all shards complete:

```sh
FRONTIER_MERGE=earned-union-v1-training ./node_modules/.bin/vitest run scripts/cafe-style-frontier.test.ts --maxWorkers=1
FRONTIER_VERIFY=training ./node_modules/.bin/vitest run scripts/cafe-style-frontier-verify.test.ts --maxWorkers=1
```

The second command writes every candidate/comparator analysis and an explicit frozen selection record, including a no-candidate result if the stronger rule fails. Only a qualifying training candidate proceeds to the predeclared independent holdout; holdout may not select a replacement winner.

## Training finding and frozen selection

All 35 policies and all five garden menu candidates are retained. The frozen selection is **garden with black tea + scone**; the other four garden menus did not qualify. The selected policy has a material primary-metric advantage against every one of the 34 alternatives: profit supplies 33 frozen edges, and waste supplies the edge against bakery on the same tea/scone menu.

- Mean net after capital: **2,235,529 coins**; operating-profit mean: **2,959,796**, with a positive lower 95% bound of **2,919,261**. There were no cash-constrained restocks.
- Against the same-menu plain control: profit **+171,098** [115,339, 226,856], with **25/30** positive seeds. Waste falls **54.9** coins [25.0, 84.9]. The costs are a **1.36 percentage-point higher loss rate**, **0.274 fewer stars**, and **47.6 fewer served guests**.
- Frozen headline comparison: versus cats on the same tea/scone menu, profit **+51,301** [9,874, 92,729], **21/30** wins. This edge must reproduce on holdout; the lower bound is fairly close to zero, so it is not treated as certain.
- Against bakery on the same menu: waste **−362.1** coins [−390.0, −334.3], **30/30** wins. The profit interval includes zero; garden serves **28.4 fewer guests** and scores **0.178 fewer stars**.
- Frozen downside: community on latte/flat white has a **6.78 percentage-point lower loss rate** [6.46, 7.10], **30/30** wins. The conservative pending-outcome improvement remains **6.05 pp** [5.68, 6.43]. Garden does not dominate that alternative.

A supplementary waste-efficiency check against same-menu bakery also favors garden: **0.534 fewer wasted coins per served guest** [0.483, 0.584], and a **3.33 percentage-point smaller wasted share of ingredient expense** [3.04, 3.62]. These diagnostics were calculated after training selection and do not replace the preregistered absolute-waste edge. They show that the recorded waste difference is not solely fewer served guests.

Artifacts:

- [Complete training raw rows](results/earned-union-v1-training.json)
- [Training summary](results/earned-union-v1-training-summary.json)
- [Every garden candidate, comparator and unsuccessful choice](results/earned-union-v1-training-analysis.json)
- [Frozen menu, primary metrics, all 34 edges and downside](results/earned-union-v1-training-selection.json)
- [Training verification log](results/earned-union-v1-training-verification.log)
- [Holdout launch timestamp and frozen-selection SHA256](results/earned-union-v1-holdout-launch.json)

The holdout uses the predetermined disjoint 30 seeds and all 35 policies. No menu, comparator, metric, threshold, investment or gameplay value is changed after viewing training. The artifact reader also checks the inherited original harness fingerprint, so the unchanged accounting dependency cannot silently drift.


## Independent holdout: one failed frozen edge

The 30 new seeds are disjoint from training. All 35 policies were evaluated, and all 1,050 rows passed the source, setup, clock, accounting and event-counter checks. The selected menu and every comparison metric remained frozen.

| Holdout comparison | Frozen metric | Garden minus comparator, mean [paired 95% CI] | Favorable seeds | Result |
| --- | --- | ---: | ---: | --- |
| Same-menu plain | Net-liquid profit | +263,823 [222,046, 305,601] coins | 29/30 | Pass |
| Same-menu cats, headline | Net-liquid profit | +23,924 [−29,614, 77,462] coins | 19/30 | **Fail: interval includes zero** |
| Same-menu bakery | Waste cost | −337.1 [−364.1, −310.0] coins | 30/30 | Pass |
| Remaining 31 frozen edges | Net-liquid profit | Complete paired results in the verification artifact | See artifact | All pass |

The cats comparison exceeds its 22,241-coin materiality threshold in the mean, but not its confidence requirement. This is an inconclusive profit difference, not evidence that cats is more profitable. An independent raw-data audit confirms that garden remains descriptively nondominated among all 35 holdout policies and has the highest mean net profit (2,248,021 versus cats at 2,224,097). Mean ranking and the stricter frozen-edge acceptance are different claims; only the former is supported here. Garden's holdout waste is also lower than same-menu cats by **38.9 coins** [10.9, 66.9], with 22/30 favorable seeds. That is a separate descriptive finding; it cannot replace the preregistered profit edge or turn the failed gate into a pass.

The operating tradeoffs remain substantial:

- Against same-menu plain, garden's observed loss rate is **1.30 pp higher** [0.86, 1.75], rating is **0.293 stars lower** [0.187, 0.398], and served guests are **44.7 fewer** [38.4, 51.0]. Its own-plain profit benefit is **13.30%**.
- Against same-menu cats, garden's loss rate is **1.38 pp higher** [0.76, 2.00], rating is **0.318 stars lower** [0.229, 0.407], and served guests are **49.0 fewer** [43.1, 54.9].
- The frozen downside also reproduces: community on latte/flat white has a **6.95 pp lower loss rate** [6.57, 7.32], 30/30 favorable seeds. Its conservative pending-outcome advantage remains **6.35 pp** [5.97, 6.72].

Garden's selected holdout policy averages **2,248,021 coins net after capital**, **2,972,289 operating profit** [2,937,023, 3,007,554], **6.95% observed lost demand**, **716.3 wasted coins**, **3.894 latest-50-review stars**, and **587.5 served guests**. All 30 samples recover their own paid capital, with mean first payback **441.49 simulated seconds** and range **362.15–501.70 seconds**. There are no cash-constrained restocks. These are fixed-window fixture results, not unlimited-horizon guarantees.

The unsuccessful training candidates remain visible rather than being replaced after holdout:

| Garden menu | Training mean net after capital, coins | Comparators without a qualifying primary edge/equivalence | Selected? |
| --- | ---: | ---: | --- |
| latte + flatwhite | 481,852 | 2 | No |
| espresso + roll + croissant | −4,326 | 11 | No |
| espresso + blacktea | −181,032 | 18 | No |
| americano + cortado | −156,178 | 12 | No |
| blacktea + scone | 2,235,529 | 0 | Yes; frozen holdout gate subsequently failed |

Artifacts:

- [Complete holdout raw rows](results/earned-union-v1-holdout.json)
- [Holdout summary](results/earned-union-v1-holdout-summary.json)
- [All frozen edges, failed headline, downside and payback](results/earned-union-v1-holdout-verification.json)
- [Holdout verification log, including the genuine failed assertion](results/earned-union-v1-holdout-verification.log)

The failed assertion is deliberate evidence retention, not a test timeout or invalid dataset. The source, sampler, protocol, frozen selection and reader are unchanged. No new winner or metric is selected from the holdout. The original nine-cell garden failure is not erased, and no price, margin or reward was adjusted to obtain this follow-up.

## Reproduce the holdout and its failure

For each `N=0` through `7`, using the same frozen checkout and evidence directory:

```sh
N=0
CAFE_STYLE_FRONTIER=1 FRONTIER_COHORT=holdout FRONTIER_PRESSURES=base \
  FRONTIER_SHARDS=8 FRONTIER_SHARD="$N" \
  FRONTIER_LABEL="earned-union-v1-holdout-shard$N" \
  ./node_modules/.bin/vitest run scripts/cafe-style-frontier.test.ts --maxWorkers=1
```

After all eight shards finish:

```sh
FRONTIER_MERGE=earned-union-v1-holdout ./node_modules/.bin/vitest run scripts/cafe-style-frontier.test.ts --maxWorkers=1
FRONTIER_VERIFY=holdout ./node_modules/.bin/vitest run scripts/cafe-style-frontier-verify.test.ts --maxWorkers=1
```

**Expected exit status: 1 for the holdout verification command.** It fails the frozen scientific acceptance assertion while preserving its full report. It is not appropriate to remove that assertion or change the selection to make the command green. Training selection and its complete raw data must remain available because the reader recomputes them before validating holdout.

For the separately authorized pressure regression, the per-shard settings are `FRONTIER_COHORT=holdout`, `FRONTIER_PRESSURES=feature,rush`, and `FRONTIER_LABEL="earned-union-v1-pressure-shard$N"`. Merge with `FRONTIER_MERGE=earned-union-v1-pressure`; read with `FRONTIER_VERIFY=pressure FRONTIER_VERIFY_LABEL=earned-union-v1-pressure`. The regression is complete. Its launch is an explicitly authorized departure from the original holdout-conditioned sequencing, not a claim that the failed holdout gate passed.

The exact delivered pressure commands are:

```sh
# Repeat N=0 through N=7; concurrency is optional.
N=0
CAFE_STYLE_FRONTIER=1 FRONTIER_COHORT=holdout FRONTIER_PRESSURES=feature,rush \
  FRONTIER_SHARDS=8 FRONTIER_SHARD="$N" \
  FRONTIER_LABEL="earned-union-v1-pressure-shard$N" \
  ./node_modules/.bin/vitest run scripts/cafe-style-frontier.test.ts --maxWorkers=1

FRONTIER_MERGE=earned-union-v1-pressure ./node_modules/.bin/vitest run scripts/cafe-style-frontier.test.ts --maxWorkers=1
FRONTIER_VERIFY=pressure FRONTIER_VERIFY_LABEL=earned-union-v1-pressure \
  ./node_modules/.bin/vitest run scripts/cafe-style-frontier-verify.test.ts --maxWorkers=1
```

These pressure commands exit successfully because their declared assertion is positive operations and valid evidence, while the report explicitly retains the false all-edge flag. They do not assert that the failed base-holdout or rush cats-profit edge passed.


The selection additionally binds reader SHA256 `14c399527028fa34d482b7de280b8accc5fef97c41b8ec95482e418b30f6c44a` and the exact training data SHA256. The reader refuses a changed or incomplete frozen selection, a different game or design, wrong cohort/seed/scope, omitted edges, and altered original accounting-harness dependencies.


## Authorized pressure sustainability regression

At 12:10 UTC, the review decision was to retain the failed profit edge and proceed with the already specified **35 policies × 30 held-out seeds × two paid pressures = 2,100 samples**. The user-facing requirement is a genuine useful route with costs and sustainable operations, not statistically significant net-profit superiority over every competing policy. The more demanding all-frozen-edge criterion remains a failed auxiliary scientific test. It is not deleted, weakened or marked as passed.

The [timestamped launch record](results/earned-union-v1-pressure-launch.json) binds the exact frozen selection and failed holdout report by SHA256 and records this conditional-sequencing departure. No extra menus, new seeds, replacement winner, new threshold, price change or reward adjustment was introduced. All alternatives receive the same recorded paid promotion plans under the same affordability and airtime accounting. The pressure reader reports every original frozen edge again and requires positive selected-policy operating profit; it does not assert universal edge survival.

All pressure results are now complete, as detailed below. The 30-minute horizon, latest-50 rating, unresolved terminal guests, finite menu pool and synthetic shared capability all continue to limit interpretation. Absence of a mean dominator in the sampled table does not establish universal or unlimited-horizon nondominance.


## Completed pressure results

All **70 policy/pressure cells × 30 seeds = 2,100 samples** completed with the original source/design fingerprints. Every cell has a positive operating-profit lower 95% bound; the smallest is **601,259 coins**. Across the whole family there are **zero cash-constrained restocks**, **zero failed promotion bookings**, **1,772 recovered-capital samples** and **328 right-censored samples**. The maximum cash/asset reconciliation discrepancy is below **0.000000040 coins**. No sample triggered the simulation or drainage guards.

The pressure sustainability reader passes its three active tests, with one phase-specific test skipped. Its separate all-frozen-edge flag is **false** because the rush cats-profit edge fails. A passing sustainability command must not be described as a passing strict profit-frontier gate.

### Selected garden policy, same paid portfolio and black tea + scone menu

| Held-out pressure | Mean net after capital | Operating profit [95% CI] | Observed loss rate | Waste, coins | Latest-50 rating | Served | Mean first capital payback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base | 2,248,021 | 2,972,289 [2,937,023, 3,007,554] | 6.95% | 716.3 | 3.894 | 587.5 | 441.49 s |
| Feature | 2,423,907 | 3,148,175 [3,109,395, 3,186,954] | 13.28% | 652.3 | 3.499 | 658.3 | 414.98 s |
| Rush | 2,833,813 | 3,558,080 [3,518,796, 3,597,365] | 26.57% | 585.6 | 2.815 | 807.1 | 354.77 s |

All 30 selected garden samples recover capital at each pressure, with no constrained restocks. Higher paid traffic raises profit and throughput while substantially worsening observed losses and reputation. This is a real operating cost, not a claim that maximal promotion is always a good choice.

Mean paid campaign cash is **250 coins for feature** and **1,620 for rush**; unused campaign assets at cutoff are **23.09** and **39.17** respectively. Thus recognized campaign expense is **226.91** and **1,580.83**, rather than ignoring fees or charging unused airtime twice. Periodic care and ingredients remain charged normally.

### The frozen comparisons under pressure

- **Feature:** all **34/34** frozen edges, own-plain benefit and downside reproduce. Garden's same-menu cats profit difference is **+47,381** [1,155, 93,606], **18/30** positive seeds. The confidence bound is narrow, so this must not erase base uncertainty or be generalized to rush.
- **Rush:** **33/34** frozen edges reproduce. Cats on the same menu is materially more profitable: garden minus cats is **−59,746** [−104,993, −14,500], only **10/30** positive garden seeds. Garden also loses **4.40 pp** more demand [3.81, 4.99], has **0.371 fewer stars** [0.249, 0.492], and serves **106.4 fewer guests** [98.8, 114.1]. Its **18.7-coin lower mean waste** has an interval spanning zero [−37.9, 0.6]. There is no demonstrated rush advantage over cats on these four primary metrics.
- The original own-plain profit benefit survives both pressures: feature **+215,591** [165,162, 266,019], **29/30** positive seeds; rush **+131,896** [75,471, 188,320], **24/30**. Its own-plain loss and rating costs also persist.
- The frozen same-menu bakery waste advantage survives: feature **−286.4 coins** [−315.4, −257.4]; rush **−125.9** [−144.7, −107.1], **30/30** favorable seeds in each. At rush, bakery earns **133,610 more coins** [91,317, 175,902] and serves **99.3 more guests** [92.1, 106.6]. Lower waste is a genuine tradeoff, not profit superiority.
- The frozen community downside survives: its observed loss advantage over garden is **13.27 pp** at feature and **24.02 pp** at rush. Even the conservative pending-outcome bounds remain favorable: feature **12.61 pp** [12.17, 13.05]; rush **23.11 pp** [22.50, 23.72].

Garden is descriptively mean-nondominated in both pressure tables, but rush illustrates why that weak statement is insufficient by itself: an inconclusive small waste difference prevents literal mean dominance while cats has clear profit, loss and rating advantages. The defensible garden niche rests on the reproduced base/feature operating benefits and explicit costs. It is not universal competitiveness across all traffic levels or proof of unlimited-horizon balance.

### Final evidence and interpretation

- [All 2,100 pressure raw samples](results/earned-union-v1-pressure.json)
- [All 70 pressure cell summaries](results/earned-union-v1-pressure-summary.json)
- [Every frozen pressure edge, failure, downside and payback](results/earned-union-v1-pressure-verification.json)
- [Whole-policy descriptive cash, operating and frontier audit](results/earned-union-v1-pressure-descriptive-audit.json)
- [Passing pressure sustainability reader log](results/earned-union-v1-pressure-verification.log)
- [Original failed base-holdout gate, still retained](results/earned-union-v1-holdout-verification.json)

This follow-up contributes **4,200 samples** across training, base holdout and paid pressure, for **13,920 total controlled samples** including the original 9,720. Each phase retains every alternative, not just the selected menu. Feature and rush use the same held-out seed list as base; they are different conditions, not a third independent seed cohort. The [independent acceptance review](ACCEPTANCE.md) separates the user's required reproducible route benefit/cost from the intentionally stricter auxiliary gate, which remains failed.
