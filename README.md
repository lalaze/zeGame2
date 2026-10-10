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
5. Grand opening! Day 1 starts right away.

You can change the name and character later in Settings (`···` → Edit café).

**A day at the café.** Every day has two parts:
1. **Plan (shop closed).** Choose which unlocked dishes are on today's menu, set the **morning bake** for each bread and pastry, buy ingredients in the Pantry, and spend your money on upgrades and decor. Then press **Open shop**.
2. **Open (08:00 to 20:00).** The morning batch is baked first: each bread and pastry on the menu uses its ingredients for the planned amount (or as many as the pantry allows) and goes on the shelf. A day lasts about 3 minutes at 1× speed (2× and 4× buttons speed it up). Customers walk in and order from today's menu. Drinks are made to order and use their ingredients then; breads and pastries come off the shelf. If a drink's ingredients run out or a bread's shelf is empty, customers who order it leave unhappy. At 20:00 the staff finish the line and close up. Unsold breads and pastries go stale and are thrown away, and the **end-of-day report** shows customers served and lost, revenue, ingredient cost, how much was baked and went stale, which shelves sold out, profit and the best seller.

What to spend the day's revenue on:
- **Menu tab:** 38 dishes in four categories, each unlocking in its own order:
  - **Coffee:** espresso, americano, latte, cappuccino, flat white, mocha, caramel macchiato, cold brew, pour-over, affogato
  - **Tea & drinks:** Earl Grey, hot chocolate, chai latte, matcha latte, caramel frappé, strawberry smoothie, royal milk tea
  - **Bread:** butter roll, sesame bagel, baguette, pretzel, herb focaccia, ciabatta, sourdough boule, rye loaf, milk loaf (shokupan), brioche, garlic cheese bread
  - **Pastries & cakes:** glazed donut, raisin scone, croissant, pain au chocolat, cinnamon roll, blueberry muffin, melon pan, egg tart, strawberry shortcake, cheesecake, macarons

  Unlock dishes and level them up; at levels 10, 25, 50, 100, … a dish's price doubles. Each row shows the recipe, how many servings the pantry can make, and an On/Off menu toggle (changeable while closed). Breads and pastries also have a **Bake** amount (± in steps of 5) with the expected sales next to it; **Bake for the forecast** sets them all to what a normal day sells. Bake too few and the shelf sells out; bake too many and the rest goes stale. Every dish on the menu beyond the first brings 4% more customers (up to +60%), and about a third of customers pair a drink with something from the bakery (or the other way round), buying both.
- **Pantry tab:** 12 ingredients: coffee beans, milk, flour, butter, eggs, sugar, tea leaves, spices & herbs, cocoa, cream & cheese, fresh fruit and matcha. Ingredients keep from day to day. **Stock up for a day** buys what a full day on today's menu needs, including exactly the planned morning bake.
- **Upgrades tab:** Add a Main Café Table fills the original room (2 tables to start, up to 8; crates mark the next spot), the Chalkboard Sign brings more customers, the Espresso Machine brews faster, Hire Barista adds staff (up to 4), and the Shift Manager raises what you earn while away.
- **Café areas:** a continuous two-dimensional building, with Main Café and Reading Room facing the street and Garden Patio and Glasshouse behind them. Shared doors connect Main Café → right to Reading Room → rear to Glasshouse → left to Garden Patio; only the main café has a street entrance. Click the arrows at the actual doorways, or use all four keyboard arrows, to pan in that direction. The compact **Map** button in the scene corner shows a thumbnail of all four spaces on demand. Click a room to enter it, or click Map again to return; the map takes no permanent space above the scene. Camera motion respects reduced-motion preferences. While closed, open the **Reading Room** ($1,200), then the **Glasshouse** ($18,000), then the **Garden Patio** ($240,000). Each has its own pixel architecture, adds 4 tables, and draws +10%, +15%, and +20% customers respectively. Customers buy at the main counter, walk through those same shared doors to their seats, and return through them to leave. With every extension and main-room table, the café has 20 tables. Place and move furniture in any opened room; doorways and circulation stay clear. Existing saves retain progress and furniture; pieces blocking a new passage go safely into storage.
- **Decor tab:**
  - **Furniture:** 23 pieces (plants, lamps, a bookshelf, an armchair, a cat bed, a piano, paintings, a wall clock and more) that you place wherever there's room. Buy one and tap a free spot in the café; the free cells light up and the piece shows green where it fits. **Arrange café** lets you tap any placed piece to move it or put it back in storage. Floor pieces go anywhere except the counter, the walkway from the door, the tables and the spot the next table will take (expanding the shop moves anything in the way to storage); wall pieces go either side of the menu board. Each kind adds its comfort once, however many you place.
  - **Room style:** seven spots: wallpaper, floor, counter, windowsill, ceiling, rug and neon sign. You buy each item once, then can switch between owned items for free.
  - Comfort raises tips by 1% per point.
- **Goals:** a checklist of 15 goals with cash rewards walks you through the loop in order.
- **Tap the café** (or press <kbd>Space</kbd>) during the day to help brew faster. Tap the cat on the windowsill to pet it.
- Now and then a VIP customer with a crown shows up and pays 5×.

### Built for the workday

- **Background tab = full speed.** Leave the tab open behind your work and the day keeps running; when you come back it catches up, and the report is waiting if the day ended.
- **Closed browser = the day goes on.** Close the game mid-day and the day keeps running to closing time; when you come back it has played out (sales, ingredients used) and the end-of-day report is waiting.
- **Shift Manager.** Time away beyond that (or while the shop was closed) is run by your Shift Manager at about one business day per hour, paying 25% of a normal day's profit (sales minus ingredients) for up to 4h. Upgrades raise this to 100% for up to 14h.
- The game is silent. The light follows the shop's clock through the day: a pale dawn, bright mornings, a golden late afternoon and a blue dusk, with sunbeams that slant and stretch as the sun crosses the sky. As it gets dark the lamps come on: ceiling lights, floor lamps and sconces you placed, the reading lamp, the patio bulbs and the oven through the kitchen door. The garden patio and glasshouse feel the sky most; the walled rooms keep more of their own light.
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
