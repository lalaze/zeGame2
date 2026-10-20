# Tiny Bean Café playtest — 2026-10-19

Branch `joyful-sloth` at `ffbde42` **plus the uncommitted working tree** (pluralization, chalkboard lettering, partner and panel edits). I played a fresh English café from the first screen through five full business days and into day 6 (~60 minutes of play). I also spot-checked Chinese and a 390×844 phone viewport.

## Setup and limits

- Separate Vite server on `127.0.0.1:5231` with a throwaway headless Chrome profile (`--no-sandbox --disable-gpu`), driven over CDP with real mouse, keyboard and touch events. The 5173 server and its save were not touched.
- Mobile means Chrome device emulation (390×844, DPR 3, touch). It is not a real phone.
- Unlocks and purchases all came from money earned in play. No save editing or injected money.
- Chrome was force-killed once by a tool time limit. After relaunch the save came back without my last $800 goal claim, and the goal was claimable again (a clean rollback). This is most likely Chrome losing unflushed localStorage on a hard kill, so I don't count it as a game bug.

## Run summary

| Day | Menu | Served | Revenue | Profit | Notes |
|---|---|---|---|---|---|
| 1 | Espresso Lv1 | 37 | $123 | +$86 | Closed automatically at 20:00 |
| 2 | Espresso Lv5 | 39 | $955.67 | +$916.67 | Bought sign and a barista mid-day |
| 3 | + Americano, Latte | 17 | $191.67 | +$162.67 | Closed by accident at 12:15 (issue 4) |
| 4 | same | 47 | $606 | +$537 | Americano was the best seller (×22) |
| 5 | + kitchen, Butter Roll, Reading room | 53 | $1,058.76 | +$845.76 | 2 stock-outs, 5 stale rolls, rating 4.14 → 3.92 |

## Issues

Severity: **High** = clearly broken and visible to every player. **Medium** = misleading or hurts the core loop. **Low** = polish.

### High

1. **The in-world chalkboard cuts off dish names and prices once there are 2 or more dishes.** The board read `ESPRE… ≈$20…`, `AMERIC…` with no price, and `LA… $…`. Page 2/2 showed `BUTTER R…` with no price, and Chinese showed `拿…`. Every player sees this from the first new dish onward. Screenshots 03, 04, 05, 13.
   - **Likely cause:** the uncommitted change in `src/render/room-art.ts:400-413` sizes each name and price box to its measured width +1. In the live main room, `withPlane()` then shrinks every label box by the wall projection, `width * (b.x - a.x) / SCENE_W` (≈0.9, `room-art.ts:494-497`). Every label ends up about 10% too narrow, so `fitSignLabel` cuts it off.
   - The new test in `generated-wall-art.test.ts` passes because it draws the board without the projection. A test that goes through `withPlane` would catch this.

2. **The English pixel font renders "fi" and "fl" as an "A"-like glyph.** "first" reads "Arst", "confirm" reads "conArm", "filled" reads "Alled". "flavor", "flour", "floor" and "Flat white" are affected too, across onboarding, the guide, goals and stories. Pixelify Sans has a ligature for these letter pairs; `font-variant-ligatures: none` fixes it (screenshot 02). No stylesheet currently sets it. Screenshots 01, 02.

### Medium

3. **The guide says the day never ends on its own, but it does.** Guide step 4/6 says "You can close whenever you like. No timer ends the day." (`en.json:718`). The Chinese is the same (`zh.json:718`, "营业不会自动结束"). In reality the day closes automatically at 20:00, and the HUD shows `Open x / 12:00`. The pantry note "The forecast is … not a closing timer" (`en.json:793`) points the same wrong way. Screenshot 06.

4. **"Close shop" ends the day instantly, with no confirmation and no undo.** It sits right next to the 4× button. While the shop is open, the top-left clock and speed panel also covers the windowsill cat, which the README says you can tap. My tap at the cat hit Close shop at 12:15, and day 3 ended with 17 guests instead of about 50. Screenshot 07.

5. **Goal 3 points to a menu section that doesn't exist yet and blocks the next goals.** It says "Start baking Butter Rolls (Menu → Bread)" (`goals.ts:19`, `en.json:359`). Bread needs the $800 kitchen, and the Menu tab has no Bread section until the full tab set appears. Because goals unlock one at a time, the cheap goals behind it (Latte $80, Milk $60, sign $100) wait behind the kitchen. I had already unlocked Latte on day 3 but couldn't claim it until day 5. The goal also completes on *unlock*, not on baking as its text says.

6. **Balance: adding dishes lowers revenue.** Every new dish starts at Lv1 and is chosen as often as a levelled one. Espresso Lv5 alone made $955 from 39 guests. Adding Americano Lv1 ($5) and Latte Lv1 ($10) made $606 from 47 guests, and Americano was the best seller. The variety bonus (+4% guests per dish) doesn't come close to covering it. Following the goal path ("Unlock Latte") cost me money.

