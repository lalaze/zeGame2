# Tiny Bean Café: play-flow update

Gentle ±10% traffic waves and faster service/pantry navigation, developed in an isolated local copy of the reviewed signature-drink baseline.

Status, 2026-10-12: complete. Final source passed 1,098 tests with26 skips and production build. An independent complete source copy passed the same full suite with2 workers and produced byte-identical build files. See DELIVERY.md for details and retained timeout evidence.

## What changed

- A 90-second calm/rising/busy/easing cycle, bounded at 0.9–1.1 and analytically averaging 1. The existing average arrival forecast, price/patience rules and random-draw count stay intact.
- Current and next phases are always visible while open: in the desktop footer and the existing mobile clock dock.
- Explicit help-serve and pantry shortcuts use existing gameplay APIs. Service help keeps its original effect/cooldown; pantry navigation never buys automatically.
- Pantry Close/Back/Escape returns to the prior tab/category, quantity, scroll, focus and expanded/collapsed panel context. Existing opening/closing, menu/research, modal/background and arrange restrictions remain in force.

## Local setup and commands

Run these in the isolated feature checkout or a separately extracted source copy, never in the preserved original working tree:

1. Install the lockfile-defined dependencies: `npm ci`
2. Run the full tests: `npm test -- --maxWorkers=2`
3. Type-check and create the production build: `npm run build`
4. Start isolated development: `npm run dev -- --host 127.0.0.1 --port 5304 --strictPort`
5. Optional production preview: `npm run preview -- --host 127.0.0.1 --port 5305 --strictPort`

Use http://127.0.0.1:5304 for isolated development or port 5305 for the optional built preview. Do not use port 5173 or import/replace the real save. Keep synthetic QA fixtures and fresh-save testing separate. Browser viewport emulation is not physical-device testing.

## Branch and commit provenance

- Isolated local branch: `feat/play-flow`
- Inherited reviewed signature baseline: `1557f1641922ca7afd897116bfb56b77c6d48194`
- Local feature commit 1, traffic rhythm: `0dcc2e2`
- Local feature commit 2, frequent-action flow: the following local commit (see delivery COMMIT-MANIFEST.txt)
- Final playable/source/evidence package hashes and extraction results: see the delivery folder SHA256SUMS and DELIVERY.md

The original `/workspace/shared/zeGame2` tree remains preserved in full. The isolated clone and immutable economic control were copied from the reviewed working-tree snapshot, including untracked fixtures, and verified against [baseline-manifest.json](baseline-manifest.json). Inherited signature work is separate from the two planned feature commits. No remote push, merge or publication is part of this work.

## Economic result and tradeoff

The main comparison completed all 78 cells: six focused paid routes at early/mid/late stages and base/rush pressure, plus fresh/signature sanity panels, at exact 180-second and 1,800-second horizons with 30 paired seeds. This is 4,680 simulations, with 360 independent holdout runs and 120 paid-restock diagnostic runs. Earlier failed-candidate evidence remains retained.

No clear sustained overall operating-profit decline was found in this tested scope: original long-horizon mean changes range −2.26% to +1.17%. This is not an all-cell or all-service-outcomes pass:

- Two early/rush short-window profit flags reflect different VIP payouts with identical sales/input costs, and did not repeat in independent holdout.
- Mid/rush bakery has a small real short-window stockout/rating cost, repeated directionally in holdout. A single extra paid pantry restock does not eliminate the production/shelf timing limit.
- Early/rush bakery holdout also shows a near-threshold long-window rating decline of −0.098 stars. Do not describe all long-run play as cost-free.

The final design retains ±10% and discloses these tradeoffs. Prices, patience, stock policy and economic review gates were not retuned to hide them.

Detailed evidence:

- [Economic overview and reproduction commands](BALANCE.md)
- [All 78 main comparison cells](BALANCE-waves10-full-v1.md)
- [Explicit flag dispositions](BALANCE-FLAG-REVIEW.md)
- [Independent holdout](BALANCE-HOLDOUT-RESULTS.md)
- [One paid-restock diagnostic](BALANCE-MECHANISM-RESULTS.md)
- [Raw evidence/script/report integrity manifest](evidence/manifest.json)

## Verification and design records

- [Design](DESIGN.md)
- [Plan and remaining release steps](PLAN.md)
- [Progress log](PROGRESS.md)
- [Browser QA](BROWSER-QA.md)
- [Independent review](REVIEW.md)

Final acceptance is recorded in DELIVERY.md; package hashes live outside the package to avoid self-referential hashes.
