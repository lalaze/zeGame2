# Tiny Bean Café ☕

A cozy pixel-art game about running a little coffee shop, one business day at a time. It runs in any browser on PC or mobile, can be installed as an app, and was made to play during work hours.


## Play

```sh
npm install
npm run dev       # http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm run build     # static site in dist/ that you can host anywhere (GitHub Pages, Netlify, …)
npm test
npm run balance   # seeded menu and clicking comparisons
npm run balance:restore   # restore checksum-verified audit JSON from tracked gzip
npm run balance:recovery  # current one-bean recovery, 30 fixed seeds per case
npm run balance:compare   # verify matched baseline/candidate experiment artifacts
```

## Fullscreen café controls

The game stage fills the browser viewport. The authored 320×240 room stays complete and proportional at an even whole number of device pixels per room pixel: exactly, when that is within 10% of the largest contain size, otherwise at the contain size with the small remainder smoothed (see [docs/art-grid](docs/art-grid/README.md)); the same live renderer shows genuine neighboring rooms in the remaining space, following the building's physical floor plan (including locked rooms in their existing locked appearance). Exterior scenery remains visible only outside actual room footprints, including below the shorter kitchen. These surrounding previews are passive; room navigation and interactions remain in the central room. It does not create extra floor space, seats or walkable areas. Opening management never resizes the room.

On desktop, the six management shortcuts stay folded into **Manage** in the bottom-right corner. Manage unfolds them just above it, and each one opens the drawer on its tab; Manage again, Escape or a click elsewhere folds them away. On phones, **Manage** opens the management overlay directly; it pauses service and shows a pause badge. Closing it removes only that overlay's pause reason, preserving speed and any other active dialog/background pause. Escape returns focus to the opener, and the mobile drawer contains keyboard focus. Each management tab retains its existing browsing state.

Furniture placement temporarily folds management away and restores the catalog when finished or cancelled. Mobile table planning likewise reveals the room, with a **Back to upgrades** button. **Overview** in the zoom controls opens the whole-building map even during the opening guide; **Back to room** returns to the selected room. Entering the overview clears any magnification, and selecting a room on the map returns to its normal view. Map and doorway navigation continue to use the existing room connections.

Regression checks: `src/ui/fullscreen-*.test.ts`, `src/ui/management-shortcuts.test.ts` and `node scripts/adjacent-overlay-qa.mjs` (installed Chrome, isolated temporary profile, authorized Tailscale preview on port 5173). The browser check writes screenshots and a structured report under `artifacts/adjacent-*`.

## How it works

**Opening day.** On first launch you get the keys to an empty shop and go through a short setup:
1. Pick a language.
2. Name your café. The name appears in the header, and there's a random-name button.
3. Create the owner: skin, hairstyle, hair color, apron color, and an optional name. The owner works the first spot behind the counter.
4. Pick a free starter style: Classic Cream, Mint Fresh or Rose Cottage.
5. Follow the first-day opening walkthrough: check the free starter beans, confirm Espresso on the menu, then explicitly start day 1. The shop stays closed until the final confirmation.

Opening instructions are expanded by default. Leaving the walkthrough keeps the café closed; the guide resumes from the confirmed stock step. Experienced players can open the full preparation panel or skip the guide. Once open, the guide explains automatic service and the voluntary closing step.

You can change the name and character later in Settings (`···` → Edit café).

**A day at the café.** Every day has three parts; you open the café and can close early:
1. **Plan (shop closed).** Buy ingredients in the Pantry and spend your money on upgrades and decor.
Before the kitchen is built, the café is a **drinks-only bar**: bread, pastries and the affogato and matcha float desserts cannot be unlocked, prepared or sold. Building the kitchen enables the existing recipe progression; it does not give away recipes. Older saves retain purchased food levels, menu selections, bake plans and stock, suspended until the kitchen is built.

