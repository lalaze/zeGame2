# Partner growth validation
Updated 2026-10-16 07:48 UTC. Final verification complete.
## Reproduce
- npm test -- src/game/partners.test.ts src/game/partner-regression.test.ts
- npm test -- src/game/partner-style-measurement.test.ts
- npm run build
- npm run dev -- --host 0.0.0.0 --port 3000 --strictPort
- node scripts/partner-browser-qa.mjs (installed Google Chrome; isolated temporary profile)
- npm test -- --reporter=json --outputFile=artifacts/partner-growth-regression.json

## Recorded results
Core and real-simulation tests:16 passed. Includes actual brew/delivery/batch completion,
zero-duration pause, completed-brew congestion, live JSON snapshot continuation, normal and
forced closing, active/reserve assignment, legacy paid slots and cross-day story thresholds.
Related game/settlement suite:589 passed,1 skipped,0 failed.
Full regression:2589 total,2439 passed,109 failed,41 pending. Baseline2572 total,2422 passed,
109 failed,41 pending. Exact failure-ID comparison:0 added,0 resolved. See
artifacts/partner-growth/regression-comparison.json. Existing artwork/browser expectations
are not presented as a green full suite.
Production typecheck/build:exit0 (operation 4633a1af-fc2b-4ffa-9e51-ef6d2b6cde13).
Qualified economic measurements:exit0,54 configurations; artifacts/partner-growth/measurements.json.
## Normal fresh-game browser evidence
Corrected run used only onboarding and UI clicks; no state grants, storage writes,
virtual time or fixtures. In516seconds across5real café business days:51work XP,
80earned coins paid for training,60earned coins for reserve recruitment with unchanged
active slots. Two stories unlocked; one read.40/40checks passed,exit0,zero runtime errors.
Reload after actual asset readiness preserved51XP and recruited reserve in visible UI.
Initial run's reload assertion was premature (loader at67%, preserved reload-team.jpg);
the corrected script waits for loader dismissal. It was a test timing defect.
English/Chinese ×1440/390 team/profile layouts fit viewport and modal buttons meet44px.
English1440team and Chinese390profile screenshots were visually reviewed and delivered.
A separate actual projected actor mouse-click check opened the matching Yue profile
(scripts/partner-actor-qa.mjs,4checks,exit0).
Independent review caught immediate close→assign→open without a prep frame; canonical
runtime identity reconciliation now fixes it for all roles. Strengthened regression passes.
Final full suite after that fix again has exactly109baseline failures,zero added/resolved.
Normal-browser evidence covers starter server and earned reserve; full natural campaigns
for all9partners/27chapters were not individually played. Three-node progression is tested
through real server simulation work; all roles' completion and assignment tested separately.

## Qualified route fixture, not natural progression
Identical endowed shops with route prerequisites; one seed and 300 seconds per run. Not optimized route builds, affordability analysis, or proof of economic balance.
Discrete pre-tick arrival-to-payment wait for successful customers only, resolution 0.1 seconds; unfinished/lost guests reported separately.
Operating profit includes ingredient, pet and promotion costs. Separate training cost is 80 per trained partner; both all-role choices cost 240. Existing shop asset capital and endowed XP are not included.
Same seed731,300seconds,espresso/blacktea/firstpastry menu,one hiredbarista/server/cook,
three cats and equipped cactus/lights (comfort>=7). All partner XP initially20 in this
fixture, never used to claim affordability. 54rows include isolated role choices in JSON.
Specialty changes alter scheduling and RNG consumption, so same seed does not mean an
identical customer purchase sequence. No universal superiority or balance proof is claimed.

| Route | Training | Served/300s | Mean paid wait(s) | Operating profit | Training cost | Profit after training |
|---|---|---:|---:|---:|---:|---:|
| coffee | none | 78 | 8.05 | 939.65 | 0 | 939.65 |
| coffee | all-a | 86 | 7.95 | 1116.16 | 240 | 876.16 |
| coffee | all-b | 83 | 7.84 | 842.52 | 240 | 602.52 |
| bakery | none | 84 | 9.77 | 1237.51 | 0 | 1237.51 |
| bakery | all-a | 83 | 9.05 | 1374.77 | 240 | 1134.77 |
| bakery | all-b | 79 | 9.74 | 1313.81 | 240 | 1073.81 |
| cats | none | 83 | 7.14 | 996.03 | 0 | 996.03 |
| cats | all-a | 84 | 6.89 | 1096.01 | 240 | 856.01 |
| cats | all-b | 83 | 7.43 | 1025.19 | 240 | 785.19 |
| takeaway | none | 82 | 7.63 | 940.71 | 0 | 940.71 |
| takeaway | all-a | 84 | 7.90 | 1097.09 | 240 | 857.09 |
| takeaway | all-b | 83 | 7.80 | 1109.84 | 240 | 869.84 |
| garden | none | 77 | 9.48 | 1315.77 | 0 | 1315.77 |
| garden | all-a | 85 | 9.04 | 1378.42 | 240 | 1138.42 |
| garden | all-b | 83 | 9.21 | 1355.22 | 240 | 1115.22 |
| community | none | 74 | 7.49 | 972.57 | 0 | 972.57 |
| community | all-a | 76 | 7.43 | 996.88 | 240 | 756.88 |
| community | all-b | 78 | 7.81 | 1216.70 | 240 | 976.70 |

Some variants improve throughput or wait but lose first-session profit after training capital.
Some cook variants have identical aggregate outcomes in a route; this is a measured result,
not evidence that specialty timing is absent. Per-role mechanics are covered separately.
## Preview
Vite port3000 verified HTTP200 at both localhost and100.96.195.115. User URL:
http://100.96.195.115:3000/
Remote plain HTTP may use temporary save mode; persistence QA uses localhost secure context.
Preview has a two-hour timeout from07:17UTC; successful start alone was not treated as ready.
