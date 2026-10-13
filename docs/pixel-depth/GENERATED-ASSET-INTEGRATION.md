# Selected generated bitmap integration

This checkpoint implements the user's selected image samples, rather than another procedural approximation. Generated main-room image URLs are declared in src/render/generated-main-art.ts and loaded by CafeScene.preload. A missing image preserves the established fallback instead of blocking the operating simulation.

- Wood: lossless interior top-plane and central carved-panel crops. Horizontal modules preserve their source aspect; the full short cabinet is not stretched across a long170×31 counter. Original cabinet is archived.
- Dining: newly generated table without its vase, independent vase and correctly facing left/right chairs. Table display33×27.08 follows source aspect; its tabletop center remains at table.y−19. Chairs18×25 remain independent of seated guests. Existing layered seated upper body, plate/cup and table tent logic is preserved.
- Plants: source-cropped plant22×22.81, original pot contact aligns to existing entrance floor anchor. Vine19×22.18 aligns its pot bottom approximately to counter y96. Leaves may extend outside the pot's reserved floor footprint; collision/route footprints are unchanged.
- Bakery: wide empty display72×19.33 with actual stock composited inside. Generated croissant and cake only appear for their real menu item and positive stock. Other menu items use established icon art. Glass reflections remain separately composited. The empty source cannot imply fixed inventory.
- Default owner: nine generated stand/stride/passing-knee images across down/up/right are now integrated, with left mirrored. A single source scale and fixed foot anchor prevent frame-height drift; runtime presentation scale is 1.18. Only the default all-zero owner look qualifies. Customized owners, other staff,29 other customer appearances and cats retain their original matching animated sets. Cast0/Mina has a complete15-source identity-specific walking/seated/pet set; both seat facings are independent and left walking is mirrored. Hand/cat contact correction remains under review. This is partial character coverage, not all appearances or actions.

Source manifests are public/art/generated/main-v1/manifest.json and public/art/generated/main-v2/source-manifest.json. V1 original sheets/full cabinet are under assets/generated/main-v1; new production cutouts remain lossless PNG. V2 generation originals remain in the accompanying cafe-assets-v2 source delivery, not required for running the app.

Normal image loading is a fixed finite set per Scene texture manager; no per-frame fetch/decode is used. Source PNGs retain their original alpha, including very-low-alpha fringe. There is no unreported matte-removal or color change. Runtime nearest-neighbor sampling preserves pixel character, but final pixel density/art consistency still requires visual review.

Actual current screenshots are named generated-assets-first-live-*.jpg. These show a synthetic QA save, not natural gameplay progress. Passing tests and running bitmaps do not constitute full artwork acceptance.

Service-v1 adds independent machine, pickup hutch, cupboard, cups, jars and basket. Pickup native aspect and crop land shelf lips at80.92/93.88, aligned to unchanged real order slots. Carafe/tray overlay uses conditional4px visual translation on the new cupboard. Wall-v1 is staged/preloaded but not yet verified as rendered.
