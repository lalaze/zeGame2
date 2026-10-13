# Cafe placeable furniture batch v1

This batch completes the 39-ID placeable furniture source-candidate domain: 32 newly generated sprites here, four previously delivered in `../cafe-movable-v1`, and three explicit reuse candidates in `aliases.json`. No repository writes, commits, pushes or game integration were performed.

Every substantive image was made with built-in imagegen, one independent asset per generation call. `PROMPTS.json` contains original prompts; `REVISIONS.json` records the three targeted revisions. `sources/` retains full selected generated RGBA originals. Top-level ID PNGs are ten-pixel-padded rectangular crops. Four `sheet-batch-N.png` files losslessly pack the crops, without resizing or repainting. `batch-N.json` maps exact source files. `manifest.json` contains all 32 produced IDs and measurements. `package_assets.py` performs only source copy, measurement, cropping and packing; pixel-equality was asserted.

## Semantic guarantees

- Display cabinet and coffee cart are EMPTY storage bodies. Their first-round sources containing cups/appliances were superseded by imagegen revisions. Only revised empty versions are packaged as active assets.
- Lantern candle is unlit, without flame. Floor-lamp shade is a cream body with ambient material highlights. Runtime emitted light remains separate.
- A-frame board is completely blank; any gameplay content must be separate.
- Framed cat is a fixed printed picture only. Catbed in the first batch is empty; no living cat is baked into furniture.
- Books, framed illustrations, bean display bags and existing sideboard plates/bowl are fixed decorative details from the source module.
- Starry picture is a static painting base; preserve runtime twinkling separately.
- Clock in the first batch has a hand-free dial for live local-time hands.

## Reuse candidates

`sconce` reuses the existing brass wall lamp. `vase_daisies` reuses the actual white-petal/yellow-center daisy glass vase. `hanging_ivy` reuses the complete independent terracotta pot with trailing variegated ivy. The ivy has NO hanging rope, no wall or cabinet corner baked in. `aliases.json` includes approximate pot-rim/rope attachment points for a later separate rope layer. All aliases have freshly measured native aspect, bounds, logical envelopes and appropriate wall-center or floor-foot anchors. They are source-reuse candidates, not proof of world/shop integration.

## Geometry and quality limitations

Bounds use alpha > 128 solely for measurement. Alpha pixels were never threshold-deleted. Full generated sources retain faint distant alpha noise; a crop omits pixels outside its rectangular margin. Maximum alpha on the produced crop perimeter was 1/255 at authoring validation, so no opaque silhouette touches its crop edge.

Floor placement centers the visible bounding box on cx and its last visible row on footY. Wall placement centers the visible art inside the unchanged wall footprint. The manifest supplies both foot-style anchor and center; use center for wall objects. Preserve native aspect and fit uniformly, including in shop thumbnails. Some generated ratios differ materially from tiny original envelopes, flagged by fitNote. Do not distort art to fill the original rectangle and do not change the collision grid. Render overflow, increased visual size and final readability require later integration review.

The visible generation results were inspected for identity, blank/empty surfaces, complete silhouettes and general style. Fine texture density and perspective vary modestly across independently generated pieces; no runtime-scale, lighting, movement, occlusion or shop-preview test is claimed.
