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

## How it works

**Opening day.** On first launch you get the keys to an empty shop and go through a short setup:
1. Pick a language.
2. Name your café. The name appears in the header, and there's a random-name button.
3. Create the owner: skin, hairstyle, hair color, apron color, and an optional name. The owner works the first spot behind the counter.
4. Pick a free starter style: Classic Cream, Mint Fresh or Rose Cottage.
5. Grand opening! Prepare the menu for day 1 and start business.

You can change the name and character later in Settings (`···` → Edit café).

**A day at the café.** Every day has three parts, and you start and end each one yourself:
1. **Plan (shop closed).** Buy ingredients in the Pantry and spend your money on upgrades and decor.
Before the kitchen is built, the café is a **drinks-only bar**: bread, pastries and the affogato and matcha float desserts cannot be unlocked, prepared or sold. Building the kitchen enables the existing recipe progression; it does not give away recipes. Older saves retain purchased food levels, menu selections, bake plans and stock, suspended until the kitchen is built.

2. **Prepare the menu.** Press **Prepare menu** to pick today's dishes and set the **morning bake** for each bread and pastry. Low opening stock is highlighted. Apply the suggested morning bake, type exact portions or adjust by five, and buy ingredients from the same dialog. Forecasts cover three minutes of game time at 1×; with a kitchen the morning batch covers its production lead time. Partial purchases list what was actually bought. Press **Start business** to open. Nothing opens without this step.
3. **Open.** The morning batch is baked first: each bread and pastry on the menu uses its ingredients for the planned amount (or as many as the pantry allows) and goes on the shelf. The shop stays open as long as you like; the corner shows how long it's been open (2× and 4× speed it up). Customers walk in and order from today's menu. Drinks are made to order and use their ingredients then; breads and pastries come off the shelf. If a drink's ingredients run out or a bread's shelf is empty, customers who order it leave unhappy.

   **Table service.** Takeaway customers wait at the counter and pay when the barista hands their order over. When a table is free, some customers stay: they order, take a seat (a numbered card goes on the table), and wait. When their order is ready the barista sets it on **the pass**, the pickup window at the end of the counter (a steel ledge and a heated shelf, three plates each, under two heat lamps), rings the bell on its header and calls for a server. A free server answers (a "!") and takes the order whose guest is closest to giving up, plus up to two more: orders for the same room first, then rooms on the way. They deliver nearest room first, walking on from room to room rather than back to the pass, and each guest pays on delivery. If nobody comes, the barista rings again; with the pass full (six plates), they hold the order and keep calling until there's room. Guests left waiting too long give up and leave without paying, and their order is wasted. When you're done, press **Close shop**: arrivals stop and unaccepted queue guests go home without counting as lost. Staff finish accepted orders and started kitchen batches, then the **settlement** pops up automatically. Speed controls still work. **Settle now** lets you discard unfinished work after a warning; consumed ingredients remain costs. Closing and live orders survive a refresh. Unsold breads and pastries go stale and are thrown away, and the settlement shows customers served and lost, revenue, ingredient cost, how much was baked and went stale, which shelves were empty at closing, profit and the best seller. It separates stock failures, queue walkouts, table-service walkouts, unavailable add-ons and arrivals turned away by a full queue. Visits of at least one game minute also show profit per minute, with advice based on observed losses.

