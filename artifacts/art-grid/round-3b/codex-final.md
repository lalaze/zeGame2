**Fixes**
1. Armchairs: rust/burgundy upholstery, rounded arms, piped cushions, warm outlines, highlights, lower-right shading, wooden feet and contact shadows. Anchors, envelope and depth retained.
2. Floor lamp: brass hardware and base, shaded cream fabric shade and contact shadow. Night lamp pool unchanged.
3. Tablecloth: palette-only calm cream top and shaded drape with burgundy edge trim; removed speckles/check noise. Geometry, alpha, seats and poses unchanged.
4. Window light: replaced reading-room smudges with the main room’s golden pane painter; floor light now paints behind the built-in furniture.

**Files Changed**
- `src/render/extension-surfaces.ts:85`, `src/render/extension-table-art.ts:8`, `src/render/region-art.ts:207`
- `src/render/extension-surfaces.test.ts:59`, `scripts/extension-room-qa.mjs:9`
- Offline renders, logs and `artifacts/art-grid/round-3b/report.json:1`

**Verification**
- `npx tsc --noEmit` and `npm run build`: passed.
- Vitest: 2,501 passed; **103 baseline failures, zero new failures**. Focused tests: 14/14 passed.
- Pixel conformity: all 13 generated PNGs passed. Non-reading comparison renders are byte-identical.

**Remaining Gaps**
Real Chrome review remains pending as requested; offline renders do not verify Phaser camera/actor sorting. No commits or stash; existing work and historical assets preserved.