2. **Prepare the menu.** Press **Prepare menu** to pick today's dishes and set the **morning bake** for each bread and pastry. Low opening stock is highlighted. Apply the suggested morning bake, type exact portions or adjust by five, and buy ingredients from the same dialog. Forecasts cover the 12-hour business day; with a kitchen the morning batch covers its production lead time. When the day's forecast is more than the cooks can make (the dialog warns about this), the suggested morning bake covers the whole forecast instead: baking ahead costs no cook time, and in testing it nearly removed sold-out pastries without adding waste. Partial purchases list what was actually bought. Press **Start business** to open. Nothing opens without this step.
3. **Open.** The morning batch is baked first: each bread and pastry on the menu uses its ingredients for the planned amount (or as many as the pantry allows) and goes on the shelf. Each day opens at 08:00 and closes at 20:00: 12 game hours simulated over three minutes at 1× (90 seconds at 2×, 45 seconds at 4×). The HUD, wall clock, window lighting and settlement duration share this clock. The shop stays open while today’s menu has supply and business hours remain; the corner shows how long it's been open (2× and 4× speed it up). When every menu item is sold out and the kitchen cannot replenish any of them, arrivals stop automatically, accepted orders finish, and settlement opens. Shelf stock, drink ingredients and bakery batches in progress all count as supply. Customers walk in and order from today's menu. Drinks are made to order and use their ingredients then; breads and pastries come off the shelf. If a drink's ingredients run out or a bread's shelf is empty, customers who order it leave unhappy.

   **Table service.** Takeaway customers wait at the counter and pay when the barista hands their order over. When a table is free, some customers stay: they order, take a seat (a numbered card goes on the table), and wait. When their order is ready the barista sets it on **the pass**, the pickup window at the end of the counter (a steel ledge and a heated shelf, three plates each, under two heat lamps), rings the bell on its header and calls for a server. A free server answers (a "!") and takes the order whose guest is closest to giving up, plus up to two more: orders for the same room first, then rooms on the way. They deliver nearest room first, walking on from room to room rather than back to the pass, and each guest pays on delivery. If nobody comes, the barista rings again; with the pass full (six plates, or 12 and 18 with **Expand the Pass**), they hold the order and keep calling until there's room. A barista holding a plate can't take the next guest, so when servers fall behind, the counter stalls and a full line turns new guests away at the door. Guests left waiting too long give up and leave without paying, and their order is wasted. When you're done, press **Close shop** and confirm (it shows how much business time is left): arrivals stop and unaccepted queue guests go home without counting as lost. Staff finish accepted orders and started kitchen batches, then the **settlement** pops up automatically. Speed controls still work. **Settle now** lets you discard unfinished work after a warning; consumed ingredients remain costs. Closing and live orders survive a refresh. Unsold breads and pastries go stale and are thrown away, and the settlement shows customers served and lost, revenue, ingredient cost, how much was baked and went stale, which shelves were empty at closing, profit and the best seller. It separates stock failures, queue walkouts, table-service walkouts, unavailable add-ons and arrivals turned away by a full queue. Visits of at least one game minute also show profit per minute, with advice based on observed losses. A bakery dish that both sold out and went stale gets timing advice rather than a smaller batch.

What to spend the day's revenue on:
- **Menu tab:** 55 dishes in four categories (14 coffees, 11 teas & drinks, 15 breads, 15 pastries & cakes), each unlocking in its own order:
  - **Coffee:** espresso, americano, latte, cappuccino, flat white, cortado, mocha, Viennese coffee, caramel macchiato, cold brew, dirty coffee, pour-over, sea salt cream coffee, affogato
  - **Tea & drinks:** Earl Grey, hot chocolate, lemon black tea, chai latte, mixed fruit tea, hojicha latte, matcha latte, caramel frappé, strawberry smoothie, royal milk tea, matcha float
  - **Bread:** butter roll, sesame bagel, baguette, cheese bun, pretzel, herb focaccia, ciabatta, raisin loaf, sourdough boule, rye loaf, chocolate milk bread, milk loaf (shokupan), brioche, fruit brioche braid, garlic cheese bread
  - **Pastries & cakes:** glazed donut, raisin scone, chocolate chip cookie, croissant, pain au chocolat, chocolate brownie, cinnamon roll, blueberry muffin, vanilla cream puff, melon pan, egg tart, strawberry shortcake, strawberry Swiss roll, cheesecake, macarons

  Unlock dishes and level them up. Price milestones remain at levels 10, 25, 50, 100, …, but most of each increase now arrives gradually between milestones; existing recipe prices are never reduced by this curve. Unlocking a dish costs its listed price; every level after that costs ten times as much, rising 12% per level. Each level raises the dish's price by a whole base price, so cheaper level-ups paid for themselves within a few servings: a scripted new café owned the whole building by day 10. At ten times the price it takes about 23 days with the guided goals, and about 34 without their rewards. Dishes already levelled keep their prices. Early recipes trade margin against preparation time: espresso and rolls serve quickly, while latte, bagels and donuts take longer. Rows show ingredient cost, preparation time and the price before and after the selected upgrade quantity. Each row shows the recipe, how many servings the pantry can make, and an On/Off menu toggle (changeable while closed). Breads and pastries also have a **Bake** amount (± in steps of 5, with exact quantity entry in preparation) with a suggested morning amount next to it; **Bake for the forecast** applies the current production-aware recommendation; manual plans otherwise stay unchanged. Bake too few and the shelf sells out; bake too many and the rest goes stale. Every dish on the menu beyond the first brings 4% more customers (up to +60%), and about a third of customers pair a drink with something from the bakery (or the other way round), buying both. Guests pick their main dish evenly (unless the day's condition favors some), so the Menu tab and Prepare show the average dish price, and a dish that would lower it (a new Lv1 dish next to a levelled one) says so before you add it.
