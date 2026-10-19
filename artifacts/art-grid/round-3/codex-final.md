**1) Fixes**
1. Reading doorway now has a recessed opening, header, jambs and threshold. Runners begin at floor level and form joined, room-specific textiles.
2. Added golden window patches, continuous lamp falloff, contact shadows and warmer nights; retained travelling sunlight and outdoor sky exposure.
3. Calmed glasshouse, patio and kitchen floors with grouted clay tiles, flagstones and ceramics. Reading herringbone stays.
4. Redrew the built-in reading armchairs and lamp at larger proportions. Placeable furniture, thumbnails, footprints and anchors remain unchanged.
5. Added cream/burgundy, sage and blue/cream tablecloth remaps without changing geometry, seats or poses. Main-room red gingham stays.
6. Replaced equipment debug outlines with floor tape; retained capped hookups. Added textured mats and pixel STORE/PREP lettering.
7. Thoughts now use shared pixel glyphs, matching wrapping/measurement and binary CJK fallback. Both locales, placement and 3.6-second timing remain.

**2) Files Changed**
New surface/table modules plus region, passage, kitchen, furniture, lighting, scene and thought renderers/tests. Full inventory: `docs/art-grid/extension-room-redraw.md:41`.

**3) Verification**
- TypeScript, build and diff checks pass.
- Vitest: **2,499 passed; 103 baselined failures**, plus four baselined discovery errors. **Zero new failures; no existing test contracts changed.**
- Focused tests: **58 passed**. All **11 offline PNGs** pass conformity checks.
- Renders and report: `artifacts/art-grid/round-3/report.json:1`.

**4) Remaining Gaps**
External Chrome verification remains for final WebGL blending, actor sorting, projection and phone/touch presentation. All seven implementation items are complete. Approved main artwork and existing uncommitted work are preserved; no commit or stash.