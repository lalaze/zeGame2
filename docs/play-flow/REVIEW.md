# Independent play-flow code review

- Review date: 2026-10-12 (UTC)
- Report finalized: 16:04 UTC
- Comparison baseline: `1557f1641922ca7afd897116bfb56b77c6d48194`
- Reviewed target: the isolated `zeGame2-play-flow` working tree, including the final Pantry context and keyboard-interruption fixes.

## Conclusion

**No remaining confirmed defect was found within this review's scope.** Two P2 findings were reported, repaired by the implementation owners, and independently rechecked. This is a source and focused-test conclusion, not a claim of exhaustive browser coverage or economic equivalence.

At the report handoff, the coordinator's final full-suite and production-build runs were still in progress; their results are separate acceptance evidence.

## Scope and verified behavior

- Reviewed `src/game/traffic.ts`, its `Sim.update` integration, traffic status presentation, `src/ui/play-flow.ts`, `src/ui/play-flow-context.ts`, the new Panel browsing APIs, and their integration in `src/main.ts`, CSS and EN/ZH strings.
- Read the play-flow design, plan, progress and economic protocol, together with the relevant focused tests and legacy fixture changes.
- Traced startup ordering: no new temporal-dead-zone execution path was found in PlayFlow initialization or its registered callbacks.
- Verified that the bounded 90-second traffic envelope is applied only to the open-shop arrival clock. The HUD uses the same persisted `dayTime`; prep/closing behavior, saved arrival timers, phase boundaries and no-offline-advance behavior are covered by focused tests. The mean-rate forecast, price, patience and purchase APIs are not replaced or retuned by this feature.
- Verified that scene help and the new Help button use the same existing `Sim.boost()` path and persisted cooldown. The feature adds no second service reward, purchase implementation or independently accumulating help timer.
- Checked activation-time phase, modal, background visibility, onboarding, save-session and scene-state gating, plus existing live menu-edit restrictions.
- Checked transient collapsed-panel restoration, tab/category/purchase-quantity/Cats browsing state, desktop/mobile catalog-relative scroll, stable focus and disabled-control fallback. Real Pantry purchases remain committed when the browsing context is restored.
- Checked refreshed shortage context and literal player-assigned signature names, repeated entry, modal interruption, settlement, state replacement, reset and newer navigation. Explicit newer Panel navigation, collapse or arrangement intent discards the old return route.
- Reviewed the final Enter-release guard: focus loss permanently cancels that physical press's pending navigation, repeats remain blocked until release, and keyup/window blur/hidden/destroy paths remove the temporary listeners. Space release and assistive-technology click behavior remain covered by tests.

## Findings and dispositions

### P2-1: Closing incorrectly announced that missing stock had been replenished

Original location: the inline `pantryContext` callback in `src/main.ts`.

Reproduction: open the shortage Pantry with a required ingredient at zero, then close the shop while the Pantry task remains open. `operationStatus()` prioritizes `closing` over ingredient diagnosis, but the original UI treated every non-ingredient status as resolved. It therefore announced that the current menu had its ingredients again without a purchase.

**Fixed and rechecked.** The UI-only `pantryTaskContext()` helper now handles closing explicitly (`src/ui/play-flow-context.ts:9–12`) with neutral closing-stock guidance. The non-shortage fallback also avoids promising replenishment. EN/ZH closing-zero-stock and refreshed-stock tests passed. No simulation/economic source change was required for this repair.

### P2-2: A modal round trip could revive a deferred Enter navigation

Location: `PlayFlow.deferPantryEnter()` in `src/ui/play-flow.ts`.

The first Enter hardening deferred focus-changing Pantry/Back navigation until keyup. An independent regression probe demonstrated a remaining interruption bug: hold Enter on Back, open and close a modal, let focus return to Back, then release Enter. Checking only the current focus, return point and navigation epoch allowed the old Back action to run after the modal interruption.

