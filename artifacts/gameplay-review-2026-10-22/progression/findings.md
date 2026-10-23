# Progression and operating-choice review

Current worktree source, including existing uncommitted changes. No game code changed. Evidence: `review.test.ts`, `review.log`, and `evidence.json`. The isolated evidence test passes.

## 1. High priority: a pure custom tea collapses much of the early recipe tradeoff

Confirmed numeric mechanics: stock black tea costs 1 unit of tea, sells for 9 at level 1 and takes 4 seconds. A custom tea with exactly the same single ingredient costs the same, sells for 11.25 and takes 1.2 seconds. Its preparation is 70% shorter. The price remains 25% higher when the base tea reaches levels 5 and 10. Creating it costs only a 0.25-unit trial; there is no research or recipe purchase charge. Pure custom coffee likewise keeps espresso's ingredients and 1.2-second preparation while charging 25% more.

Sources: `src/game/data.ts:84`, `src/game/data.ts:99`; `src/game/signature-drinks.ts:101-104`, `src/game/signature-drinks.ts:122-145`; `src/game/economy.ts:217-222`. The faster custom tea also receives commuter affinity 0.6 instead of black tea's 0.3 (`src/game/customer-demand.ts:27-29`).

Paired service samples: day 3, black tea level 1, same default staff, abundant tea, five fixed seeds, 180 seconds of arrivals followed by completion of accepted service, no reinvestment. At marketing 0, mean served is 30.2 stock / 44 custom and operating profit is 247.4 / 443. At marketing 4 it is 39 / 80.6 served and 337.8 / 808.55 profit. The trial cost of 0.25 is not in operating profit. These are controlled endowed-shop comparisons, not a fresh-save long-term balance proof. Practice taste curves differ, so this finding is not a claim of strict global dominance.

Design interpretation: naming a duplicate of the starting drink should not be such a large shortcut that adding ingredients or exploring normal recipes becomes hard to justify. Consider matching base preparation time for identical recipes, and tying the premium to actual differentiation or practice.

## 2. High priority: specialist styles still have to finish a compulsory coffee-and-pastry goal chain

`src/game/goals.ts:20-22` requires americano, latte and 20 milk; `src/game/goals.ts:30-32` later requires cappuccino, 500 served and croissant. `src/game/goals.ts:35-48` exposes/claims only one goal at a time. Every milestone is gated behind all 15 claimed goals (`src/game/milestones.ts:107-114`). This conflicts with garden/tea, takeaway and other style-specific paths (`src/game/styles.ts:103-116`).

Croissant is the fourth pastry in the sequential unlock chain (`src/game/data.ts:127-130`, `src/game/economy.ts:150-162`), requiring 300 + 1,100 + 3,500 + 9,000 = 13,900 in pastry unlocks plus the 800 kitchen if absent. The eventual 8,000 goal reward offsets some expense, but does not remove the compulsory detour. These are current deterministic rules; whether to force all systems is a design choice.

The evidence fixture demonstrates that a day-12 garden café with 1,500 lifetime customers and a greenhouse still cannot start milestones if the current latte goal remains unfinished. It is not a claim that all actual players reach this state.

Suggested direction: allow category/style alternatives or let a completed mid-stage style open milestones; preserve the current sequence as an optional broad tutorial.

## 3. Medium priority: later server hires leave the partner growth system

Actual servers equal 1 + server upgrades (`src/game/economy.ts:191`), with up to five upgrades after room expansion (`src/game/economy.ts:135-137`, `src/game/data.ts:158`). But named partner slots cap at three for every role (`src/game/partners.ts:47-48`). Actual simulation actors are created up to serverCount and only receive partner identities when an active partner exists at that index (`src/game/sim.ts:466-488`). Deliveries without a partner ID do not earn partner XP (`src/game/sim.ts:890`, `src/game/partners.ts:120-122`). Specialty helpers also fall back to untrained defaults.

At maximum progression there are six working servers but only three named/training slots. Capacity works; growth, assignment and narrative coverage stop for slots 4–6. This is a concrete system-integration gap, with intent unconfirmed. Consider aligning partner capacity with hired server slots or explicitly framing extra hires as anonymous support staff.

## Lower-priority design choice: permanent three-cat selection

The catalog contains 12 cats, but `MAX_PETS = 3`; adoption rejects every fourth permanent cat (`src/game/pets.ts:3`, `src/game/pets.ts:6-18`, `src/game/pets.ts:92`). There is no resident/reserve or replacement path in current pet actions (`src/ui/pets.ts:88-117`, `src/ui/pets.ts:168-176`). Filling three cheap cats to complete the cat style means a later favorite cannot join. The evidence fixture adopts ginger/tabby/black, then fails a ragdoll adoption with 98,800 coins left. Optional rotation/reserve care would preserve the room limit while avoiding permanent collection lockout. This is a preference-sensitive design tradeoff, not a simulation bug.