- **Dish flavor:** Every unlocked dish starts with standard flavor (4.0). Deliver 30 portions to improve future portions to practiced flavor (4.5). After 100 delivered portions, research the signature recipe while closed for 5.0 flavor. Research costs 20× the dish’s base price, with a $150 minimum, once per dish. It does not change price levels, tips, preparation time or per-order payment. Menu flavor buttons show progress and open research; preparation also shows flavor. Only actual handoffs count: baking, waste, missing add-ons, cancelled orders and refreshing never grant extra practice. Each delivered combo dish progresses separately. Old saves carry over verifiable current-day dish sales; unknown historical dish sales are not inferred.
- **Customer reviews:** Each completed visit produces one review, based on flavor, time from arrival to handoff and whether the order was complete. Delivered dishes set the flavor base (combos average their actual dishes). Service within 12 / 25 / 40 game seconds caps the score at 5 / 4 / 3 stars; longer waits cap it at 2. Reviews take the lower of flavor and the service cap, rounded to one decimal. Missing add-ons cap the score at 3. A sold-out main, table walkout or cancelled accepted order earns 1 star; a queue walkout earns 2. Normal closing dismisses queued guests without reviews, and visitors turned away by a full queue do not review. The latest 50 reviews affect **arrivals only**, never prices, tips or payment per order: four stars is neutral, with traffic bounded at −25% to +25%. Before 20 reviews, neutral four-star samples soften early swings. Better service replaces old poor reviews. The always-visible review bar opens recent feedback and scoring rules; preparation forecasts include the traffic effect, and settlement shows session reviews and reasons. Ratings and in-flight review state persist through refreshes; older saves start neutral.
- **Pantry tab:** 12 ingredients: coffee beans, milk, flour, butter, eggs, sugar, tea leaves, spices & herbs, cocoa, cream & cheese, fresh fruit and matcha. Ingredients keep from day to day. **Stock for the day** covers the forecast window and the planned morning bake, accounting for baked shelf stock and batches already in production. Food is available only after the kitchen is built.
- **Upgrades tab:** Add a Main Café Table fills the original room (2 tables to start, up to 8; a small planning marker shows the next spot), the Chalkboard Sign brings more customers, the Espresso Machine brews faster, Hire Barista adds staff behind the counter (up to 4), Hire Server adds servers to carry orders to the tables (you start with one and can hire up to 3; each opened room allows one more, up to 6), Expand the Pass makes room for 6 more finished table orders ($12,000, then $120,000; up to 18 plates), and Expand Kitchen & Hire Cook grows the compact kitchen through 3 stages, adding floor space and one cook for $900, then $9,000 (up to 3 cooks; the kitchen comes with one). The card shows the current kitchen stage; existing cook upgrades already count toward it.
- **Café areas:** a continuous two-dimensional building, with Main Café and Reading Room facing the street and Garden Patio and Glasshouse behind them. Shared doors connect Main Café → right to Reading Room → rear to Glasshouse → left to Garden Patio; only the main café has a street entrance. Click the arrows at the actual doorways, or use all four keyboard arrows, to pan in that direction. The compact **Map** button in the scene corner shows a thumbnail of every room on demand. Click a room to enter it, or click Map again to return; the map takes no permanent space above the scene. Camera motion respects reduced-motion preferences. While closed, open the **Reading Room** ($1,200), then the **Glasshouse** ($18,000), then the **Garden Patio** ($240,000). Each has its own pixel architecture, adds 4 tables, and draws +10%, +15%, and +20% customers respectively. Customers buy at the main counter, walk through those same shared doors to their seats, and return through them to leave. With every extension and main-room table, the café has 20 tables. The main room has a rear production bar, separate order and pickup signs, a guest cross-aisle to the reading room, and two dining bays around a compact entrance forecourt. A six-person queue leaves its centre open; staff wait by the crockery cabinet beside pickup. Tables expand from the two starter settings outward without adding free seats or comfort. Customers and servers route around tables and placed floor furniture. Place and move furniture in any opened room; doorways and circulation stay clear. Existing saves retain progress and furniture; pieces blocking a new passage go safely into storage.
- **The kitchen:** a compact back-of-house room through a staff-only door behind the main café's bar ($800, built while closed; it comes with one cook). This service connection keeps production traffic out of the guest queue and feeds the pickup area. Expand it twice from the Upgrades tab for $900, then $9,000; each purchase adds floor space and one cook, reaching stage 3 with 3 cooks. Existing saves keep their purchases and receive the matching kitchen size without a new save field. It's laid out so every batch flows one way toward the café door: storage (walk-in cold room, dry store and ingredient bins), the hand sink, prep (spiral dough mixer, proofing cabinet and a prep bench with a dough sheeter and stand mixer), the hot line under the hood (bagel kettle, deck oven, convection oven and fryer), then out (cooling rack, pastry fridge, door), with the dish pit by the door. Equipment arrives as you unlock the dishes that need it: rolls bring the mixer and deck oven, bagels and pretzels the kettle, donuts the fryer, croissants the sheeter, cakes the stand mixer and pastry fridge. Until then its spot is marked out with the hookups capped. While the shop is open, free cooks replenish up to 5 portions per batch, 7 after the first expansion and 10 after the second: a bigger kitchen means bigger trays, so the walk from storage to the door is shared by more portions. Reorder levels use demand, recipe work and walking time, and the shared kitchen workload. The most urgent expected shortage goes first; cooks never duplicate a dish already in production. They fetch ingredients from the pantry, work each station in turn, and send the batch through the door into the case. The preparation dialog warns if projected demand exceeds kitchen capacity. Ingredient forecasts cover morning and later production without counting the same batch twice.
- **Furnish tab:**
  - **Decor and Furniture:** two separate catalogs with 39 pieces (plants, lamps, a bookshelf, an armchair, a cat bed, a piano, paintings, a wall clock and more) that you place wherever there's room. Buy one and tap a free spot in the café; the free cells light up and the piece shows green where it fits; tapping the spot reserved for the next table says so. **Arrange café** lets you tap any placed piece to move it or put it back in storage. Floor pieces go anywhere except the counter, the walkway from the door, the tables and the spot the next table will take (expanding the shop moves anything in the way to storage); wall pieces go either side of the menu board. Each kind adds its comfort once, however many you place. Cards show wall/floor placement and grid footprint. Decorative seats do not add service capacity; service tables remain in Upgrades. The new collection adds lavender, a succulent, daisies, two café posters, a wreath, ivy, bunting, a brass lantern, a coffee bean display, a sideboard, loveseat, stool, glass cabinet, magazine rack and coffee cart.
  - **Finishes:** seven spots: wallpaper, floor, counter, windowsill, ceiling, rug and neon sign. You buy each item once, then can switch between owned items for free.
  - Comfort raises tips by 1% per point.
