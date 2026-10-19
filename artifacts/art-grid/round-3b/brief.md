<task>
Repository: /Users/lalaze/.paseo/worktrees/2h96yp2x/joyful-sloth (branch joyful-sloth). Do NOT commit and do NOT use git stash; preserve all uncommitted work.

Your previous round (docs/art-grid/extension-room-redraw.md) was reviewed in real Chrome. The glasshouse, patio, kitchen, doorway, runners, floors and the pixel thought lettering are approved; keep them. Fix the remaining reading-room problems, looking first at the real captures in artifacts/art-grid/round-3b/ (review-reading-corner.png is a 3x close-up; review-reading-day.png, review-reading-night.png, and review-glasshouse-day.png for comparison):

1. Armchairs: they are flat lilac blocks with no outline, shading, material or contact shadow, and they read as placeholders. Redraw them on the 2x grid and master palette in the reading room's warm language: rounded arms, a seat cushion, deep burgundy/rust or warm velvet upholstery, wooden feet, a one-pixel warm outline, top-left highlight, bottom-right shade and a contact shadow. Keep their anchors, size envelope and depth.
2. Floor lamp: a flat white triangle on a stick. Redraw it as a brass floor lamp with a shaded fabric shade, a base and a contact shadow. At night its lamp pool stays as it is now.
3. Tablecloth: the reading-room cream/burgundy remap is noisy. The top shows scattered speckle pixels and the drape is a coarse, busy check. Make it read cleanly: either a calm cream cloth with a burgundy border/trim, or a clean burgundy-cream check like the glasshouse sage version. Geometry, alpha, seats and seated poses stay identical (palette remap only).
4. Window light: a hard-edged translucent rectangle still sits on the floor behind the left armchair (and its twin on the right), the old smudge. Replace it with the same golden window patches the main room and glasshouse use, or remove it if a patch already covers that window.
</task>

<action_safety>
Reading room only. No changes to the main room, glasshouse, patio, kitchen, thought lettering, simulation, saves, HUD or characters. No commits, no git stash, do not delete historical assets.
</action_safety>

<default_follow_through_policy>
Keep going without routine questions; choose the most reasonable low-risk option.
</default_follow_through_policy>

<verification_loop>
Run and report: npx tsc --noEmit; npm run build; npx vitest run compared with artifacts/art-grid/foundation-test-failures.txt (zero new failures; 103 failures currently, all baseline); node scripts/pixel-conform.mjs check on any new or changed PNG. Save offline renders and a short report.json under artifacts/art-grid/round-3b/. Browser captures will be taken afterwards outside your sandbox.
</verification_loop>

<structured_output_contract>
Return compactly: 1) the fix for each numbered item; 2) files changed; 3) verification results; 4) remaining gaps.
</structured_output_contract>