What to spend the day's revenue on:
- **Menu tab:** 55 dishes in four categories (14 coffees, 11 teas & drinks, 15 breads, 15 pastries & cakes), each unlocking in its own order:
  - **Coffee:** espresso, americano, latte, cappuccino, flat white, cortado, mocha, Viennese coffee, caramel macchiato, cold brew, dirty coffee, pour-over, sea salt cream coffee, affogato
  - **Tea & drinks:** Earl Grey, hot chocolate, lemon black tea, chai latte, mixed fruit tea, hojicha latte, matcha latte, caramel frappé, strawberry smoothie, royal milk tea, matcha float
  - **Bread:** butter roll, sesame bagel, baguette, cheese bun, pretzel, herb focaccia, ciabatta, raisin loaf, sourdough boule, rye loaf, chocolate milk bread, milk loaf (shokupan), brioche, fruit brioche braid, garlic cheese bread
  - **Pastries & cakes:** glazed donut, raisin scone, chocolate chip cookie, croissant, pain au chocolat, chocolate brownie, cinnamon roll, blueberry muffin, vanilla cream puff, melon pan, egg tart, strawberry shortcake, strawberry Swiss roll, cheesecake, macarons

  Unlock dishes and level them up. Price milestones remain at levels 10, 25, 50, 100, …, but most of each increase now arrives gradually between milestones; existing recipe prices are never reduced by this curve. Early recipes trade margin against preparation time: espresso and rolls serve quickly, while latte, bagels and donuts take longer. Rows show ingredient cost, preparation time and the price before and after the selected upgrade quantity. Each row shows the recipe, how many servings the pantry can make, and an On/Off menu toggle (changeable while closed). Breads and pastries also have a **Bake** amount (± in steps of 5, with exact quantity entry in preparation) with a suggested morning amount next to it; **Bake for the forecast** applies the current production-aware recommendation; manual plans otherwise stay unchanged. Bake too few and the shelf sells out; bake too many and the rest goes stale. Every dish on the menu beyond the first brings 4% more customers (up to +60%), and about a third of customers pair a drink with something from the bakery (or the other way round), buying both.
