<task>
Repository: /Users/lalaze/.paseo/worktrees/2h96yp2x/joyful-sloth (git worktree, branch joyful-sloth). "Tiny Bean Café", a Phaser 4 + TypeScript cozy pixel-art café game (Vite). Do NOT commit and do NOT use git stash; the working tree holds uncommitted work that must be preserved.

Background: the world uses ONE art grid (2 art px per room px) and a master palette; read docs/art-grid/README.md first (rules, tools, backlog item 5). The rooms were already redrawn and approved (docs/art-grid/main-room-redraw.md, docs/art-grid/extension-room-redraw.md). Legacy 3x/4x sprites are currently resampled to 2x at runtime by worldSpriteArt (src/render/world-art-grid.ts); that costs detail, and new art must be native 2x.

The problem: the customer cast is drawn in a different style from the staff. artifacts/art-grid/round-4/cast-before.png shows owner, barista, server and cook, then all 30 guests (standing and seated) exactly as the game draws them now. The staff (public/art/generated/cozy-team-v7/) are chibi, about 2.5 heads tall, with big round heads, soft warm-brown outlines, simple clear faces (dark eyes with a highlight, small blush), calm flat shading lit from the upper left. The guests (public/art/generated/cozy-cast-v4/: 12 outfit families x 12 poses plus a 24-pose head sheet, composited and recoloured at runtime in src/render/cozy-cast-art.ts) are taller and thinner with smaller heads, hard dark broken outlines, noisy hair and mushy faces. Every guest with glasses (0, 7, 11, 15, 17, 21, 26) reads as wearing an opaque black band. Guest 1 (the separate sample guest, src/render/cozy-character-sample.ts) is a third style.

Your job: redraw the guest cast so it belongs to the staff family.
1. Same proportions, outline colour/weight, face language and shading as the staff, natively at 2x (each frame authored at its logical size x 2 and registered at density 2, so worldSpriteArt does no resampling for guests).
2. Keep every guest's identity from src/game/customer-cast.ts (CUSTOMER_CAST: outfit, hairstyle, accessory, accent colour, and the skin/hair/cloth/pants look recoloured at runtime). The twelve named regulars (story characters) keep their fixed cast slots and must stay recognisable. Guest 1 joins the same style.
3. Glasses become thin warm frames with the eyes visible. Bows, headbands and satchels stay readable at game size.
4. Keep the full pose set and its behaviour: four walking directions with their walk frames, standing, seated left/right (hips on the chair cushion, hands reaching the table, correct occlusion with chair and table), the petting poses, and cup carrying. Recalibrate contacts/anchors (foot, head, hip, cushion, hand, pet contact) so placement, seating and tap targets stay correct; standing height stays in the shared furniture-relative band the staff use (see src/render/character-proportions.ts and existing proportion tests).
5. Source art: use your image generation with the staff sheets (public/art/generated/cozy-team-v7/*.png) and public/art/generated/cafe-style-sample-v1/sample.png as style references, then conform every runtime frame/sheet to its exact 2x size on the master palette with node scripts/pixel-conform.mjs conform, and make node scripts/pixel-conform.mjs check pass. Put the runtime pack in a new versioned folder public/art/generated/cozy-cast-v5/ (manifest compatible with the adapter, or adapt the adapter), with sources, prompts and hashes under assets/generated/cozy-cast-v5/, like earlier packs. Keep cozy-cast-v4 files as history; switch the runtime to v5.
If time is short, prioritise in this order: the shared body/face style for all twelve outfit families and the heads; then glasses; then guest 1. Report exactly what remains.

Relevant code: src/render/cozy-cast-art.ts, src/render/reference-character-art.ts (resolver), src/render/cozy-character-sample.ts, src/render/cozy-seating-art.ts, src/render/character-proportions.ts, src/render/sprites.ts, src/render/phaser/cafe-scene.ts (seated/walker drawing), src/game/customer-cast.ts, and their tests.
</task>

<action_safety>
Characters only: do not change the approved rooms, signage, lighting, HUD, simulation, economy, progression, routes, seats or save formats; customer IDs and saved appearances stay valid. Do not delete historical asset packs. No commits, no git stash.
</action_safety>

<default_follow_through_policy>
Keep going without routine questions; choose the most reasonable low-risk option.
</default_follow_through_policy>

<completeness_contract>
Resolve the task fully before stopping, including tests updated for intentionally changed contracts (explain each). If something cannot be completed, state exactly what remains and why.
</completeness_contract>

<verification_loop>
Run and report: npx tsc --noEmit; npm run build; npx vitest run compared with artifacts/art-grid/foundation-test-failures.txt (103 tests currently fail, all in that list; zero new failures). node scripts/pixel-conform.mjs check on every new runtime PNG. Your sandbox cannot run Chrome or bind a server: render an offline roster of the four staff roles and all 30 guests (standing and seated, at game scale) to artifacts/art-grid/round-4/cast-after-offline.png, inspect it against cast-before.png and the staff, fix what looks wrong, and write artifacts/art-grid/round-4/report.json. Browser captures will be taken afterwards outside your sandbox.
</verification_loop>

<structured_output_contract>
Return compactly: 1) what was redrawn and how; 2) files and asset packs added or changed; 3) verification results; 4) remaining gaps.
</structured_output_contract>
