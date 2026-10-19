<task>
Repository: /Users/lalaze/.paseo/worktrees/2h96yp2x/joyful-sloth (git worktree, branch joyful-sloth). "Tiny Bean Café", a Phaser 4 + TypeScript cozy pixel-art café game (Vite). Do NOT commit and do NOT use git stash; the working tree holds uncommitted work that must be preserved.

Background: the world now uses ONE art grid (2 art px per room px) and a master palette; read docs/art-grid/README.md first (rules, tools, backlog). The MAIN ROOM was already redrawn and approved in real Chrome; read docs/art-grid/main-room-redraw.md and reuse its building blocks for consistency: src/render/main-room-surfaces.ts (palette-ramp surface painters), src/render/sign-lettering.ts (on-grid pixel lettering with Pixel ZH and a thresholded platform CJK fallback, font-readiness repaint), the golden window patches and contact shadows in src/render/main-room-lighting.ts and src/render/room-art.ts. Approved look: artifacts/art-grid/review-2/cream-day/main-full.png and the art-direction sample public/art/generated/cafe-style-sample-v1/sample.png.

Your job: bring the OTHER rooms and in-world thought text up to the main room's standard (backlog item 6, plus thought text). Look at the current state first: artifacts/art-grid/review-2/cream-day/reading-full.png, greenhouse-full.png, terrace-full.png, kitchen-full.png and the reading-corner / greenhouse-corner / terrace-corner / kitchen-left / kitchen-right close-ups (night versions in artifacts/art-grid/review-2/cream-night/). Relevant code: src/render/region-art.ts, src/render/passages.ts, src/render/kitchen-art.ts, src/render/cozy-world-art.ts, src/render/phaser/cafe-scene.ts, src/render/thought-bubbles.ts, src/render/thought-text.ts.

1. Reading room: the rear doorway to the glasshouse is a flat beige strip running up through the back wall and the window, reading like a hole cut through the painting. Give it a real doorway (frame, header, threshold) that the wall and window stop against. The door-to-door walkway strips (also in the glasshouse and patio) are flat beige placeholders; make them room-appropriate runners or paths in the main room's rug language.
2. Light: replace the smudgy translucent rectangles near the windows with golden window patches like the main room's, lamp pools without stepped concentric discs, contact shadows under furniture, and warm nights. The glasshouse and patio feel the sky most; keep the existing lighting design and time-of-day behaviour.
3. Floors: the glasshouse sage/cream checkerboard is too loud and dominates the room, and the patio terrazzo speckle is busy. Make both calmer, with real material and grout (e.g. aged terracotta or soft two-tone tile, flagstone or brick pavers) on the palette. Keep the reading-room herringbone unless it fights the furniture. Calm the kitchen checker the same way.
4. Scale: the reading-room armchairs and floor lamp are tiny next to the tables. Find out whether they are room art or placeable furniture. Keep any furniture footprints, anchors, tap targets and shop thumbnails consistent, and draw them at a believable size within what the geometry allows.
5. Room identity: every room uses the identical red gingham table set. Give each extension room its own tablecloth colourway by palette remapping only (e.g. reading room cream with burgundy trim, glasshouse sage gingham, patio blue-cream), so sprite geometry, seats and seated-pose alignment stay exactly the same. The main room keeps red gingham.
6. Kitchen: the dashed outlines for not-yet-installed equipment look like debug boxes; draw them as marked-out floor tape with capped hookups. The anti-fatigue mats are flat dark rectangles; give them texture. STORE/PREP signs use the main room's pixel lettering.
7. Thought bubbles: thought text is a smooth anti-aliased raster that looks pasted on (see "My little café dream" in artifacts/art-grid/review-2/cream-en/main-full.png). Render it with the same on-grid pixel lettering (pixel fonts, binary CJK fallback), keeping wrapping, measuring, placement, the 3.6 s display limit and both locales.
</task>

<action_safety>
Do not change the main room's approved artwork. Keep routes, doorways, seats, collision, unlock rules and locked-room appearance, region heights, lighting behaviour, kitchen equipment gates and cook routes unchanged. No simulation, economy, save, HTML HUD or character changes. Do not delete historical assets. Respect reduced motion and phone performance.
</action_safety>

<default_follow_through_policy>
Keep going without routine questions; choose the most reasonable low-risk option.
</default_follow_through_policy>

<completeness_contract>
Resolve all seven items before stopping. If one cannot be completed, state exactly what remains and why.
</completeness_contract>

<verification_loop>
Run and report: npx tsc --noEmit; npm run build; npx vitest run compared with artifacts/art-grid/foundation-test-failures.txt. Currently 103 tests fail, all of them in that baseline list. Zero new failures; explain every test whose contract you change. Run node scripts/pixel-conform.mjs check on any new or changed PNG. Your sandbox cannot run Chrome or bind a server, so inspect your work with offline renders saved under artifacts/art-grid/round-3/ (scripts/review-main-room-qa.mjs shows the offline approach) and write a short report.json there. Browser captures will be taken afterwards outside your sandbox.
</verification_loop>

<structured_output_contract>
Return compactly: 1) the fix for each numbered item; 2) files changed; 3) verification results; 4) remaining gaps.
</structured_output_contract>
