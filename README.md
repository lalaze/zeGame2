# Tiny Bean Café ☕

A cozy pixel-art game about running a little coffee shop, one business day at a time. It runs in any browser on PC or mobile, can be installed as an app, and was made to play during work hours.

## Play

```sh
npm install
npm run dev       # http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm run build     # static site in dist/ that you can host anywhere (GitHub Pages, Netlify, …)
npm test
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
2. **Prepare the menu.** Press **Prepare menu** to pick today's dishes and set the **morning bake** for each bread and pastry. Dishes that won't last half a day are highlighted, and you can stock up right there. Press **Start business** to open. Nothing opens without this step.
3. **Open.** The morning batch is baked first: each bread and pastry on the menu uses its ingredients for the planned amount (or as many as the pantry allows) and goes on the shelf. The shop stays open as long as you like; the corner shows how long it's been open (2× and 4× speed it up). Customers walk in and order from today's menu. Drinks are made to order and use their ingredients then; breads and pastries come off the shelf. If a drink's ingredients run out or a bread's shelf is empty, customers who order it leave unhappy.

   **Table service.** Takeaway customers wait at the counter and pay when the barista hands their order over. When a table is free, some customers stay: they order, take a seat (a numbered card goes on the table), and wait. When their order is ready the barista sets it on **the pass**, the pickup window at the end of the counter (a steel ledge and a heated shelf, three plates each, under two heat lamps), rings the bell on its header and calls for a server. A free server answers (a "!") and takes the order whose guest is closest to giving up, plus up to two more: orders for the same room first, then rooms on the way. They deliver nearest room first, walking on from room to room rather than back to the pass, and each guest pays on delivery. If nobody comes, the barista rings again; with the pass full (six plates), they hold the order and keep calling until there's room. Guests left waiting too long give up and leave without paying, and their order is wasted. When you're done, press **Close shop**: the doors shut, anyone still waiting goes home (without paying, and not counted as lost), and the **settlement** pops up. Unsold breads and pastries go stale and are thrown away, and the settlement shows customers served and lost, revenue, ingredient cost, how much was baked and went stale, which shelves sold out, profit and the best seller.

What to spend the day's revenue on:
- **Menu tab:** 55 dishes in four categories (14 coffees, 11 teas & drinks, 15 breads, 15 pastries & cakes), each unlocking in its own order:
  - **Coffee:** espresso, americano, latte, cappuccino, flat white, cortado, mocha, Viennese coffee, caramel macchiato, cold brew, dirty coffee, pour-over, sea salt cream coffee, affogato
  - **Tea & drinks:** Earl Grey, hot chocolate, lemon black tea, chai latte, mixed fruit tea, hojicha latte, matcha latte, caramel frappé, strawberry smoothie, royal milk tea, matcha float
  - **Bread:** butter roll, sesame bagel, baguette, cheese bun, pretzel, herb focaccia, ciabatta, raisin loaf, sourdough boule, rye loaf, chocolate milk bread, milk loaf (shokupan), brioche, fruit brioche braid, garlic cheese bread
  - **Pastries & cakes:** glazed donut, raisin scone, chocolate chip cookie, croissant, pain au chocolat, chocolate brownie, cinnamon roll, blueberry muffin, vanilla cream puff, melon pan, egg tart, strawberry shortcake, strawberry Swiss roll, cheesecake, macarons

  Unlock dishes and level them up; at levels 10, 25, 50, 100, … a dish's price doubles. Each row shows the recipe, how many servings the pantry can make, and an On/Off menu toggle (changeable while closed). Breads and pastries also have a **Bake** amount (± in steps of 5) with the expected sales next to it; **Bake for the forecast** sets them all to what a normal day sells. Bake too few and the shelf sells out; bake too many and the rest goes stale. Every dish on the menu beyond the first brings 4% more customers (up to +60%), and about a third of customers pair a drink with something from the bakery (or the other way round), buying both.
- **Pantry tab:** 12 ingredients: coffee beans, milk, flour, butter, eggs, sugar, tea leaves, spices & herbs, cocoa, cream & cheese, fresh fruit and matcha. Ingredients keep from day to day. **Stock up for a day** buys what a full day on today's menu needs, including exactly the planned morning bake.
- **Upgrades tab:** Add a Main Café Table fills the original room (2 tables to start, up to 8; crates mark the next spot), the Chalkboard Sign brings more customers, the Espresso Machine brews faster, Hire Barista adds staff behind the counter (up to 4), Hire Server adds servers to carry orders to the tables (up to 3; you start with one), and Hire Cook adds cooks to the kitchen (up to 3; the kitchen comes with one).
- **Café areas:** a continuous two-dimensional building, with Main Café and Reading Room facing the street and Garden Patio and Glasshouse behind them. Shared doors connect Main Café → right to Reading Room → rear to Glasshouse → left to Garden Patio; only the main café has a street entrance. Click the arrows at the actual doorways, or use all four keyboard arrows, to pan in that direction. The compact **Map** button in the scene corner shows a thumbnail of every room on demand. Click a room to enter it, or click Map again to return; the map takes no permanent space above the scene. Camera motion respects reduced-motion preferences. While closed, open the **Reading Room** ($1,200), then the **Glasshouse** ($18,000), then the **Garden Patio** ($240,000). Each has its own pixel architecture, adds 4 tables, and draws +10%, +15%, and +20% customers respectively. Customers buy at the main counter, walk through those same shared doors to their seats, and return through them to leave. With every extension and main-room table, the café has 20 tables. Place and move furniture in any opened room; doorways and circulation stay clear. Existing saves retain progress and furniture; pieces blocking a new passage go safely into storage.
- **The kitchen:** a back-of-house room through the door in the main café's left wall ($800, built while closed; it comes with one cook). It's laid out so every batch flows one way toward the café door: storage (walk-in cold room, dry store and ingredient bins), the hand sink, prep (spiral dough mixer, proofing cabinet and a prep bench with a dough sheeter and stand mixer), the hot line under the hood (bagel kettle, deck oven, convection oven and fryer), then out (cooling rack, pastry fridge, door), with the dish pit by the door. Equipment arrives as you unlock the dishes that need it: rolls bring the mixer and deck oven, bagels and pretzels the kettle, donuts the fryer, croissants the sheeter, cakes the stand mixer and pastry fridge. Until then its spot is marked out with the hookups capped. While the shop is open, a free cook bakes a fresh batch of 5 of whatever bread or pastry on the menu is down to 3 or fewer in the pastry case. They fetch ingredients from the pantry, work each station in turn, and send the batch through the door into the case. **Stock up for a day** keeps a batch of ingredients per cook on hand for this.
- **Decor tab:**
  - **Furniture:** 23 pieces (plants, lamps, a bookshelf, an armchair, a cat bed, a piano, paintings, a wall clock and more) that you place wherever there's room. Buy one and tap a free spot in the café; the free cells light up and the piece shows green where it fits. **Arrange café** lets you tap any placed piece to move it or put it back in storage. Floor pieces go anywhere except the counter, the walkway from the door, the tables and the spot the next table will take (expanding the shop moves anything in the way to storage); wall pieces go either side of the menu board. Each kind adds its comfort once, however many you place.
  - **Room style:** seven spots: wallpaper, floor, counter, windowsill, ceiling, rug and neon sign. You buy each item once, then can switch between owned items for free.
  - Comfort raises tips by 1% per point.
- **Goals:** a checklist of 15 goals with cash rewards walks you through the loop in order.
- **Tap the café** (or press <kbd>Space</kbd>) during the day to help brew faster. Tap the cat on the windowsill to pet it.
- Now and then a VIP customer with a crown shows up and pays 5×.

### Built for the workday

- **Nothing runs without you.** The shop pauses when you switch tabs or close the game and picks up exactly where it left off, still open, when you come back. Days only start and end when you say so. (The Shift Manager, who used to earn while you were away, has retired; saves that hired one get the money back.)
- The game is silent. The light follows your own clock through the day: a pale dawn, bright mornings, a golden late afternoon and a blue dusk, with sunbeams that slant and stretch as the sun crosses the sky. As it gets dark the lamps come on: ceiling lights, floor lamps and sconces you placed, the reading lamp, the patio bulbs, and the kitchen's tube lights and ovens. The garden patio and glasshouse feel the sky most; the walled rooms keep more of their own light.
- Progress saves automatically to `localStorage`.

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
| `src/game/sim.ts` | Customer and barista simulation |
| `src/game/state.ts` | Save format, loading and validation |
| `src/render/phaser/` | The [Phaser 4](https://phaser.io) game that draws the café: game loop, camera, input, baked room textures, characters and props as sprites sorted by depth, particles and pop-up text |
| `src/render/lighting.ts` | Time-of-day lighting: keyframed sky, sun, color grade and lamp levels that every part of the scene reads from |
| `src/render/cafe-view.ts` | What the café shows, independent of Phaser: the camera between rooms, the piece being arranged, tap targets and queued effects |
| `src/render/` | Pixel sprites defined as text grids, a 3×5 bitmap font, and the canvas painters for rooms, decor and furniture (`room-art.ts`, `decor-art.ts`, `furniture-art.ts`) |
| `src/ui/` | Side panel, opening flow (`onboarding.ts`), modals |
| `src/i18n.ts`, `src/locales/` | Translations |
| `scripts/gen-icons.mjs` | Builds the app icons from a pixel map (`npm run icons`) |

All art is drawn in code from character grids (see `src/render/sprites.ts`), so there are no image files to manage. The Phaser scene turns those canvases into textures; rooms are painted into canvas textures that repaint a dozen times a second for their ambient animation. The side panel, dialogs and HUD are plain HTML over the canvas. To add a drink, add an entry to `MENU` and its recipe to `RECIPES` in `data.ts`, and its art in `ITEM_ART`.