7. **Placing decor: nearly the whole main room is off-limits, and nothing says why.** In placement mode the blocked cells get a uniform 30% dark wash (`cafe-scene.ts:1502`). Almost the whole floor is blocked, so the room just looks dim and no free area stands out. 6 of 7 empty-looking spots (corners, beside the rug) were rejected with "That spot's taken". These are most likely spots kept clear for future tables, but the game never says so. Screenshots 08, 09.

8. **The day 5 settlement gives contradictory baking advice.** Butter Roll was "Unavailable ×3" (the pantry ran out of flour and butter), and the same screen said "Unsold and stale ×5 — Bake a little less of these tomorrow". Baking less would make the stock-outs worse. The stale rolls came from late in-day batches.

### Low

9. **"Profit per game minute" shows $0 on profitable days.** +$86 and +$537 days both showed "$0", and +$846 showed "$1". `settlement.ts:85` uses `formatMoney`, which rounds amounts under $1,000 down to whole dollars. The two-decimal money formatter would show the real figure. Screenshot 12.

10. **"Served 1 times"** in the Regulars journal. `regular.ui.served` (`en.json:855`) was missed by the pluralization pass in the uncommitted diff. Screenshot 11.

11. **The Expand Kitchen upgrade card is confusing before the kitchen exists.** It reads "Open the kitchen first → Open the kitchen first" (same text before and after). It also shows a "Need ≈$210" money button, though the real blocker is the missing kitchen, not money. Screenshot 10.

12. **The "Team · N" HUD button shows unread partner stories, not team size** (`partners.ts:19`). It reads as headcount: it showed 1 with two staff, then 3, then 6. Regulars shows the same kind of count as a separate badge. The partner strings are also inline `partnerText(zh, en)` instead of the locale files.

13. **The chalkboard prints "≈ $20.33".** An approximation sign on a café's own price board looks odd; rounded prices would read better.

14. **Time units are mixed.** Upgrades and Promote use "guests/min" and "3 open minutes" (real minutes at 1×), but the HUD clock runs in game hours. "12.8 guests/min" sounds like thousands of guests in a 12-hour day; the real number was about 37.

15. **Chinese "Style" button says "经营" (business/operate)** (`zh.json:1024`). It sits opposite "管理" (Manage). The dialog it opens is titled "经营风格", so "风格" would be clearer. Screenshot 17.

16. **The text says "Decor tab", but the tab is called "Furnish"** (Decor is a sub-tab inside it): `ob.style.hint` (`en.json:243`) and `goal.decor` (`en.json:130`).

17. **Most management tools stay hidden until day 2 is open.** While planning day 2 (shop closed) there's only Menu (Espresso) and Pantry. The new-dish unlocks, Upgrades and Furnish appear only after Start business. Today's menu is locked once the shop opens, so the first chance to put a new dish on the menu is day 3.

18. **Guide overlaps.**
    - In steps 1–3 the guide card stays visible behind the stock and menu dialog, partly covered. Its text ("Press 'Open with me'", "press 'Start day 1'") doesn't match the dialog in front of it. Screenshot 18.
    - During service the card covers the right dining area.
    - The zoom bar (− Overview +) and toasts sit over the street door, hiding guests as they arrive.

19. **HUD covering art.** The right-hand HUD stack covers the Glasshouse in Overview (screenshot 15). The café-name plate covers the Reading room's "BOOK NOOK" sign (screenshot 14). The window cat always covers the first letters of "CLOSED"/"OPEN". The barista's brew progress bar is drawn over the chalkboard.

20. **A dark-red "Test: Restart game" button is the first thing in Settings** (`settings.testRestart`). Its confirmation dialog works, but a debug-labelled reset is the most prominent control in a player-facing dialog. Screenshot 16.

21. **Team dialog.**
    - "Recruit reserve · $60" is disabled while the shop is open, even with enough money, and doesn't say why.
    - Regular guest "Theo" and partner barista "Theo" share a name.
    - The intro line "purchased staffing stays yours free" is hard to parse.

22. **"Prepare menu · Day N" only shows in the Main café.** From the Kitchen or Reading room you have to walk back to start the day.

23. **Signature drink lab.**
    - Opened from Prepare, its Close button drops you back to the room instead of Prepare.
    - The portion selects have no left padding and no dropdown arrow. Screenshot 20.

24. **Accessibility.**
    - Owner-creator swatches use raw keys as aria-labels ("hairStyle 1"; "shirt 3" for apron colours). They are untranslated, have no pressed state, and the targets are 24×24 px.
    - Menu On/Off toggles have no `aria-pressed`.

25. **The status shows twice when closed:** "Day 1 · Closed" top-left and "Closed · Day 1" top-right.

26. **In the pixel font, "5" and "S" are nearly the same.** "50" reads as "SO" and "4.00 / 5" as "4.00 / S".

27. **Day 1 counts the free starter beans as a cost** (−$37). Profit shows +$86 while cash went up the full $123, and the guide had called the beans free.

28. **Performance:** about 306 "willReadFrequently" warnings in the console on load, from `cozy-team-art.ts` reading canvas pixels back.