**Fixed and independently reproduced as passing.** The per-press `focusInterrupted` flag now permanently cancels that pending intent after the Pantry button loses focus (`src/ui/play-flow.ts:102,124,130–137`). Returning focus does not revive it. The repeat guard remains until release, and its teardown removes the added blur listener as well. Four repository cases cover Pantry/Back crossed with a modal round trip or focus leaving and returning. A genuinely new press remains usable.

The earlier concern about native held Enter reaching a restored purchase control was initially a source-derived browser risk, not a claimed browser reproduction. The reviewed release-boundary guard addresses that path; native browser/device validation remains the coordinator's separate QA scope.

## Legacy fixture changes

- `chair-access.test.ts`: replaces a timing-dependent guest ID with identification of the actually blocked guest, while asserting the affected seat, restored unblocked state, served result and that same guest's cup.
- `merge-runtime.test.ts`: removes modern regular-guest identity fields when constructing a genuine version-1 fixture whose appearance fields were already removed.
- `settlement-advice.test.ts`: replaces traffic-dependent exact visit counts with the ledger identity for ingredients consumed by timed-out espresso orders; unrecovered-cost advice and action assertions remain.
- `style-persistence.test.ts`: aligns future RNG draws on original and restored simulations before exact continuation comparisons. It retains served/revenue/handoff, paid-state and idempotent-settlement assertions.

These changes preserve the substantive regression contracts rather than suppressing failing behavior.

## Commands and observed results

Commands were run from the isolated candidate checkout. Repeated suites below are reruns, not additional unique tests.

1. Initial traffic, PlayFlow and changed-fixture checks: **7 suites, 116 tests passed**.

   ```sh
   npx vitest run src/game/traffic.test.ts src/ui/traffic-status.test.ts \
     src/ui/play-flow.test.ts src/game/chair-access.test.ts \
     src/game/merge-runtime.test.ts src/game/settlement-advice.test.ts \
     src/game/style-persistence.test.ts --maxWorkers=2
   ```

2. Adjacent browsing, interaction and initial context-helper checks: **7 suites, 89 tests passed**.

   ```sh
   npx vitest run src/ui/panel-browsing.test.ts src/ui/pets-browsing.test.ts \
     src/ui/first-tools.test.ts src/ui/mobile-layout.test.ts \
     src/ui/cafe-interaction.test.ts src/ui/dialog.test.ts \
     src/ui/play-flow-context.test.ts --maxWorkers=2
   ```

3. Final keyboard-interruption repair and context-helper rerun: **2 suites, 52 tests passed** (49 PlayFlow cases and 3 context-helper cases).

   ```sh
   npx vitest run src/ui/play-flow.test.ts src/ui/play-flow-context.test.ts --maxWorkers=2
   npx tsc --noEmit
   git diff --check
   ```

   Typecheck and diff check also passed.

4. Independent modal-round-trip probe, kept outside the repository: **failed before the P2-2 repair; passed after it**. The filtered run executed one probe; the copied fixture's other 45 cases were intentionally skipped.

   ```sh
   /workspace/shared/zeGame2-play-flow/node_modules/.bin/vitest run \
     --root /workspace/shared/play-flow-design review-enter-interruption.test.ts \
     -t 'independent interrupted Enter probe' --maxWorkers=1 --globals
   ```

   This external diagnostic is not a packaged product test. The equivalent interruption regressions are now in `src/ui/play-flow.test.ts`.

## Limits

- No browser, port 5304 session, physical device or native keyboard automation was used by this reviewer. Happy-dom tests explicitly model the native Enter-keydown/Space-keyup click defaults; they do not substitute for real-browser layout or accessibility QA.
- No expensive balance matrix was run by this reviewer. The code review confirms the narrow implementation scope, not absence of economic deterioration. A unit-mean analytic envelope does not guarantee identical realized arrivals, profits, losses or ratings. Economic flags and their dispositions belong to the separate paired-run evidence.
- The original `zeGame2` source tree and gameplay were not edited. Apart from this requested report, review-only diagnostic writes were confined to the separate design directory; implementation fixes were made by their owners.
