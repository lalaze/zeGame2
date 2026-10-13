# Tiny Bean Café: remaining menu and pantry bitmap candidates

Frozen generation handoff: 2026-10-13. No repository code changed or assets integrated by this worker.

## Coverage

- `manifest.json`: all 50 remaining static menu IDs, each generated individually using the built-in imagegen tool.
- `ingredient-manifest.json`: all 12 pantry ingredient IDs, each generated individually.
- Existing espresso, latte, eggtart, croissant and cake are reused from their accepted earlier folders; they were not duplicated here.
- `sources/`: immutable original generated PNGs.
- Root PNGs: lossless independent rectangular crops, every nonzero-alpha pixel retained.
- `prompts.json`: exact final prompts for all 62 independent calls.
- `source-paths.json`: original tool-output paths.
- `coverage-ledger.json`, `audit.json`, `SHA256SUMS.txt`: final coverage, authoring checks and file checksums.

## Integration contract

All assets have real RGBA transparency. Alpha greater than 128 measures the visible object bounding box only; it is never used to delete pixels. Anchors are the bottom-center of that measured object box. Preserve native aspect and use the declared old logical envelope. Some source images have very faint translucent halos extending farther than the visible object; those pixels are retained and need checking against the actual game backdrop. No image was resized, recolored, alpha-masked, redrawn, or background-cleaned with code.

Cup handles are consistently on the right. Low mugs, glass tumblers, tall drinks, food shapes, toppings and distinct ingredient containers preserve identity rather than recoloring one generic symbol. Food portions may include their integral saucer/wrapper or the compact serving described in the prompt. No labels, prices, timers, stock counts, serving trays, furniture, ground planes, or scene backgrounds were generated.

## QA status

Every generated output was visually inspected for its named identity and full-object composition. All 62 are authoring candidates pending in-game rendering review, not runtime-accepted assets. The authoring audit verifies exact coverage, PNG modes, genuine transparency, bbox registration, lossless crop equality, complete retained alpha and original-source hashes.

Known review considerations: low-opacity perimeter halos on some assets; differences in generated source resolution; tall drink silhouette fitting inside the original compact envelope; readability of small toppings after runtime downsampling. These are explicit runtime review points, not hidden claims of completed integration.

Source folders for reused items:
- `/workspace/scratch/30a3201ff9cd/cafe-main-menu-v1/`: espresso, latte, eggtart
- `/workspace/scratch/30a3201ff9cd/cafe-assets-v2/`: croissant, strawberry-cake (menu ID cake)
