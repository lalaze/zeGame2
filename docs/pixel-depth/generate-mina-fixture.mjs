/** Synthetic, accelerated QA simulation. Never reads or writes a player save. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourcePath = new URL('./fixtures/main-art.json', import.meta.url);
const destination = new URL('./fixtures/mina-seated.json', import.meta.url);
const checkOnly = process.argv.includes('--check');
assert(process.argv.slice(2).every(arg => arg === '--check'), 'Only --check is supported.');
const source = await readFile(sourcePath, 'utf8');
const sourceHash = createHash('sha256').update(source).digest('hex');
const seed = 52, dt = 0.05, steps = 173;
const random = (initial) => {
  let state = initial;
  const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  next.state = () => state;
  return next;
};
const server = await createServer({
  configFile: false, root, server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const { deserialize, serialize, SAVE_KEY } = await server.ssrLoadModule('/src/game/state.ts');
  const { Sim, seated } = await server.ssrLoadModule('/src/game/sim.ts');
  const { SaveSession } = await server.ssrLoadModule('/src/game/save-session.ts');
  const { openShop } = await server.ssrLoadModule('/src/game/day.ts');
  const { MIN_SCENE_H, setSceneHeight, seatSpot } = await server.ssrLoadModule('/src/game/layout.ts');
  const { validSnapshot } = await server.ssrLoadModule('/src/game/sim-snapshot.ts');
  const { CUSTOMER_CAST } = await server.ssrLoadModule('/src/game/customer-cast.ts');
  setSceneHeight(MIN_SCENE_H);
  assert.equal(MIN_SCENE_H, 240);

  const state = deserialize(source, 0);
  assert.equal(state.version, 15);
  assert.equal(state.phase, 'prep');
  const openingCoins = state.coins;
  openShop(state);
  const rng = random(seed), sim = new Sim(rng);
  for (let i = 0; i < steps; i++) sim.update(state, dt);

  function assertMina(game, runtime, minimumSeatedSeconds = 10) {
    const mina = runtime.customers.find(customer => customer.id === 1);
    assert(mina, 'Mina must remain in the scene.');
    assert.equal(mina.appearanceId, 0);
    assert.equal(mina.regularGuestId, 'mina');
    assert.deepEqual(mina.look, CUSTOMER_CAST[0].look);
    assert.equal(mina.phase, 'sitting');
    assert(seated(mina));
    assert.equal(mina.seat, 0, 'Left table, left chair, facing right (sitRight).');
    assert.equal(runtime.seats[0], mina.id);
    assert.deepEqual({ x: mina.x, y: mina.y }, seatSpot(0, 0));
    assert.equal(mina.hasCup, true);
    assert.equal(mina.soldOut, false);
    assert.equal(mina.missingExtra, false);
    assert.equal(mina.order, 'eggtart');
    assert.equal(mina.extra, 'espresso');
    assert(mina.timer > minimumSeatedSeconds, 'Enough seated time remains to inspect the fixture.');
    assert.deepEqual(game.today.shortages, {});
    assert.equal(game.today.soldOut, 0);
    for (const stock of [game.pantry, game.shelf, game.inProduction]) {
      assert(Object.values(stock).every(n => Number.isFinite(n) && n >= 0));
    }
    const batches = {};
    for (const cook of runtime.cooks) if (cook.batch) batches[cook.batch.item] = (batches[cook.batch.item] ?? 0) + cook.batch.n;
    for (const item of new Set([...Object.keys(batches), ...Object.keys(game.inProduction)])) {
      assert.equal(game.inProduction[item] ?? 0, batches[item] ?? 0, 'Paid inventory must match live cook batches.');
    }
    return mina;
  }

  const mina = assertMina(state, sim);
  assert.equal(state.today.served, 1);
  assert.equal(state.served, 1);
  assert.deepEqual(state.today.sales, { eggtart: 1, espresso: 1 });
  assert.deepEqual(state.shelf, { croissant: 3, eggtart: 2, cake: 3 });
  assert.equal(state.coins, openingCoins + state.today.revenue, 'No money or sale is injected after normal simulation.');
  const rngStateAtCapture = rng.state();
  const runtime = sim.snapshot(state);
  assert(validSnapshot(runtime, state));
  const payload = {
    ...state,
    runtime,
    _qa: {
      label: 'Synthetic accelerated simulation; not a player save',
      source: 'docs/pixel-depth/fixtures/main-art.json',
      sourceSha256: sourceHash,
      generator: 'docs/pixel-depth/generate-mina-fixture.mjs',
      seed, stepSeconds: dt, steps, simulatedSeconds: steps * dt, rngStateAtCapture,
      expected: { customerId: mina.id, appearanceId: 0, regularGuestId: 'mina', seat: 0, phase: 'sitting', pose: 'sitRight' },
      note: 'Economic state and runtime are captured together after ordinary openShop/Sim.update. Cat visual state is not serialized by the game.',
    },
  };
  const output = `${JSON.stringify(payload, null, 2)}\n`;
  if (checkOnly) assert.equal(await readFile(destination, 'utf8'), output, 'Regenerate the fixture if simulation contracts intentionally change.');

  // Test the exact normal save-loading path, including its runtime key.
  const storage = new Map([[SAVE_KEY, output]]);
  const session = new SaveSession({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, 0, () => {});
  assertMina(session.state, session.sim);
  assert.deepEqual(session.state.pantry, state.pantry);
  assert.deepEqual(session.state.shelf, state.shelf);
  assert.deepEqual(session.state.inProduction, state.inProduction);
  assert.equal(session.save(session.state), 'saved');
  assert(validSnapshot(JSON.parse(storage.get(SAVE_KEY)).runtime, session.state));
  session.close();

  // Restore with the captured economic RNG continuation and advance both sides.
  const loaded = deserialize(output, 0), resumed = new Sim(random(rngStateAtCapture));
  assert(resumed.restore(JSON.parse(output).runtime, loaded));
  assert.deepEqual(JSON.parse(serialize(loaded)), JSON.parse(serialize(state)));
  for (let i = 0; i < 20; i++) {
    sim.update(state, dt);
    resumed.update(loaded, dt);
    assertMina(loaded, resumed);
    assert.deepEqual(JSON.parse(serialize(loaded)), JSON.parse(serialize(state)));
    assert.deepEqual(resumed.customers.find(c => c.id === 1), sim.customers.find(c => c.id === 1));
  }
  assert(validSnapshot(resumed.snapshot(loaded), loaded));

  // A separate naturally reached visual proof. LivingCats has no save API, so
  // do not present a JSON save as though it could restore this response pose.
  const { LivingCats } = await server.ssrLoadModule('/src/game/living-cats.ts');
  const { adoptCat } = await server.ssrLoadModule('/src/game/pets.ts');
  const petState = deserialize(source, 0);
  assert(adoptCat(petState, 'siamese'));
  openShop(petState);
  const petSim = new Sim(random(seed));
  const catSeed = 1234581938, petSteps = 378;
  const cats = new LivingCats(random(catSeed));
  for (let i = 0; i < petSteps; i++) {
    petSim.update(petState, dt);
    const beforeVisualUpdate = serialize(petState);
    cats.update(petState, dt, petSim);
    assert.equal(serialize(petState), beforeVisualUpdate, 'Cat visual animation must not alter inventory or finances.');
  }
  assertMina(petState, petSim, 3);
  const actor = cats.actors.get('siamese');
  assert(actor);
  assert.deepEqual(actor.interaction, { guestId: 1, phase: 'response', elapsed: 0 });
  assert.deepEqual({ x: actor.x, y: actor.y }, { x: 85, y: 187 });
  assert(validSnapshot(petSim.snapshot(petState), petState));
  petSim.update(petState, dt);
  cats.update(petState, dt, petSim);
  assertMina(petState, petSim, 3);
  assert.equal(actor.interaction?.phase, 'response');
  assert.equal(actor.interaction.elapsed, dt);

  assert.equal(await readFile(sourcePath, 'utf8'), source, 'The original main-art fixture must remain untouched.');
  if (!checkOnly) await writeFile(destination, output);
  console.log(JSON.stringify({ result: checkOnly ? 'verified' : 'generated and verified', fixture: fileURLToPath(destination),
    seed, steps, seconds: steps * dt, appearanceId: 0, seat: 0, pose: 'sitRight',
    validations: ['v15 deserialize', 'valid Sim snapshot', 'real SaveSession load/save', '20 resumed ticks equal uninterrupted economy', 'inventory/batches conserved', 'source unchanged'],
    petReplay: { adopted: 'siamese', simSeed: seed, catSeed, steps: petSteps, seconds: petSteps * dt,
      guestId: 1, phase: 'response', verifiedAfterOneMoreTick: true, storedInSave: false },
  }, null, 2));
} finally {
  await server.close();
}
