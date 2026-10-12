# Actual fresh-save progression

## Evidence status

All 18 runs in `all-six-v3-chair-care-corrected.json` reached all three operating-style stages using actual earned money after the chair-clearance and care-forecast corrections. This is six routes × three fixed seeds, with no injected money, stock, skill or fixture facilities. Source fingerprints match at the beginning and end of the run. All 54 exact stage snapshots passed economic, checklist and live-runtime round-trip verification (`snapshot-roundtrip-v3.json`). Earlier evidence is retained below.

These runs prove reachable examples under one reasonable automated purchase policy. They do not rank styles by profit, prove optimal play, or establish a guarantee for every player. Each route stops at its own completion time, so their terminal profits are not equal-time comparisons.

## Results

| Route | Completed service days | Late-stage first crossing, game minutes | Lost guests | Waste cost | Final rating |
| --- | ---: | ---: | ---: | ---: | ---: |
| Specialty coffee | 9 | 27.43–27.60 | 0–1 | 0 | 4.65–4.69 |
| Neighborhood bakery | 9–10 | 28.17–31.30 | 4–14 | 161–190 | 4.52–4.90 |
| Cat & cozy café | 8–9 | 23.43–24.63 | 0–5 | 0 | 5.00 |
| Commuter takeaway | 8–9 | 24.10–27.20 | 0 | 0 | 4.59–4.85 |
| Garden afternoon tea | 12–13 | 37.75–40.87 | 16–40 | 576–752 | 4.28–4.46 |
| Bookish community | 12–13 | 36.05–39.46 | 1–6 | 0 | 4.92–5.00 |

A service day is 180 open seconds plus the actual accepted-service closing drain. First crossing can occur during service or later preparation, and records day, phase, elapsed seconds and completed prior days. The final checklist is revalidated separately. Ending the current service day after a crossing preserves honest closing/stock accounting.

## How to reproduce

Default smoke:

```sh
npx vitest run scripts/cafe-style-progression.test.ts
```

Full pass with immutable evidence and exact stage-snapshot exports:

```sh
CAFESTYLE_PROGRESSION=1 CAFESTYLE_PROGRESSION_SEEDS=3 CAFESTYLE_PROGRESSION_DAYS=120 CAFESTYLE_PROGRESSION_LABEL=my-new-label CAFESTYLE_PROGRESSION_SNAPSHOTS=1 npx vitest run scripts/cafe-style-progression.test.ts --silent=false --disableConsoleIntercept
```

An existing label is rejected, preserving prior evidence. Omit the label for a unique timestamp label. Set `CAFESTYLE_PROGRESSION_STYLES` to a comma-separated subset to diagnose one route. Seeds are deterministic and recorded. Source changes during a run fail verification after retaining the raw results.

## Player policy and growth examples

- Start with the genuine starter espresso and 50 beans. No manual boost or emergency grant is used.
- Claim tutorial rewards only when their existing conditions are met. They are recorded separately from customer revenue; the style checklists have no cash rewards.
- Shop and change menus only while closed. Restock from the actual forecast, retain one forecast of working cash where affordable, and make all investments with existing purchase APIs.
- Reinvest at most 30% of available cash in current route recipe prices each preparation. Starter espresso stops at level 10; other route recipes stop at level 25. These caps describe this policy, not a player requirement.
- Coffee: espresso bootstrap → espresso/latte proficiency and paid research → latte/flat white. Machinery and staff are bought rather than endowed.
- Bakery: save for the 800-coin kitchen and roll unlock, then offer espresso/roll/donut. Research real bakery deliveries and graduate to espresso/roll/croissant. Combo orders, cook work and unsold batches remain real.
- Cats: establish affordable drink margins, then buy ginger, black and tuxedo plus comfort and service capacity. The run uses the ordinary automatic care refill and pays every care pack.
- Takeaway: espresso → americano → americano/cortado. Each commuter drink qualifies using its unmodified recipe time; machine upgrades do not alter eligibility.
- Garden: black tea and a cactus windowsill plus legally placed wall décor → tea/scone → reading room, greenhouse and terrace with paid servers. No distant room is free.
- Community: familiar espresso/black tea and comfort → reading room/service staff → a physically placed bookshelf. Actual seated handoffs and reputation are required.

## Accounting and limits

- The initial endowment is 0 cash plus 50 coins of beans. Capital includes recipe levels, staff, rooms, décor, research, and adoption less the included care pack.
- Each day reconciles cash + pantry + unused care against initial liquid assets + operating profit + legal tutorial rewards − capital. Maximum tolerated numerical error is 0.00001 coin.
- Revenue, ingredient consumption, recurring care, stock purchases, investments, tutorial rewards, waste, rating, queue removals and closing duration/revenue are retained in raw day-by-day records.
- Waste is consumed ingredient value minus delivered-food ingredient value after the accepted-service drain. Closing staleness is included, not charged twice.
- A drain exceeding 300 seconds is recorded as a blocker with exact furniture, customer, server, cook and pass state. The runner never force-closes to manufacture completion.
- The observation bound is 120 days by default. Censoring means this policy has not established completion within that bound, not that a style is impossible.
- Three seeds establish reproducible reachability examples; the separate route-balance matrix supplies the larger controlled comparison.

## Stock nuance worth knowing

The v2 run exposed a forecast issue: exactly exhausted care packs contributed no traffic during preparation, even though paid auto-refill restored their traffic after opening. The game now anticipates the initial auto-refills affordable from shared cash, without activating cats or spending money in the forecast. The unchanged player policy records 0–5 lost guests over 8–9 service days for cats in v3, compared with 26–31 over nine days in v2. These stop-at-completion windows differ, so this is a diagnostic before/after observation, not an equal-duration balance comparison. There is no free care or hidden stock grant in either version.

## Snapshots and earlier pilots

Optional snapshot exports are exact game-save payloads at first observed qualifying stage checkpoints, with live runtime included while open. They are written only to the external QA-fixtures directory, never this repository. Sidecar metadata identifies route, seed, stage, source fingerprint and actual-earned provenance. The profile remains null; any QA-only onboarding name/look must be labeled a cosmetic presentation adjustment.

- `pilot-v1-coffee-bakery-takeaway.json`: first reachability pilot. Bakery used a bread-only menu; not the final combo-exercising policy.
- `pilot-v2-cats-garden-community.json`: intermediate source before all final operating effects landed. Historical pilot, not final effect validation.
- `all-six-v2-final-contracts.json`: 18 successful trajectories with all six final operating contracts, before the chair-placement and care-forecast corrections.
- `all-six-v3-chair-care-corrected.json`: current verified 18-trajectory rerun after both corrections, including exact first-observed stage exports.
- `snapshot-roundtrip-v3.json`: all 54 exported saves preserve cash, pantry, décor, focus/counters and their qualifying stage after deserialization; every open-stage live runtime restores successfully.

Current verified game fingerprint: `9c47eab7d2f2b1fe47e094df3f22c41f6a6a51043c338e952a6de37a27352c4d`. Any later gameplay change requires a new labeled run before treating these results as current.
