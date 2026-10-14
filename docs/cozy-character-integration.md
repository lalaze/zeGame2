# Cozy two-character integration — 2026-10-14

## Production mapping

The original approved owner PNG is rendered by the shared character resolver for role `owner` with exactly `{ skin:0, hair:0, hairStyle:1, shirt:2, pants:1 }`.
The existing character editor and new-café flow expose **Use cozy owner look / 使用样板店主造型**. Selecting it changes the editor draft; the normal Save/Next flow applies it. Cancel preserves the existing profile.
Other looks and roles retain their existing reference artwork. No saved profile is silently rewritten.

The user subsequently requested replacing an old guest with the new artwork. The new guest replaces only ordinary cast slot **1 (海盐条纹)**, which has no regular-guest story. The same slot, appearance ID and saved visits remain; its 18 visual frames now use guest.png. The other 29 guest appearances and all 12 named story characters remain unchanged. No source PNG was deleted.

## Runtime

- `preloadReferenceCharacters()` also awaits both approved atlases and their manifest before production scene initialization.
- The newly allocated frames are repainted before the resolver publishes them into its cache or Phaser creates textures.
- All 18 frame entries use the approved sample crop/fit, with 3× artwork, transparent margins, four directions and seated poses.
- Frame contacts are recomputed from the new paint geometry; logical seat anchors remain unchanged. Owner seating/petting are not current gameplay paths.
- Clearing character resources fences pending loads and clears the new atlas. Loading errors reach the existing retry flow.
- PNG source bytes, gameplay, furniture, customer IDs, and saves are unchanged.

## Verification

Actual host Chrome with a fresh temporary profile, through the existing Vite preview:
- New-café flow → choose preset → actual production game canvas and owner at counter.
- All 18 owner frames nonempty, with no opaque outer-edge pixels.
- Resolver cache stable; other roles and each changed look field excluded.
- Editor cancel preserves profile; skin customization visibly changes the preview; repeated preset returns identical pixels.
- Save and reload preserve the owner icon.
- 390px viewport: document width 390px, no horizontal overflow.
- No app runtime exceptions.
- Guest slot 1 spawned through the real Sim in a fresh browser test profile and painted by the actual main-game CafeScene; all four walk directions, both table seats and table/chair occlusion checked. This controlled pose test freezes only that temporary test simulation; it does not change source gameplay or the user's save.
- All 18 guest frames nonempty, no opaque outer-edge pixels, recalculated contacts present.
- Temporary test profiles cleaned. A test-harness wait initially queried a loader already removed by the app; corrected and rerun successfully. The contact assertion also needed to import the exact Vite timestamped reference module used by sprites, rather than loading a second module instance; the corrected check passed.

Reproduce the focused browser check with an existing dev server on port 5173 and Google Chrome installed:
`node scripts/cozy-owner-integration-qa.mjs`
`node scripts/cozy-guest-integration-qa.mjs`

This is focused browser verification, not a full-project test, full typecheck, or production build. Those aggregate commands were not run in this round.

## Seated visual correction — follow-up

The prior nonempty/edge/contact checks did not establish a natural-looking seated composition. Inspection of the actual source sitRight/sitLeft pixels showed usable upright poses; no regeneration was needed. The old 18×29 envelope, guessed anchor and fixed upper-body foreground crop made the new guest appear compressed against the table.

New artwork alone now has a 24×34 seated envelope, a 1.2 seated scale multiplier, source-relative hip (.35/.65, .79), and upper-body foreground boundary (.57). CafeScene places that hip at the chair cushion rather than reusing the old frame origin. The sitter is stable rather than bobbing off the cushion. Other cast, table/chair art, layout, simulation and source PNGs are unchanged.

Actual isolated host Chrome: both production seats captured at normal view and enlarged detail, browser run exit 0, all 18 guest frames nonempty/unclipped, mobile width 390, no runtime exceptions. `scripts/cozy-seated-visual-qa.mjs` saves normal-view screenshots to the OS temporary directory. Screenshot inspection remains necessary; technical frame assertions alone are insufficient.

Additional checks were NOT all green: `characters.test.ts` passed 8/8; the two selected CafeScene suites had 21 failures / 10 passes (null legacy petContact in 20 tests, missing mocked setScale in 1). Their pre-change failure status was not established, and they were not changed to hide failures. Full tsc --noEmit exited 1 for missing Node types in test files; all 20,504 log characters were read. No dependency installation, full test suite or production build was performed. These are explicit remaining validation limits.


## Seated artwork redesign v2 — 2026-10-14

Following the explicit request to redesign the seated appearance, a new independent four-pose atlas was generated with built-in image generation and integrated at `public/art/generated/cozy-character-sample-v1/seated-v2.png` (SHA256 `8b08219573cd7fd3539d561b86fa7a7cad11c8fd90214787aa8d107c4ff16b8e`). Top row owner right/left, bottom row guest right/left. Normal sitRight/sitLeft use new artwork; walking, standing and petting frames continue using the original unchanged atlases.

Design prompt: preserve bun/olive-apron owner and long chestnut-haired/rust sweater guest identity and warm rounded pixel style; redraw seated silhouettes with slightly overhead three-quarter view, relaxed upright torso, projecting thighs, bent knees, separate grounded shoes and forward bent forearms. Four isolated transparent sprites, no furniture or props. This is a redesigned sample rather than another layer-only patch.

Actual verification: `node scripts/cozy-seated-visual-qa.mjs` exited 0. Eighteen guest frames nonempty, no opaque edge clipping, contact metadata present; real Chrome game captures at both seats; zero runtime exceptions; mobile width/scroll width both390; temporary Chrome profile removed. Visually inspected actual left/right guest game captures. Forearms read near lap/front tablecloth, not proven tabletop hand contact. Owner normal seated atlas crops are integrated but owner seated game scene was not independently captured. No production build or broad tests were rerun. Earlier test/typecheck failures remain unresolved and no clean-baseline proof was established.
