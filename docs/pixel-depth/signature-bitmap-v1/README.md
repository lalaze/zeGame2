# Signature bitmap compositor, main-room candidate v1

This is **offline actual-PNG composition evidence, not an in-game screenshot**. Source bitmaps are image-generated candidates, uniformly exported at a 128px maximum edge. The original RGBA images remain untouched in `assets/generated/bulk-candidates/ui/`.

`matrix.png`: 26 rows. Each row shows 18px, 32px, and 96px outputs enlarged to 96px with nearest-neighbor sampling, first on a light table color and then on a dark color. Exact recipe IDs are printed above each row and listed in `matrix.json`.

Coverage: four bases × one/two base portions (8); all seven addons × one/two portions (14); four dense six-portion recipes (4). `unique-count.json` records exhaustive actual-pixel testing: 1,104 valid recipes, all distinct at both 18px and 32px.

Compositor contract:
- 14 genuine candidate PNG layers: four vessels, four liquid surfaces, six garnish layers. The peaked milk-foam and unregistered glass-glints candidates are deliberately excluded.
- Native liquid body polygons and rim ellipse masks are explicit source-local geometry. Milk additions use visible native liquid bands in both glass bodies and liquid surfaces, never the foam cap.
- Complete vessels are drawn once. Sources keep original color/alpha; neither flood-fill nor color-derived masks are used. Each authored bitmap uses one isotropic scale.
- Sugar and spice bitmaps contain grouped pieces. Their artwork does not claim one piece per portion. Fixed footer slots encode exact ingredient portions: milk, sugar, spice, cocoa, cream, fruit, matcha left-to-right; primary base at the right. Each filled row denotes one portion. These marks remain visible when cream occludes another garnish.
- Runtime dimensions and sampling content come from `assets/generated/runtime-catalog-v1/signature.json`; original-size PNGs or mismatched packed dimensions are rejected. Exporter ceil padding is not treated as content.
- Required source missing/undecoded or rendering failure returns the entire recipe to its existing renderer. Recipe definitions, economy, simulation and saves are unchanged.
- Source-local registration is proposed integration geometry in `src/render/generated-signature-art.ts`; visual acceptance requires the final in-game view too. This matrix does not establish browser save/menu/order gameplay coverage.

Tests use the optional official `@napi-rs/canvas` authoring engine already used by the asset exporter. If it is unavailable, real-raster tests are explicitly skipped rather than pretending to validate PNG pixels. Generate evidence with:

    SIGNATURE_RASTER_EVIDENCE=docs/pixel-depth/signature-bitmap-v1 npx vitest run src/render/generated-signature-art.test.ts
