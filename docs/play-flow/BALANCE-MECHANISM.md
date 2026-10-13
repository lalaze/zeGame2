# Diagnostic only: one paid restock at 90 seconds

Frozen before mechanism outcomes, 2026-10-12 15:46 UTC. This is expressly not an acceptance replacement. Keep every original primary/holdout result and flag.

- Scope: early/rush/bakery/focus and mid/rush/bakery/focus, exact 180 seconds open, dt .05, no closing drain.
- Seeds: the same 30 already-frozen holdout labels `(0x686f6c64 + i*2654435761)>>>0`; no selection based on individual outcomes.
- Same paid portfolio, menu, cash and opening promotion/restock policy as the unchanged helper in each version.
- In each version, at exactly 90 elapsed seconds, call the existing `restock(state)` once. Record the actual cash debit and added pantry asset. Do not alter forecast, prices, patience, staff, queue, recipes, manual boost or autonomous production.
- All materials remain paid. Reconcile consumed-input operating profit, remaining inventory, initial capital, actual purchases and cash independently. Additional pantry is inventory, never revenue. No prospective sale credit or terminal drain.
- An otherwise identical no-mid-restock loop must agree with the original helper on the same seed and horizon before this runner is used.
- Retain raw rows and compare to the original holdout no-intervention rows. Report between-version treatment deltas plus within-version restock effects. These are mechanism diagnostics; no new pass/fail threshold replaces the pre-registered review gates.