- **Goals:** a checklist of 15 goals with cash rewards walks you through the loop in order. Once they're done, the same card follows the café milestones (below). Capacity goals accept alternative investments (kitchen, tables or rooms; different staff roles), and variety counts unlocked dishes without forcing all of them onto the menu.
- **Tap the café** (or press <kbd>Space</kbd>) to help brew, at most once per game second. Successful help sparkles at the working baristas; rapid clicking gives no extra benefit. Tap the cat on the windowsill to pet it.
- **Service status:** a compact button explains sustained ingredient shortages, baking waits, counter queues or finished-order backlogs and points to the relevant management tab. When plates back up and the line is full, it says guests are being turned away, and that more servers or a larger pass will help (faster brewing won't).
- **Forecasts count table service.** Preparation forecasts, suggested bakes and restock quotes include how many plates your servers can carry from the pass: more servers and a larger pass raise it, and tables in farther rooms lower it. A busy café no longer forecasts guests its floor staff can't serve. Measurements and calibration are in [docs/table-service](docs/table-service/README.md).
- Now and then a VIP customer with a crown shows up and pays 5×.

### Built for the workday

- **Nothing runs without you.** The shop pauses when you switch tabs or close the game and picks up exactly where it left off, still open, when you come back. Days start when you open and close automatically at 20:00 or when fully sold out; you can also close early. (The Shift Manager, who used to earn while you were away, has retired; saves that hired one get the money back.)
- The game is silent. Windows, wall clocks and lighting follow the business day: each opening starts at 08:00, moving through bright mornings, golden afternoon and blue dusk to 20:00 over 12 game hours (three minutes at 1×). Speed controls also speed up the daylight; pauses and reloads preserve it. The clock holds at 20:00 while accepted orders finish before settlement; the next day's preparation starts a new morning. Sunbeams slant and stretch as the sun crosses the sky. As it gets dark the lamps come on: ceiling lights, floor lamps and sconces you placed, the reading lamp, the patio bulbs, and the kitchen's tube lights and ovens. The garden patio and glasshouse feel the sky most; the walled rooms keep more of their own light.
- Progress saves automatically to `localStorage`, with one active saved session at a time to protect against conflicting tabs. If browser storage or Web Locks are unavailable, the game opens a clearly labeled temporary café without changing existing saves.

### Little thoughts

Customers and staff occasionally share short, localized thought clouds about what they are doing. Dine-in guests have consistent cosmetic flavor preferences, with affectionate likes and gentle dislikes after their order arrives. These thoughts never change orders, prices, tips, patience, or save data. At most one compact cloud appears at once, for up to 3.6 seconds; they avoid service indicators and disappear during dialogs, room transitions, the map, and furniture placement. Thought clouds add no animation. A guest's reply to one of the little moments below speaks at once and stays up for 5 seconds.

### Café milestones

When the 15 guided goals are done (usually around day 11), the goal card moves on to a second track: four chapters of four milestones, running to about day 45. Milestones complete by themselves, and stay complete even if, say, the rating dips later. Three milestones done in a chapter open the next chapter, so a single hard one never stalls the track. All four earn that chapter's reward, claimed from the goal card: a café title shown under the café name, and a free finish (equipped if it's more comfortable than the current one, or paid out at its price if you already own it). **All milestones** opens the milestone book. It shows every open chapter with its progress, the titles earned so far, and the name of the next chapter.

