# Independent review of the three local UI fixes

Reviewed the final working-tree changes on 2026-10-12. No remaining code-review blocker was identified. This review did not change production source, commit, or push. Existing playtest evidence was preserved.

## Scope and conclusions

- Transaction prices and balance now use a separate presentation formatter. Fractional values retain useful precision, rounded/compacted values are marked with `≈` when they are not numerically exact, tiny nonzero amounts use scientific notation rather than becoming zero, and the detail dialog exposes the original JavaScript number. The original compact statistics formatter and economic calculations are unchanged.
- Money details remain available independently of a disabled purchase button. At activation they obtain the current item/upgrade quote or ingredient price and the current balance synchronously. The HUD uses a native button, existing modal focus containment, and the existing native-keyboard handling.
- Cat mode, filter, and selected ID are transient state owned by `Panel`, retained across tab changes, `Panel.refresh`, locale rebuilds, and state replacement. They are not added to `GameState` or serialized. Invalid selections fall back within the visible catalog group; empty owned views remain reachable. Adoption keeps the chosen cat visible and moves focus off its newly hidden adoption control.
- Both locale labels explicitly identify today's revenue. The responsive CSS retains a 44px mobile balance target and allows the revenue line to wrap. Actual 360px layout and native keyboard/touch activation require the separate browser QA; happy-dom has no layout engine.

## Findings raised and resolved

1. The initial amount-details handler captured the preceding throttled UI quote but read the latest balance. A sale between updates could therefore show a stale Max price beside a current balance. `src/ui/panel.ts:904–911` now requotes at activation; a regression test increases the balance without calling `panel.update()` and checks the live Max price.
2. The initial balance-button rule overrode the existing mobile 44px touch target with 32px. The mobile rule now explicitly restores 44px (`src/style.css:2080`).
3. An initial unit test dispatched Escape and then called `closeModal()` manually, which did not prove the Escape route. It now accurately tests programmatic close/focus restoration and leaves native Enter, Space, and Escape behavior to browser QA.

## Independent verification

- `git diff --check`: passed.
- `npm test -- src/game/format.test.ts src/ui/money-details.test.ts src/ui/panel-money.test.ts src/ui/pets-browsing.test.ts src/ui/panel-browsing.test.ts src/ui/kitchen-upgrade.test.ts`: 6 files, 58 tests passed against the corrected Max handler.
- These are focused checks, not a claim of full-suite, build, real-browser, or physical-device coverage. Full-suite/build and browser results are reported separately.
