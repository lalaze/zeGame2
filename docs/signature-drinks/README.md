# Tiny Bean Café — signature drink feature

Open Menu → Signature drink lab (菜单→招牌饮品研发), or the preparation dialog. Research and changes require closed preparation phase.

Choose coffee, tea, milk or fruit; unlock ingredients through existing menus. Pick bounded doses, inspect actual price/cost/time/margin and deterministic flavor/quality. Taste consumes exactly a quarter of the recipe; saving does not charge again. Name and save up to six drinks; list up to three. Use details to rename, edit formula, remove from menu or delete. Only delivered cups advance each canonical formula's30/100 practice milestones.

Custom prices are cost-based and intentionally do not inherit exponential static-menu upgrade levels. See BALANCE.md for480same-budget seeded runs and limitations, REVIEW.md for independent regression evidence, BROWSER-QA.md for real cloud Chromium observations, and ACCEPTANCE.md for the checklist.

## Development
- npm ci
- npm test
- npm run build
- npm run dev -- --host 127.0.0.1
- SIGNATURE_BALANCE_LAB=1 npx vitest run src/game/signature-balance.test.ts --silent=false

## Isolated browser reproduction
Build first, run node docs/signature-drinks/generate-fixtures.mjs, copy harness.html and fixtures into dist, then serve dist with python3 -m http.server 5302. Open http://127.0.0.1:5302/harness.html. The QA harness refuses other ports to protect real saves. It writes synthetic data only to that origin. Never reuse production5173 for QA.

## Delivery boundaries
No commits, pushes or production-player save edits are part of this delivery. The source patch targets f45237a319917b987eb30457a17b66baaf3176d6. Static build needs HTTP hosting; opening index.html as file:// is unsupported by its JavaScript modules.