| Chapter | Milestones | Reward |
| --- | --- | --- |
| 1 · Neighbourhood café | Open the Glasshouse · serve 1,000 guests in total · 12 dishes at Practiced taste · a 60-guest day with nobody leaving disappointed | Hanging Vines |
| 2 · Local favourite | A 150-guest day · a 4.0★ rating (over 50 reviews) · win over a special day · every regular's whole story | Blue Rug |
| 3 · Talk of the town | Open the Garden patio · 5 Signature recipes · answer 60 little moments · serve 3,000 guests in total | Marble counter |
| 4 · Beloved institution | A 180-guest day · a 150-guest day with nobody leaving disappointed · win over 3 kinds of special day · 90 comfort | Herringbone floor |

A disappointed guest is one who came in and left without their order: it sold out, they gave up in the queue or at a table, or **Settle now** cancelled it. Guests turned away by a full queue never came in, so they don't count. You win over a special day (rain, heat, a crisp morning or market day) when that day's popular dishes make up at least half of your sales, with 40 or more sold. Regulars' stories count once their chapters are earned, read or not. Best days, special days won and answered moments are saved from the start, so they count as soon as their chapter opens. The day's report lists every milestone reached that day, including any completed during service or preparation, and points to a reward waiting to be claimed. Save version 18 stores the track. Older saves start with no records, rather than invented ones.

In a 60-day check with two scripted new cafés (5 seeds each), a careful player that adapts the menu to the weather and stops advertising while it loses guests finished the chapters around days 16, 23, 27 and 58. A greedy player that never adapts finished around days 14, 28 and 45, but never earned the 4.0★ rating, so chapter 2 stayed unclaimed. After the table-service and kitchen changes, cafés serve far more guests late on and rarely run out of pastries. In the latest 55-day check, a careful player finished chapters 1, 3 and 4 around days 23, 25 and 37; the 4.0★ rating, now limited mostly by waiting times in a busy café, came around day 48. A greedy player finished chapters 1, 3 and 4 around days 14, 26 and 38, and never reached 4.0★. Plan, thresholds and evidence are in [docs/milestones](docs/milestones/PLAN.md).

### Daily conditions

From day 3, every business day has a condition. It appears in a card at the top of the menu preparation, next to the day number on the clock, and a day ahead at the end of the day's report so you can stock up. Each café gets its own sequence, worked out from its creation time and the day number: reloading never changes it, and the same condition never lasts three days running. About two days in five are fair, and a fair day changes nothing.

| Condition | Chance | Effect |
| --- | --- | --- |
| Fair weather | 40% | None. |
| Rainy day | 15% | Tea, chocolate and milky dishes are popular; iced drinks less so. 10% more guests while the menu has something popular, and more of them stay at a table. Grey skies, rain on the windows, lamps on early. |
| Hot day | 12% | Iced and fruity dishes are popular; chocolate and spiced ones less so. 10% more guests while the menu has something popular. Brighter, warmer light. |
| Crisp morning | 13% | Spiced and toasty dishes are popular; iced drinks less so. 10% more guests while the menu has something popular. Cooler, clearer light. |
| Market day | 10% | 20% more guests, and most of them take their order away. Bread and pastries are popular. |
| Quiet day | 10% | 15% fewer guests, but they wait 15 seconds longer and stay at a table more often. |

Guests pick a popular dish 1.6 times as often as an ordinary one, and a less popular one 0.6 times as often. If a dish counts as both, less popular wins: an iced frappé is still iced on a rainy day. Popularity uses the same flavor notes as guests' thoughts and the recommendation moment, and the preparation list tags each dish. The arrivals forecast, suggested bakes, restock quote, kitchen planning and the simulation all use the same numbers. Arriving guests mention the day in their thoughts.

