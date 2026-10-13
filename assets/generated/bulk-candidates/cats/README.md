# Tiny Bean Café — remaining 11 cat breeds

154 final action PNGs, 14 for each of ginger, tuxedo, calico, tabby, black, white, british, american, ragdoll, persian, mainecoon. Existing completed Siamese is intentionally excluded. All exact CatIds/actions match BULK-ASSET-CATALOG.json and sprites.ts.

Each breed directory includes original source.png, exact generation prompts, selected action crops and renderer-manifest.json. Five breeds include correction sheets; persian/action-correction-source.png is a rejected crowded intermediate and vertical-correction-source.png is selected instead. Use manifests as the source of truth, never infer state from intermediate filenames.

The built-in image_gen tool created all visual content. Python performed only alpha measurement, crop metadata, lossless rectangular crops, hashing and validation. validation.json records 11 breeds / 154 distinct final images, source-pixel equality, transparent alpha and one major cat component per crop. No repo files were changed and no game integration was performed.

One calibrated scale is shared by every selected frame from each source sheet. Correction-sheet scale is a head-size estimate, not per-frame height fitting. Per-frame foot and crown/headContact points were manually visually estimated. Head-left walking and upright front-three-quarter conventions preserved.

Remaining runtime checks: actual game-scale breed/detail legibility; consistent physical head/body size across sheets; walk transitions and flips; all 14 state mappings; raised chest/head-to-hand contact; reduced motion; faint preserved alpha fringe against café backgrounds. Some new raised poses are only roughly 8–18% taller than idle at the same head scale, so test real petting rather than assuming legacy 18-row geometry.

Ready for generation checkpoint. Runtime acceptance is a later step after the requested commit/push checkpoint.
