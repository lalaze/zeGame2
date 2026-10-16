# Café partner growth — implementation and evidence plan
Task: edeb5a40-b134-4bb0-8848-193714daf476. Started 2026-10-16.
## Audited integration points
State v15 in src/game/state.ts; atomic economic/runtime saves in save-session.
Sim owns baristas, servers, cooks; deliveries, brewing completion and batch shelving
are separate irreversible transitions. day.ts resets day totals. Owner is barista index 0.
Existing capacity: 3 hired baristas + owner, 3 servers including starter, 3 cooks after kitchen expansions.
Existing purchases, assets, pause/closing/temporary-save safeguards must remain intact.
## Product design and constraints
- Nine fixed bilingual candidates, 3/role, stable IDs and authored looks.
- Save v16 adds partner roster, active ordered assignments, lifetime completed work,
  distinct worked days, specialties and separate unlocked/read story progress.
- Legacy paid slots receive deterministic partners free, including starter server and
  kitchen starter. No invented XP, no recharging old purchases. Existing hire/expansion
  buttons continue giving their promised headcount. Reserve recruiting is optional
  (60 coins per candidate), never adds a position or bypasses kitchen.
- Only closed-shop assignment/specialty changes. Owner is not a recruitable partner.
  Slots and owned candidates are separately visible; no mandatory wages/fatigue/offline decay.
- One work XP per completed barista order (not per combo), successful server delivery,
  or physically completed cook batch (not per portion). Baking morning stock earns none.
  Failure/discard before completion earns none. A finished brew earns XP even if its
  later delivery fails, since the barista did the work. Holding a finished brew
  cannot reward repeatedly. Snapshot stores the completion marker.
- Pause/offline/reading add no work. Economic progress and runtime save atomically;
  restoring an in-flight transition must not duplicate its reward. Invalid snapshots
  do not infer completion. Normal closing completes accepted jobs; forced settlement
  drops unfinished jobs without XP. Daily summaries snapshot contribution before reset.
- Specialties unlock at 20 XP, cost 80 coins, can be changed while closed for 80.
  Barista: drink-focused (20% faster drinks / 10% slower bakery orders), or
  bakery-focused (20% faster bakery / 10% slower drinks).
  Server: single-order courier (+20% walking, tray limit 1), or batch service
  (+10% walking with >=2 orders, -10% with fewer). Cook: fast station work
  (20% shorter station timers, 10% slower walking), or runner
  (+25% walking, 10% longer station timers). Caps explicit and multiply existing
  route effects; no direct price/tip/arrival boost, no stacking specializations.
- Three story nodes per partner: 5 jobs/1 worked day; 20/2; 60/3.
  Distinct café business days, not real-world streaks. Nonblocking unread badge,
  read later and replay. Stories grant no money or capacity.
## Stages / resume state — updated 2026-10-16 07:48 UTC
1. [x] Read workspace instructions and existing code; preserve existing changes.
2. [x] Baseline: 2572 tests, 2422 passed, 109 failed, 41 pending.
3. [x] Real-work XP, story, specialty, contribution and serialization for starter server.
4. [x] All nine identities, legacy capacity compatibility, 27 bilingual chapters.
5. [x] Team/profile UI, scene identity/current work, settlement and font subset.
6. [x] Core/sim regression (16 tests); related 589 passed, 1 pending.
7. [x] 54 qualified-route measurements (6 routes × 9 configurations), seed731, 300s.
8. [x] Typecheck and production build passed after correcting a test reducer type.
9. [x] Corrected normal new-game browser run:40/40 checks,exit0,516seconds.
   Actual5business days,51XP,training80,recruitment60,storyread;reload preserves51XP
   and reserve. No runtime exceptions. Four English/Chinese viewport combinations.
10. [x] Real rendered-actor click opens matching partner profile (isolatedChrome,exit0).
11. [x] Independent review identified immediate close/assign/open runtime-ID boundary;
    fixed canonical roster sync and removed masking prep frame from regression.
    Final full regression:2439pass/109baselinefail/41pending,zero added/resolved failures.
    Final build/typecheck exit0. English desktop and Chinese mobile visually reviewed.
12. [x] Screenshots uploaded to native task; validation report prepared for delivery.
## Acceptance evidence
See VALIDATION.md and artifacts/partner-growth/. Ordinary UI play and endowed simulation
fixtures are explicitly separate. Full regression retains exactly the baseline109 failed
test IDs (zero new, zero resolved); unrelated asset expectations remain unmodified.
## Authorization and running processes
Latest user message13 explicitly revoked per-command-card restriction while local workspace
automatic authorization is enabled. Continue checking latest task before each Bridge operation.
Preview operation17adfe0f-1726-4c57-9d9f-f2b3291dfe9e uses port3000 on0.0.0.0;
HTTP200 verified locally and at100.96.195.115. Two-hour process timeout from07:17UTC.
Both isolated browser runs have exited and cleaned up their temporary profiles. No commits/push/deployment or credential changes.