### Little moments

Every 20–40 real seconds of open service, something small may happen in the room you're looking at. Because the gap is measured in real time, higher speeds don't bring more of them. A slip with an icon bobs above it: tap it, or press <kbd>Enter</kbd>, to answer. If you ignore it, it fades after 14 seconds and changes nothing. Moments never start while the game is paused, while the map is open, or in a room you can't see, and each guest is asked at most once per visit. A short hint explains each kind the first time it appears.

- **"What would you recommend?"** A guest in line says what they're in the mood for. You pick one of two of today's dishes, of the same kind as their order: one they'd love and one they wouldn't, each shown with the flavor notes behind guests' thoughts. They order your pick and add 50% to the bill for a perfect match, 15% for a fair one, nothing for a miss. **Let them choose** keeps their own order.
- **A regular waves.** Wave back and they say a line about the story they're living right now: the chapter they'll tell next in the Regulars journal, or the last one once their story is done. They wait 8 seconds longer and tip 20%.
- **The cat knocks over a cup.** Tidy up, and a guest who saw it all tips half the price of an average dish. The culprit (a resident cat, or the visiting windowsill cat) still gets a fuss.
- **A guest wants a photo.** Take a seated guest's picture and they tip three-quarters of an average dish.
- **A delivery arrives.** Up to two parcels a day appear inside the front door. Signing for one adds the ingredients for 3–12 servings of one of today's dishes to the pantry.

Tips and rewards count toward today's revenue. Moments use their own random numbers and only the player's answers change the café: unanswered, the simulation, balance audits and seeded tests run exactly as before. A cue is never saved; an answered tip already on a guest's bill is saved with that visit.

### Café cast and team

The café has 36 rotating guest appearances and 15 recruitable staff, five in each role. The newest six guests include a silver-haired knitter, a beret-wearing sketcher and a raincoat-wearing visitor with braids. Six reserve partners—Qinghe, Amber, Xiaoman, Holly, Chestnut and Bailu—each have a distinct look and three bilingual work stories. Recruit and assign them from **Team** while closed; recruiting changes who can fill a purchased slot, not the number of slots. Existing saves keep their original staff and guest IDs. Artwork, prompts and build instructions are in [the cast expansion notes](assets/generated/neighborhood-cast-v1/README.md).

### Neighborhood regulars

Twelve named regulars bring five short story chapters each, in English and Chinese. They use fixed pixel appearances from the existing customer cast and arrive in the ordinary queue: no extra arrivals or reward multipliers. Two become eligible on each of café days 1, 3, 5, 7, 9 and 11. A cast member returns once per shuffled 36-arrival cycle; eligibility is not a guaranteed visit that day.

Each chapter needs another successful handoff and a minimum business day (debut day, then +2, +4, +6 and +8); at most one chapter unlocks per person per day. Failed visits, reading and reopening the game do not advance a story. You never need to log in on consecutive real-world days, unlock a favorite drink, or finish someone else's story. When a preferred drink is selected, unlocked and currently supplyable, it replaces the drink slot in that regular's order; otherwise ordinary menu selection remains. Food-only orders, combo rules, stock consumption, reviews and payment formulas remain unchanged.

The quiet **Regulars** badge opens a journal of people you've actually met. Reading pauses service through the same safe dialog behavior used elsewhere. **Read later**, page navigation and closing leave a chapter unread; only **Finished reading** marks it read. Unlocked chapters can be reread. Save version 13 preserves identities, encounters, successful handoffs and separate unlocked/read progress; older saves start meeting people naturally without invented history.

Implementation plan, all 60 bilingual stories and reproducible evidence are in [docs/regular-guests](docs/regular-guests/PLAN.md).

### Languages

The game comes in English and Simplified Chinese (简体中文). It picks the language from the browser and you can change it in Settings (`···`). Chinese uses the [Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font) font (OFL 1.1). `scripts/subset-font.mjs` cuts that font down to only the characters in `src/locales/zh.json`, which brings it from 600 KB to about 12 KB. It also writes `src/assets/pixel-digits.woff2`: Fusion Pixel's ten digits, given a pixel of space on each side, which English text uses because Pixelify Sans draws 5 almost like S (`scripts/pixel-digits.mjs`). The script runs automatically before `dev` and `build`.

To add or change text, edit `src/locales/en.json` and `src/locales/zh.json`. The build won't compile if a Chinese key is missing, and a test checks that the placeholders match.

## Code layout

