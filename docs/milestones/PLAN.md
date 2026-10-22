# Café milestones: a second goal track (plan)

Status: implemented 2026-10-21. Verification changed several thresholds and one structural rule; see *What verification changed* at the end. The tables below show the final design.

## Why

The 15 guided goals are all done by about **day 11** in the scripted new-café run (median of 5 cafés, current pricing). After that the game gives no direction, although the building is finished only around **day 23** and income keeps growing past day 40. Story content stops early too: every regular's five chapters are unlocked by about day 20.

Café milestones carry the player from day 11 to roughly day 45. They reward running the café *well* (not just bigger), and they give the newer systems (weather days, moments, regulars' stories) a lasting purpose.

## Shape

- **Four chapters of four milestones.** Within a chapter, milestones can be done in any order. **Three milestones done in a chapter open the next one**, so a single hard milestone never stalls the track. All four complete the chapter and earn its reward. Finished chapters can be claimed in any order.
- **Milestones complete by themselves and stay complete.** A rating that later dips, or a room that fills up, never takes one back.
- **The track starts when the 15 guided goals are done.** It uses the same goal card in the panel. Existing saves that already finished the guided goals see chapter 1 straight away.
- **Rewards are mostly not cash.** Cash rewards were the main reason the mid-game used to move so fast. Each chapter gives:
  - a **café title** shown under the café name and in the milestone book;
  - a **free finish** from the existing catalog, equipped if it is more comfortable than the current one. If the player already owns it, they get its price in coins instead.
- Individual milestones have no reward of their own. Claiming happens once per chapter, with the same claim button the guided goals use. The café's title is the furthest chapter claimed.

## The milestones

"Scripted day" is the median day the careful scripted player reached it in the final 60-day check (5 seeds), with the greedy player in brackets where it differs. See *What verification changed* for both players.

### Chapter 1: Neighbourhood café (about days 11–16)

| Milestone | Threshold | Scripted day | Notes |
|---|---|---|---|
| Open the Glasshouse | room owned | 13 (12) | Growth landmark. |
| Serve guests | 1,000 in total | 13 | Lifetime `served`. |
| Practice dishes | 12 dishes at Practiced taste (30+ deliveries) | 16 (14) | Uses the existing flavor tiers. |
| A smooth day | 60+ guests served with nobody leaving disappointed | 13 (11) | No sold-out orders, no queue or table walkouts, and no orders cancelled by **Settle now**. Guests turned away by a full queue don't count. Closing normally, which finishes accepted orders, is allowed. |

Reward: title **Neighbourhood café**; finish **Hanging Vines** (`ceiling_vines`, $10,000, comfort 10).

### Chapter 2: Local favourite (about days 16–23)

| Milestone | Threshold | Scripted day | Notes |
|---|---|---|---|
| A busy day | 150 guests served in one day | 18 (17) | Day record. |
| Well reviewed | rating 4.0 or better, over at least 50 reviews | 22, 3 of 5 cafés (never) | The skill check. Needs service to keep up with arrivals. |
| Weather wise | win over one special day | 14 (13) | A rainy, hot, crisp or market day where that day's popular dishes are at least half of sales, with 40+ sold. |
| Every story told | all 12 regulars' stories complete | 19 | Chapters earned through service; reading is not required. |

Reward: title **Local favourite**; finish **Blue Rug** (`rug_blue`, $20,000, comfort 11).

### Chapter 3: Talk of the town (about days 23–32)

| Milestone | Threshold | Scripted day | Notes |
|---|---|---|---|
| Open the Garden patio | room owned | 27 (22) | The last room. |
| Signature recipes | 5 dishes researched to Signature taste | 19 | 100 deliveries plus 20× the dish's price ($150 minimum) each. |
| Little moments | 60 moments answered | 21 (19) | Counted from day 1. The scripted players answered about half of the ~6 a day at 1×. "Let them choose" doesn't count. |
| Serve guests | 3,000 in total | 27 (28) | Lifetime `served`. |

Reward: title **Talk of the town**; finish **Marble** counter (`counter_marble`, $40,000, comfort 12).

### Chapter 4: Beloved institution (about days 32–50)

| Milestone | Threshold | Scripted day | Notes |
|---|---|---|---|
| A packed day | 180 guests served in one day | 34 (26), 4 of 5 cafés | Day record. |
| A smooth rush | 150+ guests served with nobody leaving disappointed | 35 (38) | Stock, seating and service all have to keep up. |
| Weather master | win over 3 different kinds of special day | 28 | Needs dishes that suit each kind, such as iced and fruity ones for hot days. |
| A cozy café | comfort 90 | 57 (45) | Finishes and furniture both count. The careful script buys little decor while losing guests. |

Reward: title **Beloved institution**; finish **Herringbone** floor (`floor_herringbone`, $200,000, comfort 16).

### Considered and left out

- **Reading stories** as a requirement: players who skip the journal would be stuck. Stories count when earned.
- **Filling all 20 tables**: the last main-room tables cost $9.8M and $78M; the scripted café had 17–18 by day 40.
- **Adopting cats, styles, promotions and partners**: optional systems with their own goals (café styles already have three stages each). A milestone track for everyone shouldn't force them.
- **Cash per milestone**: see *Rewards* above.

## New saved data (save version 18)

```ts
milestones: {
  /** Milestone ids reached; they never un-complete. */
  done: string[];
  /** The day each was reached, so that day's report names it even if the live check marked it mid-service. */
  reachedOn: Record<string, number>;
  /** Chapter ids whose reward has been claimed, in any order. */
  claimed: ('neighbourhood' | 'favourite' | 'town' | 'institution')[];
  /** Updated when a day closes (answered moments: when answered). */
  records: { bestDay: number; bestSmoothDay: number; weatherWins: ConditionId[]; momentsAnswered: number };
}
```

- Lifetime served, rooms, flavor tiers, signature research, comfort, rating and regulars' chapters are all read from existing state. Only the four records are new.
- Older saves start with empty records and no completed milestones. No history is invented: a best day can't be recovered from an old save. Derived milestones such as rooms and lifetime guests complete on the first check.
- Parsing follows the existing pattern: unknown ids are dropped, numbers clamped, and only fully finished chapters are kept as claimed.

## Where the logic lives

- **`src/game/milestones.ts`** (new): chapter and milestone definitions, each with `progress(state) → [current, target]`. It also has `checkMilestones(state)` (marks newly reached ones and returns them), `recordDay(state, report)` (updates the three day records), `recordMomentAnswered(state)`, the current chapter, and `claimChapter(state)` (title and finish, or coins if the finish is already owned).
- **`finishDay`** (`src/game/day.ts`): calls `recordDay` and `checkMilestones` once the report is built, and adds `newMilestones` to the report. The weather record uses `dishMood` for the day just closed.
- **Moments**: each answer in `main.ts` (recommend pick, greet, tidy, photo, delivery) calls `recordMomentAnswered`. The director itself stays free of saved state.
- Purchases that can complete a milestone (rooms, finishes, research) need no special hook. The panel re-checks on its regular refresh, and the next day close records it permanently.

## Interface

- **Goal card** (panel): once the guided goals are done it shows *Chapter 2 of 4 · Local favourite*, the next unfinished milestone with a progress bar, "2 of 4 done", and an **All milestones** button. When all four are done, the claim button reads *Claim: Local favourite + Blue Rug*.
- **Milestone book** (new dialog, same modal and pause behavior as the Regulars journal):
  - The current and earlier chapters, with checkmarks and progress.
  - Titles earned so far.
  - The next chapter's name, with its milestones hidden until it opens.
  - Later, the scrapbook can become pages of this book.
- **Day report**: a line for each milestone reached that day. When a chapter is ready to claim, the report's *Next step* points to it, like an unclaimed guided goal does today.
- **Café name**: the latest title appears under the name in the header, and in Settings on narrow screens.
- **Toast** on completing a milestone mid-day. This only happens for derived ones, such as buying the Glasshouse; day records complete at closing.

All copy goes into both locales: chapter titles in Chinese 街坊咖啡馆 / 本地人气店 / 全城热议 / 老字号.

## Steps

1. `milestones.ts`, save field, parsing and the `finishDay` hook, with unit tests: each milestone's progress, sticky completion, records, old saves, claiming (including the already-owned finish).
2. Moment answer counting.
3. Goal card and milestone book, then the report lines, header title and settings.
4. Locales, README section, and the code-layout table.
5. Verification:
   - Rerun the scripted progression with two players. One is the current greedy player; the other is "mindful" and stops buying marketing while it loses more than 5% of guests.
   - Pass condition: chapters 1–3 complete for the mindful player between about day 11 and day 35, chapter 4 within 60 days, and the greedy player stalls on the skill milestones as intended. (Met after the changes below.)
   - Then a browser check of the card, book, report and claim, on desktop and phone, in English and Chinese.

## Evidence

Scripted new café, 5 seeds × 40 days, current pricing (level-ups at 10× unlock price), daily conditions on, moments off. Each day it follows the guided goals, buys the next room as soon as it can, and spends half its remaining cash on the cheapest useful upgrades. Medians:

| Day | Served | Lost | Rating | Lifetime served | Dishes practiced | Tables | Rooms | Comfort | Stories complete |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 11 | 121 | 10 | 3.73 | 817 | 10 | 7 | 1 | 22 | 4 |
| 14 | 112 | 33 | 3.18 | 1,129 | 12 | 11 | 2 | 31 | 6 |
| 17 | 137 | 56 | 3.27 | 1,518 | 14 | 12 | 2 | 37 | 10 |
| 20 | 153 | 53 | 3.37 | 1,968 | 17 | 12 | 2 | 60 | 12 |
| 23 | 127 | 117 | 3.02 | 2,410 | 19 | 17 | 3 | 60 | 12 |
| 30 | 120 | 164 | 3.07 | 3,299 | 22 | 17 | 3 | 80 | 12 |
| 40 | 119 | 160 | 3.05 | 4,620 | 26 | 18 | 3 | 88 | 12 |

Its best single day was 121 guests by day 11, 146 by day 17 and 193 by day 35. It had a day with nobody lost (at 50+ guests) only twice, both early.

## What verification changed

The first 60-day check, with the plan's original thresholds, failed badly. **3 of 5 cafés never left chapter 1**, with either player, and nobody reached 4.3★. A day-by-day breakdown showed why, and led to five changes:

1. **Opening at three of four.** Chapters originally opened only when the previous one was complete, so one hard milestone blocked everything after it. Now three done open the next chapter. Claims happen in any order, and the title is the furthest chapter claimed.
2. **"Disappointed", not "lost".** Late-game losses were almost all *door* losses: a full queue turns new arrivals away. For the careful player that meant 90–120 a day by day 40, with zero sold-out, queue or table losses. "Nobody lost" was structurally impossible. Guests turned away at the door never come in and leave no review, so a smooth day now counts only those who came in.
3. **Ratings.** In a big café the queue is always full, so most waits run past the 25 seconds that caps a review at 3★. Both players sat at 3.1–3.7★. 4.3★ and 4.6★ weren't skill tests, so one rating milestone remains, at 4.0★ (chapter 2), still out of reach for the greedy player. The planned 4.6★ capstone became a 150-guest smooth day.
4. **Weather wins instead of weather volume.** "Popular dishes sold" mostly measured how busy the café was: the greedy player, whose menu never changes, outsold the careful one. A win now needs popular dishes to be half of the day's sales, which rewards choosing the menu. Chapter 4 asks for wins on three different kinds of day.
5. **Counts that start on day 1.** Answered moments and signature recipes accumulate from the first day, so 25 moments and 2 recipes were already done before chapter 3 opened. They are now 60 and 5. Comfort 100 landed around day 49–57 and became 90.

Final check (60 days, 5 seeds; median day a chapter's four milestones were all done, with cafés that finished it in brackets):

| Player | Chapter 1 | Chapter 2 | Chapter 3 | Chapter 4 |
|---|---:|---:|---:|---:|
| Careful (adapts menu, stops advertising while losing guests) | 16 | 23 (3/5) | 27 | 58 (3/5) |
| Greedy | 14 | never (0/5, no 4.0★) | 28 | 45 (4/5) |

## Re-check after the table-service changes (2026-10-21)

Expand the Pass and the room-based server limit removed the late-game cap on guests (see [docs/table-service](../table-service/README.md)), so cafés now serve far more guests late on. A 55-day re-check, 5 seeds each:

- **Careful player** (also bakes more of what sold out and hires cooks): chapter 1 around day 16, chapter 2 around day 19 (4.0★ on day 19), chapter 4 around day 37. A 180-guest day now comes around day 25, and a 150-guest smooth day around day 25. Chapter 3 finished around day 40 in this run because it answered only about 1.5 moments a day; its other three milestones opened chapter 4 on time.
- **Greedy player:** its pastry shelves run out most days at the higher volume, so the smooth-day and rating milestones stay out of reach. Chapter 1 stops at 3 of 4, chapter 2 never completes, and chapter 3 finishes around day 40. That's the intended skill check, and the 3-of-4 rule keeps its track moving.

The thresholds are unchanged.

## Re-check after the kitchen changes (2026-10-21)

With bigger kitchen batches and a morning bake that covers the forecast when the cooks can't (see [docs/kitchen](../kitchen/README.md)), pastry sold-outs fell to a few a day. 55 days, 5 seeds each:

- **Careful player:** chapter 1 around day 23, chapter 3 around 25, chapter 4 around 37. The 4.0★ rating, which closes chapter 2, came around day 48: with empty shelves fixed, ratings of about 3.2–3.4★ are set by waiting times in a busy café.
- **Greedy player:** chapter 1 around day 14 (its smooth day is back, on day 11), chapter 3 around 26, chapter 4 around 38; never 4.0★.

The 4.0★ rating is now the slowest milestone in chapter 2. Thresholds are unchanged; if chapter 2 feels too slow in play, the rating threshold is the one to revisit.