## What worked

- Onboarding: names are HTML-escaped and capped at 20 characters, back navigation works, and an empty menu blocks opening with a clear message.
- Reload mid-service restores the day, clock and revenue, and service carries on.
- Dialogs (journal, team, settings) pause the clock; Escape closes them and returns focus to the button that opened them.
- Reading a story: "Finished reading" marks it read, and Previous/Next are disabled correctly.
- The 20:00 auto-close and the settlement breakdown work.
- Partial restock with too little money buys what it can and lists it.
- Bake amounts are clamped: −7 becomes 0 and 99999 becomes 9999.
- The kitchen build, cook production, morning bake and stale-roll accounting all work.
- The Reading room unlocks, and the Overview map opens and returns to the room.
- Reset asks for confirmation.
- The English ↔ Chinese switch works.
- The 390 px phone layout has no horizontal overflow, the management overlay shows the paused state, and all touch targets are at least 44 px.

## Not covered

Cats (browsed only, not adopted), Promote campaigns, Glasshouse and Garden Patio, kitchen expansion, the Arrange/move flow, the signature recipe save flow, a second tab on the same save, background-tab pause timing, real phones, and the full test suite (`npm test`). I only ran `generated-wall-art.test.ts`; it passes.

## Fix status (2026-10-20)

Fixed in the working tree (not committed). All 28 issues were checked again in the browser except where noted.

| # | Status | What changed |
|---|---|---|
| 1 | Fixed | The chalkboard sizes each label for the narrower wall projection (`room-art.ts`). Names and prices are whole in English and Chinese, including page 2. New test goes through the projected path. |
| 2 | Fixed | `font-variant-ligatures: none` on `body` and the save notice; native canvas signs use `textRendering = 'optimizeSpeed'`. |
| 3 | Fixed | Guide and help copy now say the café closes by itself at 20:00 (EN/ZH). |
| 4 | Fixed | Close shop asks for confirmation and shows the business time left; the guide's own Close step skips it. On wide screens the clock panel is one row, so the window cat can be tapped. |
| 5 | Fixed (your choice) | Goal 3 is now "Unlock Americano". No save migration needed. |
| 6 | Fixed (your choice) | Economy unchanged. Menu tab and Prepare show the average dish price; dishes that would lower it carry a note. |
| 7 | Fixed | Free placement cells are lit. Tapping the next table's spot says "That spot is kept clear for your next table". |
| 8 | Fixed | A dish that both sold out and went stale gets timing advice, not "bake less". |
| 9 | Fixed | Profit per game minute shows cents. |
| 10 | Fixed | "Served 1 time". |
| 11 | Fixed | The locked kitchen card has no "→" preview and no money hint; its text says where to build the kitchen. |
| 12 | Fixed | The Team button shows unread stories as a separate badge. |
| 13 | Fixed | No "≈" on the chalkboard. |
| 14 | Fixed | Sign, promotion and cat-care figures use guests a day and business hours. |
| 15 | Fixed | Chinese Style button reads 风格. |
| 16 | Fixed | Copy says Furnish (装扮). |
| 17 | Fixed | All management tools appear while planning day 2. |
| 18 | Fixed | The guide card hides while a dialog is open; the in-service close step opens folded; on wide screens the zoom bar sits left of the street door. |
| 19 | Partly | Overview hides the rating/Team/Regulars stack; the BOOK NOOK sign moved right. Not changed: the cat in front of CLOSED/OPEN, and the brew bar over the chalkboard. |
| 20 | No change | "Test: Restart game" only appears in dev builds (`import.meta.env.DEV`); production shows "Reset café" in the footer. |
| 21 | Fixed | Disabled Recruit says why; empty role rows explain how to add a slot; clearer intro; partner barista renamed Milo (麦洛), save id unchanged. |
| 22 | Fixed | Prepare menu shows in every room. |
| 23 | Fixed | The signature lab's Close returns to Prepare; its selects have padding and an arrow. |
| 24 | Fixed | Swatches use translated labels and `aria-pressed`; menu toggles have `aria-pressed`. Desktop swatches stay 24 px (mobile is 44 px). |
| 25 | Fixed | The clock panel is hidden while closed. |
| 26 | Fixed (option B) | English text takes its digits from Fusion Pixel through a `unicode-range` face (`Pixel Digits`). Fusion's digits had no left spacing, so `scripts/pixel-digits.mjs` builds an 800-byte digits font with one design pixel on each side; digits stay about Pixelify's width. Letters are unchanged; Chinese already used Fusion digits. |
| 27 | Fixed | The day 1 settlement explains that the starter beans were free. |
| 28 | Fixed | Team art canvases use `willReadFrequently`; about 306 warnings down to 2 (inside Phaser). |
| — | Fixed (found while verifying) | The mobile balance button was 32 px tall; now 44 px. |

Tests: the same 124 failures as at HEAD `ffbde42` before any change (27 files, mostly art/evidence fixtures), no new ones; 23 more passing. `npm run build` passes.
