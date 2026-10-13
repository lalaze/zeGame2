# Play-flow design

Final design: 90-second, unit-mean, ±10% traffic waves with context-preserving service/pantry shortcuts. Final release-source checks and package verification are still being completed; this document describes the implementation and reviewed economic decision.

## Existing behavior preserved

- Customer intervals retain the existing jitter draw `(0.5 + rng()) / arrivalRate`. The average arrival formula still includes assets, variety, reputation, pets, style and paid promotion; forecasting keeps that average.
- `dayTime` and the existing spawn timer are already persisted. No additional save-schema field, offline advancement or ongoing timer is introduced.
- Service help uses the existing 0.3-second brew boost and 1-second cooldown. Automatic staff behavior and the lack of mandatory tapping remain unchanged.
- Operations feedback retains its existing debounce and ingredient/delivery/baking/shelf/counter/quiet interpretation.
- Pantry purchases, restock quotes, menu edits, research and recipes continue to use existing gameplay APIs and phase restrictions.
- Dialogs and background state keep their existing pause/interaction guards. Shortcuts do not bypass modal, arrange, panning or inactive-session restrictions.

## A. Calm and busy intervals

A deterministic envelope repeats every 90 active opening seconds:

- 0–30s: calm at 0.9 of average intensity
- 30–45s: linear rise from 0.9 to 1.1
- 45–75s: busy at 1.1
- 75–90s: linear easing from 1.1 to 0.9

The integral is `30×0.9 + 15×1 + 30×1.1 + 15×1 = 90`; two cycles fit the ordinary 180-second forecast window. Hard bounds are 0.9–1.1. Opening starts calm. The implementation integrates phase progress across each update interval, preserving boundary behavior while retaining the existing renewal jitter and one-arrival-per-update contract.

Only the open-shop spawn clock receives this multiplier. Prep/closing behavior, manual opening/closing, average forecast formulas and existing random-draw count are preserved. There are no wave-specific rewards, price changes or patience changes. A unit-mean envelope is not a promise of identical realized arrivals: service paths, reputation, promotion/care and RNG consumption can diverge.

The initial ±20% candidate failed several pilot review thresholds and an existing menu-ranking benchmark. Its source and evidence remain retained. The final ±10% candidate was frozen before the full 30-seed matrix; no further amplitude selection was made against pilot noise.

## Traffic visibility

During opening hours, both the current and next phase are shown persistently, rather than requiring hover or opening a dialog:

- Desktop: compact text in the footer beside the service actions, outside the café scene
- Mobile: the existing clock dock outside the canvas, avoiding a second large information row

The existing service details/accessibility description can explain the next transition. Prep and closing do not present an active arrival-wave preview. Labels are localized in English and Chinese, descriptive and non-alarming. They do not guarantee customer counts, demand urgent tapping or create an order-priority minigame.

## B. Frequent actions and return path

- Help serve: a visible, keyboard-accessible equivalent of the existing scene interaction. It preserves phase eligibility, the boost amount, cooldown and automatic service.
- Pantry: enter the existing stock/restock UI directly, including actionable ingredient-shortage context. Quote, purchase and remaining money continue through the existing paid APIs; navigation never buys automatically.
- Return: the temporary pantry task remembers the prior tab/category, quantity, scroll, focus and expanded/collapsed state. Its Back/Close/Escape path returns to that context, including returning a previously collapsed panel to the café.
- A closing interruption replaces stale shortage guidance with neutral phase-appropriate context. Navigation must not imply that closing stock actions or menu edits gained new permissions.
- Every activation checks current phase/interaction guards. Rendering an enabled control earlier does not authorize a later invalid action.

The action strip stays outside the scene and reuses the existing responsive layout. Targets are designed for at least 44×44 CSS px. Existing management tabs and purchasing logic are not duplicated.

## Economic validation and accepted limits

The frozen protocol and all raw evidence are in [BALANCE-PROTOCOL.md](BALANCE-PROTOCOL.md) and [BALANCE.md](BALANCE.md).

- Main scope: all six focused paid route portfolios × early/mid/late × base/rush, plus fresh-save and signature-heavy base/rush sanity panels. In total, 39 scenarios × two horizons × 30 paired seeds = 4,680 simulations.
- Primary endpoint: exactly 180 seconds open. Carryover endpoint: exactly 1,800 elapsed seconds, including closing drain and subsequent openings. No terminal drain, prospective sale credit or inventory salvage is invented.
- Report consumed-input operating profit, actual cash and inventory reconciliation, served/missed/door losses, closing removals, pending guests, last-50 reputation, queue/wait diagnostics and arrivals by phase. Initial states and first-update fingerprints match across versions.
- Original review thresholds remain unchanged: >5% mean operating-profit decline, >2pp observed loss-rate increase or >0.1-star rating decline. Three main short-window cells are flagged and retained.
- Early/rush bakery and community short-window profit flags are realized VIP payout differences with identical per-seed served counts/input costs; independent holdout does not reproduce the profit losses.
- Mid/rush bakery short-window stockout/rating deterioration repeats directionally in independent holdout. A single paid restock at 90 seconds does not change its served/lost/rating outcomes. The evidence is consistent with batch/shelf supply timing; do not claim that the pantry shortcut removes this production limit.
- Original 1,800-second mean-profit changes range −2.26% to +1.17%, supporting no clear sustained overall operating-profit deterioration in the tested scope. This is not an equivalence guarantee: early/rush bakery holdout still has a near-threshold long-window rating decline of −0.098 stars.

The decision is to retain ±10% with the localized high-pressure bakery tradeoff disclosed. No prices, patience, inventory policy, review gates or unfavorable scenarios were quietly changed. See [BALANCE-FLAG-REVIEW.md](BALANCE-FLAG-REVIEW.md), [BALANCE-HOLDOUT-RESULTS.md](BALANCE-HOLDOUT-RESULTS.md) and [BALANCE-MECHANISM-RESULTS.md](BALANCE-MECHANISM-RESULTS.md).

## UI and recovery verification

Verify English/Chinese at desktop and 390px: persistent current/next phase visibility; help; shortage → pantry → actual paid buy → return; tab/category/quantity/scroll retention; close/back/Escape; repeated taps; dialog interruption; live menu restrictions; prep/open/closing; reload in each traffic phase; native tab background pause; and a fresh save through first settlement.

Logs and screenshots must distinguish synthetic advanced fixtures from fresh-save play, and CSS viewport emulation from a physical device. [BROWSER-QA.md](BROWSER-QA.md) and [REVIEW.md](REVIEW.md) are the final verification destinations and are being finalized. Earlier focused/full-suite passes are not a claim that final packages have already passed extraction and release checks.