| Path | What's there |
| --- | --- |
| `src/game/regions.ts`, `src/render/region-art.ts`, `src/ui/regions.ts` | Floor plan, shared-door connections, unlock rules and stable seat indices; room art; floor-plan overview and opening cards |
| `src/game/data.ts` | Menu items, upgrades, balance constants |
| `src/game/decor.ts`, `src/game/furniture.ts`, `src/game/goals.ts` | Room styles and comfort; placeable furniture and its grid; the guided goals |
| `src/game/economy.ts` | Prices, costs, bulk buying, today's menu, pantry and restocking, income and away earnings (pure functions) |
| `src/game/day.ts` | Opening checks, the shop clock, and closing a day into its report |
| `src/game/sim.ts`, `src/game/sim-snapshot.ts`, `src/game/operations.ts` | Customer/staff simulation, validated live-service snapshots and sustained bottleneck feedback |
| `src/game/moments.ts`, `src/game/flavors.ts`, `src/ui/moments.ts` | Optional service moments, guests' lasting tastes and dish flavor notes, the recommendation dialog |
| `src/game/economy.ts` (`tableServiceCapacity`, `passCapacity`, `upgradeMax`), `src/game/operations.ts` | Table-service capacity in the forecast, the pass size and room-based server limit; service status, including guests turned away |
| `src/game/milestones.ts`, `src/ui/milestones.ts` | Café milestones: chapters, day records, sticky completion and chapter rewards; the goal card and milestone book |
| `src/game/conditions.ts`, `src/ui/conditions.ts`, `src/render/weather-art.ts` | Daily conditions and their effects on demand, the preparation card and report preview, rain on the windows |
| `src/game/state.ts` | Save format, loading and validation |
| `src/render/phaser/` | The [Phaser 4](https://phaser.io) game that draws the café: game loop, camera, input, baked room textures, characters and props as sprites sorted by depth, particles and pop-up text |
| `src/render/lighting.ts` | Time-of-day lighting: keyframed sky, sun, color grade and lamp levels that every part of the scene reads from |
| `src/render/cafe-view.ts` | What the café shows, independent of Phaser: the camera between rooms, the piece being arranged, tap targets and queued effects |
| `src/render/` | Pixel sprites defined as text grids, a 3×5 bitmap font, and the canvas painters for rooms, decor and furniture (`room-art.ts`, `decor-art.ts`, `furniture-art.ts`) |
| `src/ui/` | Side panel, opening flow (`onboarding.ts`), modals |
| `src/i18n.ts`, `src/locales/` | Translations |
| `scripts/gen-icons.mjs` | Builds the app icons from a pixel map (`npm run icons`) |

Production artwork uses the generated cozy bitmap packs in `public/art/generated/`, with shared canvas adapters and code-drawn live effects. Everything in the world is drawn on one art grid of two art pixels per room pixel; finer legacy sprites are resampled onto it, and new world art is authored natively at that size on the master palette ([docs/art-grid](docs/art-grid/README.md)). Character-grid painters in `src/render/sprites.ts` remain fallbacks. Phaser turns those canvases into textures; room layers repaint for ambient animation. The side panel, dialogs and HUD are plain HTML over the canvas. The complete current asset mapping and redraw verification are in [docs/cozy-redraw-v2](docs/cozy-redraw-v2/README.md).

### Artwork and exports

The café uses a unified cozy pixel-art collection with a shared upper-left light direction,
warm wood, ivory ceramics, sage accents and brass fittings. Menu dishes have
3×-density artwork with fine material-edge highlights; in-world sprites retain
their original dimensions. Window reflections, fading pane-shaped sunbeams,
subtle daylight dust, layered contact shadows and brushed kitchen steel add depth.
Indoor night lighting preserves legibility. Added dust animation respects reduced motion.

Open `sprite-preview.html` on the development or built site for the asset gallery.
It uses the same painters as the game, with category filters, light/dark preview,
individual PNG downloads, a transparent atlas and its frame manifest. It does not
read or write game saves. The gallery generates its ZIP, PNG atlas and JSON from the current artwork, including all 36 customer appearances and 15 named staff. Historical reference exports remain in `public/art/`. The downloaded `tiny-bean-assets.zip` includes individual
PNGs, the atlas, coordinates and backgrounds: 980 sprite frames
(including all 55 dishes, 168 cat frames and the complete 30-customer cast) and five room backgrounds.
Character exports also show one sample appearance per role; the game still generates all player appearances.
Room exports contain background layers only; movable furniture and characters
are separate. After changing artwork, re-export the atlas, JSON and room PNGs
from the gallery to refresh these copies. Atlas coordinates use physical pixels;
`sourceSize` and `scale` describe each source canvas and its integer export scale.

## Café cats

The Cats tab offers a catalog of 12 breeds and coats, filtered into domestic
coats, shorthairs and longhairs. Select a portrait to compare its details, then
adopt explicitly; browsing does not spend coins. My cats shows adopted residents
and their care controls. Choose any three distinct kinds while closed. The limit
is enforced in both purchases and save parsing; existing cats and supplies remain.

Choices include ginger, tuxedo, calico, tabby, black, white, British Shorthair,
American Shorthair, Siamese, Ragdoll, Persian and Maine Coon. Adoption costs
300–2,400 coins including an initial care pack. Individual traffic bonuses range
from +8% to +16%, adding up to at most +48% for three cats, then multiplying with
reputation and existing demand factors. Cats do not change prices, tips, ratings
or capacity, so extra traffic needs enough service and stock. All 12 kinds have
distinct pixel portraits and four scene animation frames.

Care packs cost 8–20 coins depending on the cat and last 180 seconds of open game
time, following the speed setting. Store up to ten packs per cat. Auto-refill is
on by default and can be switched off individually. No care is consumed in prep,
closing or offline. Empty supplies make a cat rest and suspend its bonus; manual
refill, or auto-refill once affordable, restores it. There is no debt or pet loss.
Refills deduct cash immediately; daily profit subtracts only the care consumed,
like ingredient costs. Unused supplies carry over. Adoption's remaining cost is
a capital purchase and is not charged again in daily profit.

Save version 11 persists residents, care, auto-refill preferences and today's care
expense. Older saves have no paid residents; the original visiting window cat
remains decorative and free until adoption. Residents use their selected breed or coat
sprites and can be petted in the scene.

## Creator promotion

The Promote tab books creators on 豆音 (Douyin) and 小红薯 (Xiaohongshu). Douyin (豆音) offers
180-second bursts: a local video costs 60 coins for +50% arrivals, and a popular
creator costs 180 for +100%. 小红薯 offers 360-second lifestyle features:
50 coins for +25%, or 150 for +60%. Bonuses multiply with existing demand, cats
and reputation; they do not alter prices, tips, flavor or ratings directly.

Only one booking can exist at a time, including while paused. Book in preparation
or during service, pay the full fee once, and optionally pause/resume. Airtime
runs only while open at the selected game speed; prep, closing and offline time
consume nothing. Unused time carries across days. Campaigns expire without
renewal, stacking or refunds. Daily reports subtract the cost of airtime delivered
that day from profit, without deducting cash a second time. Save version 12
persists remaining time, pause state and today's promotion expense; older saves
start without a campaign or charges.

Package cards compare arrival rates with estimated counter capacity and flag
stockouts and overload risks. This estimate excludes seating and delivery
bottlenecks. More visits can exhaust supplies, lengthen queues and cause bad
reviews through the existing service rules; there is no random promotion penalty.
Stock forecasts account for only the remaining campaign time within the forecast
window and retain the existing service-capacity limit. Traffic is not guaranteed
sales or profit. Integration tests cover real extra visits and resulting stockout
reviews, alongside booking, expiry, pause, settlement and save behavior.


## Reproducible economic audit

The fixed-seed audit, raw evidence, recovery constraints and exact reproduction commands are in [docs/long-task](docs/long-task/README.md). It separates operating profit from purchase cash flow, charges recipe/kitchen/cat capital, values unused inventory and prepaid care/promotion, and records unrecovered investment as censored. Long experiments are opt-in; ordinary `npm test` includes fast economic-invariant and runner-design tests.

Cash-constrained forecast restocking now avoids buying unusable fragments when an affordable complete selected recipe is available. If no complete recipe can be funded, it preserves the available cash. Existing ready shelf or paid in-production stock retains the normal proportional restocking path. Ingredient purchases reject invalid quantities, and bakery completion cannot create stock without an already-paid batch. These safeguards do not alter menu prices, cat/promotion bonuses or progression milestones.

Historical strict equal-total-simulation-time supplement: `balance:fixed-clock` ran30 fixed seeds per representative route for exactly1800 seconds each, including closing time. Reproduce older generators only in a disposable copy using the source instructions in `docs/long-task/README.md`; do not overwrite restored historical evidence. See `docs/long-task/FIXED-CLOCK.md`; the larger original matrix equalizes open windows instead.

One-bean emergency recovery is available from preparation only when normal stock, buying and reward paths cannot help. Run `npm run balance:recovery` for 30-seed exact-clock rescue and unaffected-normal-play comparisons; see `docs/long-task/EMERGENCY-RECOVERY.md` and `RECOVERY-DECISION.md`.

Audit data is committed losslessly compressed; run `npm run balance:restore` before replay/comparison commands. Checksums and details: `docs/long-task/COMPRESSED-EVIDENCE.json`.
