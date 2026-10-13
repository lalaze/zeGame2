# Frozen play-flow economic protocol, v1

Frozen before any play-flow outcome run: 2026-10-12 15:22 UTC. Baseline is the immutable reviewed signature snapshot in `/workspace/shared/play-flow-baseline`; treatment is `/workspace/shared/zeGame2-play-flow`. Original source is never edited.

## Scope, seeds, clocks

- Main matrix: all six focused `route-purchases` portfolios from the untouched `scripts/cafe-style-lab.ts`, early/mid/late, base/rush: 36 scenarios. Both versions use `setCafeStyle`, identical funding, paid portfolio, menu, progress, neutral reputation, and restock/promotion rules.
- Sanity panels: exact fresh initial state (starter beans, zero cash, neutral style, no injected tutorial rewards), plus a mid-stage paid coffee portfolio with three signature coffee drinks, base/rush. Signature recipes use paid quarter-serving trials; the small trial expense is startup expense, included in setup capital for the helper's total-wealth identity and separately reported. All three signatures are the entire menu.
- Each scenario has a 180-second primary observation and a separate 1800-second carryover observation, dt=0.05. Primary ends while still open at precisely 180 seconds. Carryover uses the existing 180-second opening and closing-drain/reopen helper contract: closing consumes the same elapsed budget, no terminal settlement/drain or future-sale credit. Comparisons never add elapsed time to finish treatment guests.
- Full seeds: 30 labels `(0x706c6179 + i * 2654435761) >>> 0`, i=0..29. Pilot seeds: `[0x70696c6f, 0x74657374]`; disjoint and never substituted into final data. Same labels do not imply event-aligned customer cohorts once RNG paths diverge.
- Pilot scope: early coffee/base, early bakery/rush, mid cats/base, mid takeaway/rush, late garden/base, late community/rush, and all three sanity scenarios, both horizons. Its only purposes are runtime estimation and early regression signals. Full scope and gates do not shrink based on results.

## Evidence and integrity

- Run the existing route helper unchanged, instrumenting `Sim.update` only with read-only before/after observations. Sanity runner uses the same copied exact-clock loop with initial starter inventory correctly included in starting wealth. Contract tests cross-check the new loop against the old helper.
- Every run records game-only source hash (non-test src/game TypeScript files), exact helper/harness/protocol hashes, scope and seed labels. Refuse resume if any fingerprint changes. Preserve every failed candidate under a distinct label.
- Each scenario records complete pre-operation initial state plus SHA-256, paid ledger, initial assets/menu/cash. Each row includes a first-update state fingerprint after initial promotion/restock/open. Baseline/treatment equality is verified before paired comparisons. UI-only files do not invalidate the simulation hash.
- Full raw seed rows, per-cell control/treatment means, paired deltas and descriptive Student t 95% intervals (df=29 for final data) are retained. Pilot uses df=1 rather than a final-sample critical value. No multiple-comparison correction or global optimality claim.
- Primary metrics: consumed-input operating profit, observed unmet-demand rate, terminal latest-50 reputation (the game's neutral padding applies before 20 reviews). Include served, missed, door losses, closing queue removals, pending guests, realized arrival attempts, phase exposures/arrivals, peak queue, served wait, revenue/expenses, cash/inventory/live food/waste reconciliation, and actual open/closing duration.
- Lost = missed + doorLost + queueRemovedAtClosing. Denominator = served + lost + pending. Report resolved-only rate and all-pending-lost bound as sensitivities; do not treat pending guests as completed successes. Compare service-wait distribution only among served guests and label that conditioning.
- Phase diagnostics use the design's 90-second calendar windows on both versions: calm [0,30), rising [30,45), busy [45,75), easing [75,90). Treatment's analytic envelope has exactly unit integral per complete cycle; observed counts and endogenous base arrival-rate exposure may differ. No claim of identical realized demand.

## Pre-registered regression review gates

Flag every scenario/horizon if the paired mean operating-profit difference is below -5% of the absolute baseline mean (negative-baseline edge cases remain explicitly visible), observed loss-rate difference exceeds +0.02, or rating difference is below -0.1 stars. A flag requires review even if its interval includes zero. Uncertainty and pending sensitivities accompany every cell. Report any broad material deterioration to the implementation owner for amplitude-only adjustment; do not retune prices, patience, staff, stock, recipes or drop unfavorable cells. Retain failed results. Final acceptance requires explicit disposition of every flag, with no aggregate-only pass.

No gameplay or old benchmark file is changed by this verification task. New identical harness files may be copied into the control tree; game files must retain baseline-manifest hashes.