- **Dish flavor:** Every unlocked dish starts with standard flavor (4.0). Deliver 30 portions to improve future portions to practiced flavor (4.5). After 100 delivered portions, research the signature recipe while closed for 5.0 flavor. Research costs 20× the dish’s base price, with a $150 minimum, once per dish. It does not change price levels, tips, preparation time or per-order payment. Menu flavor buttons show progress and open research; preparation also shows flavor. Only actual handoffs count: baking, waste, missing add-ons, cancelled orders and refreshing never grant extra practice. Each delivered combo dish progresses separately. Old saves carry over verifiable current-day dish sales; unknown historical dish sales are not inferred.
- **Customer reviews:** Each completed visit produces one review, based on flavor, time from arrival to handoff and whether the order was complete. Delivered dishes set the flavor base (combos average their actual dishes). Service within 12 / 25 / 40 game seconds caps the score at 5 / 4 / 3 stars; longer waits cap it at 2. Reviews take the lower of flavor and the service cap, rounded to one decimal. Missing add-ons cap the score at 3. A sold-out main, table walkout or cancelled accepted order earns 1 star; a queue walkout earns 2. Normal closing dismisses queued guests without reviews, and visitors turned away by a full queue do not review. The latest 50 reviews affect **arrivals only**, never prices, tips or payment per order: four stars is neutral, with traffic bounded at −25% to +25%. Before 20 reviews, neutral four-star samples soften early swings. Better service replaces old poor reviews. The always-visible review bar opens recent feedback and scoring rules; preparation forecasts include the traffic effect, and settlement shows session reviews and reasons. Ratings and in-flight review state persist through refreshes; older saves start neutral.
- **Pantry tab:** 12 ingredients: coffee beans, milk, flour, butter, eggs, sugar, tea leaves, spices & herbs, cocoa, cream & cheese, fresh fruit and matcha. Ingredients keep from day to day. **Stock for ~3 minutes** covers the forecast window and the planned morning bake, accounting for baked shelf stock and batches already in production. Food is available only after the kitchen is built.
- **Upgrades tab:** Add a Main Café Table fills the original room (2 tables to start, up to 8; a small planning marker shows the next spot), the Chalkboard Sign brings more customers, the Espresso Machine brews faster, Hire Barista adds staff behind the counter (up to 4), Hire Server adds servers to carry orders to the tables (up to 3; you start with one), and Expand Kitchen & Hire Cook grows the compact kitchen through 3 stages, adding floor space and one cook for $900, then $9,000 (up to 3 cooks; the kitchen comes with one). The card shows the current kitchen stage; existing cook upgrades already count toward it.
- **Café areas:** a continuous two-dimensional building, with Main Café and Reading Room facing the street and Garden Patio and Glasshouse behind them. Shared doors connect Main Café → right to Reading Room → rear to Glasshouse → left to Garden Patio; only the main café has a street entrance. Click the arrows at the actual doorways, or use all four keyboard arrows, to pan in that direction. The compact **Map** button in the scene corner shows a thumbnail of every room on demand. Click a room to enter it, or click Map again to return; the map takes no permanent space above the scene. Camera motion respects reduced-motion preferences. While closed, open the **Reading Room** ($1,200), then the **Glasshouse** ($18,000), then the **Garden Patio** ($240,000). Each has its own pixel architecture, adds 4 tables, and draws +10%, +15%, and +20% customers respectively. Customers buy at the main counter, walk through those same shared doors to their seats, and return through them to leave. With every extension and main-room table, the café has 20 tables. The main room has a rear production bar, separate order and pickup signs, a guest cross-aisle to the reading room, and two dining bays around a compact entrance forecourt. A six-person queue leaves its centre open; staff wait by the crockery cabinet beside pickup. Tables expand from the two starter settings outward without adding free seats or comfort. Customers and servers route around tables and placed floor furniture. Place and move furniture in any opened room; doorways and circulation stay clear. Existing saves retain progress and furniture; pieces blocking a new passage go safely into storage.
- **The kitchen:** a compact back-of-house room through a staff-only door behind the main café's bar ($800, built while closed; it comes with one cook). This service connection keeps production traffic out of the guest queue and feeds the pickup area. Expand it twice from the Upgrades tab for $900, then $9,000; each purchase adds floor space and one cook, reaching stage 3 with 3 cooks. Existing saves keep their purchases and receive the matching kitchen size without a new save field. It's laid out so every batch flows one way toward the café door: storage (walk-in cold room, dry store and ingredient bins), the hand sink, prep (spiral dough mixer, proofing cabinet and a prep bench with a dough sheeter and stand mixer), the hot line under the hood (bagel kettle, deck oven, convection oven and fryer), then out (cooling rack, pastry fridge, door), with the dish pit by the door. Equipment arrives as you unlock the dishes that need it: rolls bring the mixer and deck oven, bagels and pretzels the kettle, donuts the fryer, croissants the sheeter, cakes the stand mixer and pastry fridge. Until then its spot is marked out with the hookups capped. While the shop is open, free cooks replenish up to 5 portions per batch. Reorder levels use demand, recipe work and walking time, and the shared kitchen workload. The most urgent expected shortage goes first; cooks never duplicate a dish already in production. They fetch ingredients from the pantry, work each station in turn, and send the batch through the door into the case. The preparation dialog warns if projected demand exceeds kitchen capacity. Ingredient forecasts cover morning and later production without counting the same batch twice.
- **Furnish tab:**
  - **Decor and Furniture:** two separate catalogs with 39 pieces (plants, lamps, a bookshelf, an armchair, a cat bed, a piano, paintings, a wall clock and more) that you place wherever there's room. Buy one and tap a free spot in the café; the free cells light up and the piece shows green where it fits. **Arrange café** lets you tap any placed piece to move it or put it back in storage. Floor pieces go anywhere except the counter, the walkway from the door, the tables and the spot the next table will take (expanding the shop moves anything in the way to storage); wall pieces go either side of the menu board. Each kind adds its comfort once, however many you place. Cards show wall/floor placement and grid footprint. Decorative seats do not add service capacity; service tables remain in Upgrades. The new collection adds lavender, a succulent, daisies, two café posters, a wreath, ivy, bunting, a brass lantern, a coffee bean display, a sideboard, loveseat, stool, glass cabinet, magazine rack and coffee cart.
  - **Finishes:** seven spots: wallpaper, floor, counter, windowsill, ceiling, rug and neon sign. You buy each item once, then can switch between owned items for free.
  - Comfort raises tips by 1% per point.
- **Goals:** a checklist of 15 goals with cash rewards walks you through the loop in order. Capacity goals accept alternative investments (kitchen, tables or rooms; different staff roles), and variety counts unlocked dishes without forcing all of them onto the menu.
- **Tap the café** (or press <kbd>Space</kbd>) to help brew, at most once per game second. Successful help sparkles at the working baristas; rapid clicking gives no extra benefit. Tap the cat on the windowsill to pet it.
- **Service status:** a compact button explains sustained ingredient shortages, baking waits, counter queues or finished-order backlogs and points to the relevant management tab.
- Now and then a VIP customer with a crown shows up and pays 5×.

### Built for the workday

