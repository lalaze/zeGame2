1. **Redrawn:** All twelve outfit families and 24 head poses now serve all 30 guests, including guest 1, in native 2× art. Added warm outlines, clear highlighted eyes, hollow glasses, readable accessories, and recalibrated seating/petting/carry contacts. Saved identities remain unchanged.

2. **Files:** Runtime pack: `public/art/generated/cozy-cast-v5/`. Sources, prompts and hashes: `assets/generated/cozy-cast-v5/`. Updated cast/resolver/seating adapters and scene contact handling. Historical packs and existing uncommitted work preserved; no commits or stash.

3. **Verification:** TypeScript and build pass. All 13 runtime PNGs pass palette checks; all 540 guest frames remain native 2× without world resampling. Vitest: **2,504 passed, 103 existing failures, zero new failures**. Updated the obsolete leg-transform test contract.

4. **Evidence / gaps:** Inspected `artifacts/art-grid/round-4/cast-after-offline.png` and `artifacts/art-grid/round-4/seating-after-offline.png`. Full results: `artifacts/art-grid/round-4/report.json`. Remaining: outside-sandbox browser captures and live transition, pet/cup playback, and tap-target checks; no browser/server was started.