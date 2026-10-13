# Independent mobile/browser audit, 2026-10-12

Environment: cloud Chromium, isolated http://127.0.0.1:5302/harness.html only. Actual game iframe viewport 390×720 CSS pixels, document scrollWidth390; dialog clientWidth366 and scrollWidth366. Synthetic research fixture; no physical-phone claim. Production5173 was not accessed. No source/art assets changed by this reviewer.

## Verified defects and retest

1. High: signature-only menus could not start business. Original bundle game-BX3E_vw1.js: saved coffee1/milk2, listed it and removed espresso/roll; preparation enabled Start business, but click dismissed dialog and remained Closed Day8. Parent fixed src/main.ts menuEmpty to use menuItems. Final game-BUg_zIYM.js on same save entered Open and served customers.
2. Medium: signature-only menus could not book promotions. Same original save showed enabled Hire creator $60, but click produced no campaign or debit. Parent fixed src/game/promotion.ts to use menuItems. Final bundle deducted exactly60 (10000→9940), displayed Waiting for opening, then Running after opening. Original screenshot and DOM retained.

## New checks performed

- English390: create coffee1/milk2, taste quarter, save Independent Cloud, list; rename Cloud Renamed; change milk to1, retaste, replace. Listing preserved, deliveries remained0 through research. Remove/relist and delete cancellation worked. Reopen preserved recipe/formula/name/menu.
- Final build English live detail: rename textbox and Edit formula/Rename/Remove/Delete disabled with preparation-only explanation. Actual service accumulated19custom deliveries. Graceful closing settled129.20 revenue,92.02 consumed costs including promotion,37.18profit. No forced settlement.
- Chinese390: actual deletion of coffee recipe resulted0/6saved,0/3listed. Created fruit1/milk1/sugar1, tasted, saved复核莓云, listed. Renamed复核莓云二号; changed milk to2, retasted and atomically replaced. Current price42/cost25/prep6.6/taste4.2, delivered0, preserved listing. Remove/relist/delete-cancel worked.
- Chinese dialog fits366px inside390viewport without horizontal overflow. Reopened iframe; preparation retained复核莓云二号, formulafruit1/milk2/sugar1, listed,39whole servings available. Started signature-only business, verified live edit controls disabled, rendered custom fruit order bubble and seated customers. Graceful closing settled9cups,378revenue,247.82cost including promotion,130.18profit.
- Native rendering continued beyond prior dine-in crash window for coffee and fruit service; no TypeError or app5302 error found in browser logs. Extension metadata warnings existed separately. Screenshots show seated customers, staff and compact custom drink order bubbles. Exact individual taste-thought text was not captured visually; direct thought regression tests cover heart expiry and all four bases.
- Re-ran src/render/thoughts.test.ts and signature-drink-art.test.ts:37passed. Tests cover real simulated handoff through sitting/heart expiry for coffee,tea,milk,fruit and stable canvas identity.

## Texture lifecycle review and limits

signature-drink-art.ts caches canvas by immutable recipe ID,density,compact flag; textures.ts canvasKey uses stable canvas identity to register once; cafe-scene.ts image path obtains canvasKey. No per-frame fresh-canvas texture growth found for unchanged custom drink. Native create/edit/delete/reopen/service rendered normally. Did not inspect actual Phaser texture counts, GPU heap, long-session memory, physical phone, or same-module multiple Phaser game instances; do not claim those passed.

Evidence: original-promotion-failure.png, original-promotion-dom.txt, fixed-start-dom.txt, live-readonly-dom.txt, service-zh.png, service-final.png, chinese-edit.png, chinese-live-dom.txt, fruit-service-final.png, final-dom.txt, render-regression-tests.log. UI screenshots may include harness chrome; game itself is390CSS pixels.
