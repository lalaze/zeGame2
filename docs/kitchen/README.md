# Kitchen capacity: why pastries sold out, and the fix

Written 2026-10-21, after the table-service changes ([docs/table-service](../table-service/README.md)) let busy cafés serve far more guests.

## The problem

With table service keeping up, pastry shelves became the next limit. Scripted cafés that didn't bake extra by hand sold out of 20–87 pastry orders a day from about day 17, and even a careful script that baked more of whatever had sold out and hired cooks was back up to 54 a day by day 50. Each sold-out order loses a sale and leaves a 1★ review.

## What the measurements showed

A café grown by the careful scripted player (so table service kept up) was saved at days 15, 25 and 35, then one day was replayed with one change at a time (3 seeds each). Day 35 (3 cooks, 5 pastry dishes, about 213 pastry orders forecast):

| Variant | Guests served | Sold out | Stale | Cooks busy |
|---|---:|---:|---:|---:|
| As it was | 235 | 77 | 19 | 80% |
| Morning bake = the full day's forecast | 301 | 9 | 18 | 20% |
| Stations twice as fast | 248 | 62 | 15 | 70% |
| Batches of 10 instead of 5 | 293 | 18 | 27 | 76% |

- The suggested morning bake covered only each dish's lead time and left the rest to the cooks, while the kitchen's own estimate said it needed 1.5–2.2 times its cook capacity.
- Baking the whole forecast in the morning nearly removed sold-outs without extra waste: the forecast was accurate, and the morning bake costs no cook time.
- Faster stations hardly helped: cooks spend most of each batch walking between storage, stations and the door.
- Bigger batches helped a lot, because the walk is shared by more portions.

## The fix

- **Batches grow with the kitchen:** 5, 7 and 10 portions at its three stages.
- **The suggested morning bake knows the kitchen's limits.** While the cooks can keep up, it still only bridges until the first fresh batch. When the day's forecast is more than they can make, it covers the whole forecast. Manual plans are untouched. Compared on the same cafés at day 35, with batches already scaled: baking the full forecast gave 1 sold-out and 15 stale pastries; baking only what the cooks couldn't make gave 10 and 30; the old lead-time bake gave 12 and 32. Cooks only start a batch once a shelf runs low, so with a partial morning bake they sat idle early and fell behind later.

## Results

55 days, 5 seeds each, both scripted players following the suggested bake:

| Day | Careful: pastries sold out | Careful: stale | Greedy: pastries sold out |
|---:|---:|---:|---:|
| 10 | 4 | 9 | 4 |
| 20 | 6 | 13 | 8 |
| 30 | 1 | 28 | 3 |
| 40 | 5 | 18 | 4 |
| 50 | 10 | 21 | 21 |

Before, careful cafés sold out of 8–54 pastry orders a day (even while baking extra by hand), and greedy ones 39–110. Stale waste costs at most a few hundred dollars a day against $0.5–2.6M profit. Rooms still arrive around days 6, 12–13 and 22.

Ratings now sit around 3.2–3.4★ late in the day, set mostly by waiting times in a busy café rather than by empty shelves.