- **Nothing runs without you.** The shop pauses when you switch tabs or close the game and picks up exactly where it left off, still open, when you come back. Days only start and end when you say so. (The Shift Manager, who used to earn while you were away, has retired; saves that hired one get the money back.)
- The game is silent. The light follows your own clock through the day: a pale dawn, bright mornings, a golden late afternoon and a blue dusk, with sunbeams that slant and stretch as the sun crosses the sky. As it gets dark the lamps come on: ceiling lights, floor lamps and sconces you placed, the reading lamp, the patio bulbs, and the kitchen's tube lights and ovens. The garden patio and glasshouse feel the sky most; the walled rooms keep more of their own light.
- Progress saves automatically to `localStorage`, with one active saved session at a time to protect against conflicting tabs. If browser storage or Web Locks are unavailable, the game opens a clearly labeled temporary café without changing existing saves.

### Little thoughts

Customers and staff occasionally share short, localized thought clouds about what they are doing. Dine-in guests have consistent cosmetic flavor preferences, with affectionate likes and gentle dislikes after their order arrives. These thoughts never change orders, prices, tips, patience, or save data. At most two clouds appear at once; they avoid service indicators and disappear during dialogs, room transitions, the map, and furniture placement. Thought clouds add no animation.

### Neighborhood regulars

Twelve named regulars bring five short story chapters each, in English and Chinese. They use fixed pixel appearances from the existing customer cast and arrive in the ordinary queue: no extra arrivals or reward multipliers. Two become eligible on each of café days 1, 3, 5, 7, 9 and 11. A cast member returns once per shuffled 30-arrival cycle; eligibility is not a guaranteed visit that day.

Each chapter needs another successful handoff and a minimum business day (debut day, then +2, +4, +6 and +8); at most one chapter unlocks per person per day. Failed visits, reading and reopening the game do not advance a story. You never need to log in on consecutive real-world days, unlock a favorite drink, or finish someone else's story. When a preferred drink is selected, unlocked and currently supplyable, it replaces the drink slot in that regular's order; otherwise ordinary menu selection remains. Food-only orders, combo rules, stock consumption, reviews and payment formulas remain unchanged.

The quiet **Regulars** badge opens a journal of people you've actually met. Reading pauses service through the same safe dialog behavior used elsewhere. **Read later**, page navigation and closing leave a chapter unread; only **Finished reading** marks it read. Unlocked chapters can be reread. Save version 13 preserves identities, encounters, successful handoffs and separate unlocked/read progress; older saves start meeting people naturally without invented history.

Implementation plan, all 60 bilingual stories and reproducible evidence are in [docs/regular-guests](docs/regular-guests/PLAN.md).

### Languages

The game comes in English and Simplified Chinese (简体中文). It picks the language from the browser and you can change it in Settings (`···`). Chinese uses the [Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font) font (OFL 1.1). `scripts/subset-font.mjs` cuts that font down to only the characters in `src/locales/zh.json`, which brings it from 600 KB to about 12 KB. The script runs automatically before `dev` and `build`.

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
| `src/game/state.ts` | Save format, loading and validation |
| `src/render/phaser/` | The [Phaser 4](https://phaser.io) game that draws the café: game loop, camera, input, baked room textures, characters and props as sprites sorted by depth, particles and pop-up text |
| `src/render/lighting.ts` | Time-of-day lighting: keyframed sky, sun, color grade and lamp levels that every part of the scene reads from |
| `src/render/cafe-view.ts` | What the café shows, independent of Phaser: the camera between rooms, the piece being arranged, tap targets and queued effects |
| `src/render/` | Pixel sprites defined as text grids, a 3×5 bitmap font, and the canvas painters for rooms, decor and furniture (`room-art.ts`, `decor-art.ts`, `furniture-art.ts`) |
| `src/ui/` | Side panel, opening flow (`onboarding.ts`), modals |
| `src/i18n.ts`, `src/locales/` | Translations |
| `scripts/gen-icons.mjs` | Builds the app icons from a pixel map (`npm run icons`) |

Production artwork uses the generated cozy bitmap packs in `public/art/generated/`, with shared canvas adapters and code-drawn live effects. Character-grid painters in `src/render/sprites.ts` remain fallbacks. Phaser turns those canvases into textures; room layers repaint for ambient animation. The side panel, dialogs and HUD are plain HTML over the canvas. The complete current asset mapping and redraw verification are in [docs/cozy-redraw-v2](docs/cozy-redraw-v2/README.md).

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
read or write game saves. The gallery generates its ZIP, PNG atlas and JSON from the current artwork, including all 30 regular customers. Historical reference exports remain in `public/art/`. The downloaded `tiny-bean-assets.zip` includes individual
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
