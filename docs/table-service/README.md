# Table service: why big cafés turned guests away, and the fix

Written 2026-10-21.

## The problem

In the scripted progression runs, both the careful and the greedy player turned away 90–230 guests a day from about day 25. Their queue was always full, real throughput topped out around 150–230 guests a day whatever they bought, and ratings sat around 3.1–3.7★ because waits ran long. The forecast disagreed: it rated a day-30 café at 374 guests a day and forecast 280 sales, while the café served 125.

## What the measurements showed

A café grown by the scripted greedy player was saved at day 15 and day 30, then one business day was replayed with one change at a time (3 seeds each). Each simulation step recorded what every barista was doing, how full the pass was and what the servers were doing.

Day 30 café (4 baristas, 3 servers, 17 tables in four rooms):

| Variant | Served | Turned away | Baristas holding a plate | Pass full |
|---|---:|---:|---:|---:|
| As it was | 125 | 137 | 67% of their time | 87% of the time |
| +2 servers | 147 | 119 | 64% | 85% |
| Pass holds 18 plates | 182 | 85 | 49% | 72% |
| +2 servers and pass holds 18 | 211 | 19 | 16% | 32% |
| Nobody dines in | 220 | 0 | 0% | 0% |

A barista is reserved for one guest from the moment that guest leaves the line until the order is handed over. A table order goes on the pass instead, and the pass held six plates. When it was full, the barista kept the plate and couldn't take the next guest. So slow servers stalled the counter, and the full line turned arrivals away at the door. Servers were out on deliveries 97% of the time, the trips grew longer with every room, and hiring stopped at 3 servers. The counter itself was not the limit: with nobody dining in, even a day-40 café handled every arrival.

## The fix

- **Expand the Pass** (Upgrades): two levels, $12,000 then $120,000, each adding six plates (6 → 12 → 18). Further plates stack on the same six spots under the heat lamps.
- **Servers grow with the building:** two hires to begin with, and one more per opened room, up to six servers. Their waiting spots beside the pass take two staggered rows.
- **The forecast counts table service.** `serviceCapacity` is now the smaller of the counter (unchanged) and the floor:

  ```
  floor capacity = servers × plates per trip ÷ trip seconds × pass flow ÷ dine-in share
  ```

  It applies only when there are more seats than the servers can turn over (`tables × 2 ÷ 30 s`), so small cafés are unaffected. Round trips and plates per trip were measured from about 3,700 server trips, interpolated by how far the tables are (route waypoints from the main room):

  | Deepest room on the trip | Round trip | Plates per trip |
  |---|---:|---:|
  | Main room | 5.8 s | 1.96 |
  | Reading Room | 14.7 s | 2.01 |
  | Glasshouse | 21.4 s | 2.43 |
  | Garden patio | 29.0 s | 2.61 |

  Fitted on 70 measured cafés (days 10–40, 2–6 servers, all three pass sizes): a dine-in share of 0.52 at the base seating chance, scaled by café style and the day's condition, and a pass flow of 1, 1.3 and 1.7 for 6, 12 and 18 plates. The mean error against real throughput was 9%.
- **Service status:** when plates back up and the line is full, the status reads *Guests turned away* and explains that more servers or a larger pass will help, and faster brewing won't. The existing *Finished orders waiting* threshold now scales with the pass size.

## Results

A scripted careful player (hires servers and expands the pass while guests are turned away, bakes more of what sold out, hires cooks) against a greedy one that buys the cheapest useful thing. Medians of 5 seeds:

| Day | Careful: served | Careful: turned away | Careful: forecast vs handled | Greedy: turned away |
|---:|---:|---:|---|---:|
| 10 | 103 | 0% | 103 vs 105 | 0% |
| 20 | 192 | 0% | 182 vs 203 | 15% |
| 30 | 286 | 2% | 288 vs 296 | 30% |
| 40 | 334 | 1% | 310 vs 356 | 17% |
| 50 | 381 | 2% | 380 vs 415 | 3% |

Before the fix, the same cafés served about 120–130 guests a day around day 30. Rooms still arrive around days 6, 12 and 22, so the building pace is unchanged. Late income is higher (about $1.5M a day at day 40), because guests are no longer lost.

The next limit is the kitchen. At these volumes pastry shelves run out unless the morning bake and the cooks keep up, and the existing *Shelf empty* status reports it.
