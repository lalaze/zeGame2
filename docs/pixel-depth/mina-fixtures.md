# Synthetic Mina visual QA fixture

These are accelerated simulations of a deliberately stocked QA café, not player
saves or claims about normal progression speed. The original
`fixtures/main-art.json` remains unchanged.

## Reproduce and validate

From the repository root:

```sh
node docs/pixel-depth/generate-mina-fixture.mjs
node docs/pixel-depth/generate-mina-fixture.mjs --check
```

The first command creates `fixtures/mina-seated.json`. The second regenerates it
in memory, compares it byte for byte, and runs the same assertions without
rewriting the fixture. Neither command launches a browser, accesses localStorage,
or changes runtime source files.

The generator uses the unchanged source fixture, `deserialize`, `openShop`, a
seeded `Sim`, and `Sim.snapshot`. It runs 173 ordinary 0.05-second updates with LCG
seed 52, capturing at 8.65 simulated seconds. No customers, orders, timers,
inventory, money, or seats are assigned by hand. The save is version 15 and stores
the simulation under the real `runtime` key used by `SaveSession`, not `liveSim`.
The ignored `_qa` metadata records provenance and the exact continuation RNG.

## Expected loaded scene

- Customer ID 1 is Mina, `appearanceId: 0`, `regularGuestId: "mina"`.
- She occupies seat 0: the left chair of the left table, facing right. The normal
  renderer selects `sitRight`; generated artwork availability is independent of
  this fixture.
- She is `sitting`, has received egg tart plus espresso, and has about 13.33
  simulated seconds remaining before leaving. Pause promptly for a static visual
  review. The fixture does not pause or extend the real simulation timer.
- The first sale was earned normally. There are no shortages, sold-out orders,
  or missing extras. Shelf stock is croissant 3, egg tart 2, cake 3.
- Normal original owner, room, menu, furniture, and upgrade choices are retained.

Validation covers real `SaveSession` loading and saving, valid runtime snapshots,
economic state round-tripping without stock loss, live cook batch/in-production
agreement, and 20 resumed 0.05-second ticks matching the uninterrupted simulation.
Mina retains her cast identity, seat, look, and seated phase across those ticks.
This is state/anchor evidence, not a screenshot or pixel-level head-art assertion.

## Separate natural cat-response proof

The script also validates this independent recipe, without writing a misleading
`mina-pet.json`:

1. Deserialize the original `main-art.json` and call normal
   `adoptCat(state, 'siamese')` during prep. Adoption costs and care are real.
2. Call `openShop(state)`, create `Sim` with seed 52, and create `LivingCats` with
   seed 1234581938, using the same LCG as the seated fixture.
3. Repeat 378 times: `sim.update(state, 0.05)`, followed by
   `cats.update(state, 0.05, sim)`.
4. At 18.9 simulated seconds, Mina is still seated at seat 0. The Siamese actor is
   at (85, 187), with `{ guestId: 1, phase: 'response', elapsed: 0 }`. This causes
   the normal seated renderer to select the right-facing pet-response pose. It
   remains in that response after one more normal tick.

There are no shortages in this case. Every cat update is checked not to mutate
economic state. The Sim snapshot is valid, but **LivingCats has no snapshot or
restore API**. Loading JSON would recreate a fresh cat engine and lose its
response, cooldowns, route history, and guest binding. Mina also has only about
3.08 seconds of seated time left at this point. A simple localStorage fixture
button therefore cannot reproduce this exact pet pose. The separate
[`qa-replay` component page](qa-replay/README.md) now replays both engines using
the recipe above and freezes their clocks while the real renderer displays the
pose. It does not fabricate a saved interaction or change production persistence.
