# Chair approach obstruction: reproduced and repaired

## Finding

The pre-correction balance pilot found a placement/navigation mismatch in the existing game. A fern at saved grid column 1, row 14 was accepted beside the third main-room table. Its physical footprint was `(8,192,16,8)` at the minimum 240px scene height. The table's left chair approach is `(25,187)`. Navigation requires an 8px furniture margin, so that approach lies inside the padded fern footprint.

Furniture placement had reserved space only through table center Y + 14. The approach is at Y + 13 and needs the same 8px clearance. A legal placement could therefore leave a guest indefinitely in `toSeat`, and natural closing could never finish.

## Preserved reproduction

- Origin: `../results/pre-correction/pinned-baseline-pilot-v1.json`, common-assets/mid/base/coffee/plain.
- Exact original ownership and source hash are preserved in `blocked-chair-fixture.json`.
- RNG: seed 1592594996, unsigned 32-bit LCG `imul(seed,1664525)+1013904223`, divided by 2^32.
- Real `Sim`, 0.05-second ticks, 180 seconds open, then `beginClosing`, with a 300-second diagnostic drain cap.
- Menu: cappuccino. Day 10, neutral/empty reviews, all fixture stock bought through forecast/restock, tutorial goals excluded.
- The initial three regressions failed before the repair; `before.log` records the failures. Guest 18 was stuck in `toSeat`, seat 4, at `(141,145)`, with journey `[(25,187),(25,175)]` and `pathBlocked=true` after the full drain cap.

This is simulation-fixture evidence, not a browser screenshot or a fresh-save playthrough. The earlier baseline pilot remains preserved; its later comparison fixture uses wall artwork and is separate from this gameplay repair.

## Minimal repair

`src/game/furniture.ts` now reserves the existing table rectangle through Y + 21 (13px chair approach + 8px clearance), rather than Y + 14. Table positions, seat positions, navigation, customer timing, and the simulation engine are unchanged.

- New placements and moves cannot cover the chair approach.
- The next main-room table's reserved footprint gets the same protection before purchase.
- Existing save loading and table-upgrade eviction already call the placement validator; old obstructions go into storage, retaining the purchased asset rather than deleting/refunding it.
- A stored object contributes no comfort until placed again, matching normal storage behavior.
- The same fern remains placeable nearby at column 1, row 15.

## After verification

`after.log` records six passing dedicated regressions:

1. Reject the offending placement and keep the nearby safe placement available.
2. Load an old arrangement, store its fern exactly once, and retain money, recipes, staff, cats, and rooms.
3. Check every legal one-cell floor position against every chair-approach clearance in all dining rooms at 240px and 360px scene heights.
4. Restore the actually blocked guest's saved simulation after removing the obstruction through normal save loading; the pending visit completes and contributes exactly one additional served guest.
5. A non-persisted, consume-once load notice tells the player that furniture moved to storage for chair access. Valid arrangements and three consecutive normalized reloads produce no new notice or duplicate transfer; cash is unchanged. The notice is shown in English/Chinese after the café is visible, and the repaired arrangement is saved immediately.
6. Replay the original paid fixture after safe eviction. Natural closing finishes in 12.15 seconds, with 58 served and the fern retained in storage.

The broader navigation, spatial layout, save-session, arrange-focus, preparation and café-style UI regression run passed 81 tests across seven matched files before the added saved-visit regression. Type checking and whitespace checks also passed at that checkpoint. The final aggregate suite should be run after all concurrent café-style work is complete.

Reproduce the dedicated check with:

```sh
CHAIR_ACCESS_EVIDENCE=1 npx vitest run src/game/chair-access.test.ts --reporter=verbose
```
