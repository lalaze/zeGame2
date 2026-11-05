# Idle pacing: the till, catering orders, real-time building, franchises and chain stars

The semi-idle layer is tuned in **real hours**, not business days, because that is what an idle player feels.
`scripts/idle-pacing.ts` plays a fresh café for two weeks of real time against four check-in schedules and records
when each step of the unlock route is reached.

```sh
npm run balance:idle                          # writes docs/idle-pacing/results/current.{md,json}
IDLE_PACING_LABEL=trial npm run balance:idle  # any label
```

## How the run works

- Away pay, the till, catering orders, room building, purchases, goals and branches all go through the real game
  functions.
- Business days are modelled with `expectedDayProfit` (the number away pay uses) instead of the 0.05-second Sim, so a
  run takes about a second. On-screen time carries over between sessions, as the live café does: one day per 200
  seconds (180 seconds of service plus preparation and closing).
- The player buys whatever pays for itself soonest, counting the wait to afford it. A new dish goes on the menu only if
  the menu earns more with it. Rooms, the kitchen and a bigger till are bought once they cost under half the player's
  cash. On the way out, the player takes the longest catering order that is ready by the next visit (or the shortest).
  A branch opens once the building is complete and its stars would raise prices by at least another fifth, in a
  new place each time (seaside, woods, city, flowers, then the old town again), so franchise place bonuses come into
  play. The player never spends stars on perks, so every star raises prices.
- Not modelled: decor, cats and their gifts, promotions, moments, flavor research and clicking. Real players are less
  efficient than this one (it mostly levels a few cheap dishes, which is also why it reaches few expensive ones), so read
  the timings as a competent player's pace, not a typical one.

Profiles: **hourly** (every hour 08:00–23:00, 3 minutes), **casual** (every 3 hours 08:00–23:00, 3 minutes), **light**
(08:00, 13:00 and 21:00, 5 minutes) and **workday** (on screen 09:00–17:00 at 1×, plus 5 minutes at 21:00). Every
profile starts with a 20-minute first sitting at 08:00 on day 1.

Columns are real time since that first sitting. *Rerun* is how long the second café takes to finish its building, as
a share of the first. A *dry return* is a check-in after hiring the manager where nothing that would raise the café's
earnings is affordable on arrival. *Away pay* is per check-in, in days of the current café's expected profit
(franchises and orders included). The last columns are the state after two weeks.

## Before (semi-idle at bf546ba, same player and reset rule)

| Profile | manager | kitchen | reading | greenhouse | terrace | firstBranch | terrace@2 | till1 | till2 | till3 | till4 | Rerun to terrace | Dry returns | Median away pay (days) | Final day · branches · stars · dishes | Priciest dish reached |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| hourly | 4.1h | 4.1h | 3.1h | 5.1h | 7.1h | 7.1h | 13h | — | — | — | — | 84% | 0/219 | 0.95 | 207 · 34 · 40275 · 3 | cappuccino ($1,200) |
| casual | 12.1h | 12.1h | 9.1h | 15h | 1d 0h | 1d 0h | 1d 12h | — | — | — | — | 50% | 0/79 | 2.95 | 81 · 24 · 8403 · 1 | scone ($1,100) |
| light | 1d 0h | 13.1h | 13.1h | 1d 5h | 1d 13h | 1d 13h | 2d 13h | — | — | — | — | 65% | 0/38 | 7.92 | 68 · 16 · 1549 · 1 | hotchoc ($900) |
| workday | 1.6h | 1.3h | 1.3h | 1.6h | 2.1h | 9h | 1d 1h | — | — | — | — | 758% | 0/27 | 4 | 2044 · 14 · 311179 · 4 | bagel ($150) |

## After

| Profile | manager | kitchen | reading | greenhouse | terrace | firstBranch | terrace@2 | till1 | till2 | till3 | till4 | Rerun to terrace | Dry returns | Median away pay (days) | Final day · branches · stars · dishes · places | Priciest dish reached |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| hourly | 17m | 2h | 3h | 15h | 2d 15h | 2d 15h | 4d 1h | 2h | 11h | 4d 0h | 5d 0h | 54% | 59/223 | 13.1 | 207 · 6 · 111 · 3 · 5 | hojicha ($180,000) |
| casual | 17m | 6h | 9h | 1d 0h | 3d 0h | 3d 0h | 4d 6h | 6h | 1d 0h | 4d 0h | 6d 0h | 42% | 1/83 | 36.41 | 81 · 7 · 127 · 4 · 5 | hojicha ($180,000) |
| light | 17m | 13h | 1d 0h | 1d 13h | 3d 13h | 3d 13h | 5d 5h | 13h | 1d 13h | 5d 5h | 6d 0h | 47% | 1/41 | 73.39 | 68 · 6 · 104 · 3 · 5 | hojicha ($180,000) |
| workday | 17m | 1.3h | 2.4h | 1d 1h | 3d 1h | 3d 9h | 5d 1h | 1.3h | 3.8h | 1d 7h | 9d 1h | 55% | 0/28 | 91.75 | 2044 · 6 · 115 · 3 · 5 | flatwhite ($4,000) |

