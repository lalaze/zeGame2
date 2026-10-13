# Generation-first push checkpoint — 2026-10-13 10:37 UTC

The user requested all asset generation, then code push, then integration validation. This checkpoint preserves the existing playable implementation and adds independent authored candidates only.

## Verification

- All 242 `src/` files are byte-identical to the 09:16 source archive. No source additions since that tested checkpoint.
- Last full test result: **1521 passed, 28 skipped**; production build passed. Logs: `tests-food-bitmap-postreview.log` and `build-food-bitmap-final.log`. These tests cover current code, not later candidate images.
- Final staged source audit: **60 manifests, 896 crops, zero source-integrity errors** in `BULK-STAGED-SOURCE-INTEGRITY.json`. Exact pixel rectangles, dimensions and opaque QA bounds were checked again after path relocation.
- Exactly six failed parameter back poses are isolated in `assets/generated/bulk-candidates/parameter/failed-frames/`. Their authored source pixels are intact but their appearance is incorrect. Zero custom Looks are certified.
- All selected candidate image SHA-256 hashes match their frozen originals. Images total 444,001,144 bytes; source/crop breakdown and per-file hashes are in the candidate freeze manifest.

## Commit scope

Preserve existing tracked/recovered content and current validated WIP, adding the isolated `assets/generated/bulk-candidates/` folder and audit/documentation changes. Do not modify this active checkout's index or history. Use the separate push worktree based on the confirmed remote restored commit `8b2079086b07f67a7e9b1d2a62997f966b874bc7`.

Exclude only these 13 unrelated old QA files, preserving them in the active tree:
- `docs/playtest/2026-10-12/fixtures/advanced.json`
- `docs/playtest/2026-10-12/fixtures/all-stories.json`
- `docs/playtest/2026-10-12/fixtures/first-day.json`
- `docs/playtest/2026-10-12/fixtures/fresh.json`
- `docs/playtest/2026-10-12/fixtures/funded-start.json`
- `docs/playtest/2026-10-12/fixtures/insolvency.json`
- `docs/playtest/2026-10-12/fixtures/legacy-v10.json`
- `docs/playtest/2026-10-12/fixtures/live-service.json`
- `docs/playtest/2026-10-12/fixtures/price-boundary.json`
- `docs/playtest/2026-10-12/fixtures/pricing.json`
- `docs/playtest/2026-10-12/generate-fixtures.mjs`
- `docs/playtest/2026-10-12/harness.html`
- `docs/playtest/2026-10-12/regulars-recheck-directory.txt`

Git metadata, ignored build/dependency directories, independently preserved rejected Blender/layer experiments and the incomplete staging copy outside the repository are excluded. Candidate manifests/README explain omitted duplicate proofs and superseded images. Necessary final originals and exact crop coordinates are retained.

## Acceptance still open

Read the candidate `KNOWN-GAPS.json`. Main-room/all-scene visual approval, full identity coverage, signature-drink clipping/registration, animation contacts, kitchen overlays, tile seams, reduced-motion/hidden-tab behavior and controlled phone/loading benchmarks are not certified by generation. After successful remote push readback, integration must proceed in explicit batches with actual game verification.
