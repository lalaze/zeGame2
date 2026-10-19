<task>
Repository: /Users/lalaze/.paseo/worktrees/2h96yp2x/joyful-sloth (git worktree, branch joyful-sloth). "Tiny Bean Café", a Phaser 4 + TypeScript cozy pixel-art café game (Vite). The scene is a canvas; the HUD, side panel, drawer, dialogs and buttons are plain HTML/CSS over it (src/style.css, src/ui/*.ts). Do NOT commit and do NOT use git stash; the working tree holds uncommitted work that must be preserved.

Background: the game world was redrawn on one 2x art grid with a master palette (docs/art-grid/README.md, main-room-redraw.md, extension-room-redraw.md, and the cast redraw notes in docs/art-grid/). The world now reads as warm, shaded pixel art: walnut and honey wood with brass, cream walls, sage, warm chestnut outlines, upper-left light. The HTML interface still looks like a flat web form laid over it: pale cream rectangles with thin borders, flat buttons, and panels that float over the scene without belonging to it (backlog item 7).

Current state, look at each PNG first: artifacts/art-grid/round-5/ui-before-*.png (desktop 1440x1000, phone 390x844, an open management drawer, a dialog, onboarding).

Your job: restyle the interface chrome so it belongs to the redrawn world, without changing what it does.
1. Frames: panels, drawer, dialogs, HUD plates and chips get pixel-art frames in the café materials (e.g. a walnut/honey wood frame or a brass-edged cream paper card) with one-art-pixel warm ink outlines, a top-left highlight and bottom-right shade, built from the master palette (docs/art-grid/palette.json). Use crisp pixel rendering: CSS border-image from small palette PNGs (pixelated, integer scale) or pixel box-shadows; check crispness at device pixel ratios 1, 2 and 3.
2. Buttons and toggles: raised pixel buttons with clear hover, pressed (sinks one pixel), selected, disabled and keyboard-focus states that still read on the new frames.
3. Hierarchy: the café name plate, day/status chips, money and rating plates, the right-edge tool column and the bottom action bar should read as one family, and visually lighter where they overlap the room, so they cover less of the art without shrinking touch targets.
4. Form controls are still native browser widgets in places (the blue checkbox in ui-before-desktop-dialog.png); give checkboxes, text inputs, selects, number steppers, progress bars and details/summary disclosures pixel styling that matches, keeping them accessible.
5. Typography stays on the existing pixel fonts (Pixelify Sans, and Pixel ZH for Chinese) at sizes that render crisply; keep both locales readable.
Keep all layout behaviour: fullscreen stage, room fitting, mobile drawer and its focus trap, pinch/zoom controls, overlays and pause badges, every responsive breakpoint (390x844, 320x568, 844x390, 667x375, 860x700, 1440x1000), touch targets of at least 44px on phones, and no horizontal overflow.
</task>

<action_safety>
Interface styling only: no gameplay, economy, save, text-content or canvas-art changes; do not change element IDs, data attributes, ARIA roles or labels that tests and scripts rely on. Keep colour contrast at least as good as today (src/ui/palette-contrast.test.ts) and visible focus indicators. Do not delete historical assets. No commits, no git stash.
</action_safety>

<default_follow_through_policy>
Keep going without routine questions; choose the most reasonable low-risk option.
</default_follow_through_policy>

<completeness_contract>
Restyle every panel, dialog, HUD element, form control and button state before stopping. If something cannot be completed, state exactly what remains and why.
</completeness_contract>

<verification_loop>
Run and report: npx tsc --noEmit; npm run build; npx vitest run compared with artifacts/art-grid/foundation-test-failures.txt (zero new failures; explain any test whose contract changes); node scripts/pixel-conform.mjs check on any new PNG. Your sandbox cannot run Chrome or bind a server, so describe what to verify visually and write artifacts/art-grid/round-5/report.json. Browser captures will be taken afterwards outside your sandbox.
</verification_loop>

<structured_output_contract>
Return compactly: 1) what changed for each numbered item; 2) files changed; 3) verification results; 4) remaining gaps.
</structured_output_contract>