Raw results: [before](results/before.json), [after](results/after.json).

## What changed and why

| | Before | After | Why |
|---|---|---|---|
| Manager | Reading Room + $2,500 | Day 3 + $300 | The first sitting should end with "leave, then come back to something". |
| Away pay | 1 day of profit per hour, 8-hour cap | 5 days of profit per hour into a till of 1 / 2 / 4 / 8 / 12 hours ($2K / $10M / $300M / $5B), then 10% for up to 24 more hours | Away pay was 1/18 of leaving the screen on, so the best play was never to leave. A small first till brings players back often; each bigger till buys a longer absence. Nothing ever drops to zero. |
| First absence | — | At least $1,000 after 10+ minutes away, once | The first return should pay for the kitchen or most of the Reading Room. |
| Catering orders | — | One at a time: 30 min / 2 h / 8 h, paying 0.6 / 0.4 / 0.25 of an hour's away pay per hour on top of the till; ingredients up front, terms fixed when taken | A choice on the way out, sized to when the player expects to be back. Short orders reward frequent visits; the long one covers a night. |
| Rooms | Instant | Built in real time: 1 h / 12 h / 48 h, also while away; they open at the next moment the café is closed | Money stops being a gate within a day (profit grows about 20,000× in the first 24 hours), so building time sets the route's pace, even on screen at 4×. A casual player finishes the building at the start of day 4. |
| Chain stars | ⌊√(branch earnings ÷ $50K)⌋ | One star at $50K of branch earnings, one more per doubling | Within a branch earnings grow exponentially, so any power of them let stars, and with them prices, run away: hundreds of thousands of stars (prices ×10,000+) after two weeks, which trivialises every dish. One star per doubling keeps two weeks at about 110–140 stars (prices ×12–15). |
| Branches | Start over | The café handed over pays 25% of its away pay into the till for good (outside the new branch's stars). Later branches build at 40%, then 25%, of the first café's times and can book rooms ahead | A reset should feel like the chain growing, not like losing a café, and the second café should take well under the first one's time. |
| Franchise places | — | Each place handed over in adds a chain-wide bonus (till, fruity, tea, guests, pastries); a repeat place adds a third; all five add +10% to every price | Where a branch opens becomes a real choice with a long-term payoff, and covering the map is a goal. Every profile in the run covers all five places within two weeks. |
| Star perks | — | Six perks for 3–12 stars; spent stars stop raising prices | Prestige becomes a choice between more money now and a convenience for good. |
| Background tab | — | Title shows "Order ready", "Till full" or "Till 45%" | A glance at the tab bar says when to come back. |

Constants: `src/game/manager.ts` (`AWAY_DAYS_PER_HOUR`, `TILL_HOURS`, `TILL_COSTS`, `OVERFLOW_SHARE`, `WELCOME_MIN`,
`MANAGER_UNLOCK_DAY`), `src/game/orders.ts` (`ORDERS`), `src/game/regions.ts` (`buildSeconds` per room,
`BUILD_SPEEDUP_PER_BRANCH`, `MIN_BUILD_SHARE`), `src/game/chain.ts` (`STAR_EARNINGS`, `FRANCHISE_SHARE`) and
`src/game/chain-bonuses.ts` (`PLACE_BONUS`, `REPEAT_SHARE`, `COMPLETE_BONUS`, `PERKS`).

## Known trade-offs

- **Some returns find nothing worth buying.** While the 48-hour patio is being built, money piles up: an hourly player
  finds nothing that raises earnings on about a quarter of returns, a casual player almost never once the Old Town
  franchise enlarges the till, a light player never (before, with rooms opening at once, none of them did).
  Starting the next order and picking up cat gifts still give every visit something to do, and decor and furniture,
  which the run does not buy, are the natural spending outlet.
- **The longest build is two days.** That is the patio in the first café only (19 hours in the second, 12 from the
  third on). Shorter builds are a one-line change in `REGIONS` if it feels too long in play.
