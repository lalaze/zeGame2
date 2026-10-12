/** Independent idle-server deadlock regression. Automated evidence, not human playtesting. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { openShop } from '../src/game/day';
import { setKitchenLevel, setSceneHeight } from '../src/game/layout';
import { LivingCats } from '../src/game/living-cats';
import { adoptCat } from '../src/game/pets';
import { Sim } from '../src/game/sim';
import { createInitialState } from '../src/game/state';

const DT = .1, TICKS = 12000;
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const evidence: Record<string, unknown> = {};
afterEach(() => { setSceneHeight(240); setKitchenLevel(0); });

describe('independent idle-server cat repair evidence', () => {
  it('keeps ordinary prep cats moving with server levels zero, one and two, then settles empty care', () => {
    evidence.prepScenarios = [0, 1, 2].map(serverLevel => {
      setSceneHeight(240); setKitchenLevel(0);
      const state = createInitialState(0); state.coins = 1000; expect(adoptCat(state, 'ginger')).toBe(true);
      state.upgrades.server = serverLevel;
      const sim = new Sim(() => .5), cats = new LivingCats(rng(13));
      let lastMotion = 0, routeStall = 0, maximumRouteStall = 0, totalDistance = 0;
      const movementPer120Seconds = Array.from({ length: 10 }, () => 0);
      const behaviors: Record<string, number> = {};
      for (let i = 1; i <= TICKS; i++) {
        sim.update(state, DT);
        const before = JSON.stringify({ state, servers: sim.servers, customers: sim.customers });
        const a = cats.actors.get('ginger');
        const old = a ? { x: a.x, y: a.y, hasRoute: a.route.length > 0 } : null;
        cats.update(state, DT, sim);
        expect(JSON.stringify({ state, servers: sim.servers, customers: sim.customers })).toBe(before);
        const actor = cats.actors.get('ginger')!;
        expect(Number.isFinite(actor.x + actor.y)).toBe(true);
        behaviors[actor.behavior] = (behaviors[actor.behavior] ?? 0) + 1;
        if (old) {
          const distance = Math.hypot(actor.x - old.x, actor.y - old.y);
          totalDistance += distance;
          movementPer120Seconds[Math.floor((i - 1) / 1200)] += distance;
          if (distance > 1e-8) lastMotion = i * DT;
          routeStall = old.hasRoute && actor.route.length && distance < 1e-8 ? routeStall + DT : 0;
          maximumRouteStall = Math.max(maximumRouteStall, routeStall);
        }
      }
      // Intentional sleeping/watch/groom time does not count as a route stall.
      expect(maximumRouteStall).toBeLessThan(15);
      for (const distance of movementPer120Seconds) expect(distance).toBeGreaterThan(20);
      expect(lastMotion).toBeGreaterThan(1080);
      const actor = cats.actors.get('ginger')!;
      const after1200Seconds = { x: actor.x, y: actor.y, behavior: actor.behavior, routePoints: actor.route.length, lastMotion, maximumRouteStall, totalDistance };
      state.pets[0].careSeconds = 0;
      let firstSleepAt: number | null = null;
      const emptyCareState = JSON.stringify(state);
      for (let i = 1; i <= 600; i++) {
        sim.update(state, DT); const inputs = JSON.stringify({ state, servers: sim.servers, customers: sim.customers });
        cats.update(state, DT, sim);
        expect(JSON.stringify({ state, servers: sim.servers, customers: sim.customers })).toBe(inputs);
        if (actor.behavior === 'sleep' && actor.route.length === 0 && firstSleepAt === null) firstSleepAt = i * DT;
      }
      expect(actor.behavior).toBe('sleep'); expect(actor.resting).toBe(true); expect(actor.route).toHaveLength(0);
      expect(JSON.stringify(state)).toBe(emptyCareState);
      const position = { x: actor.x, y: actor.y };
      cats.update(state, 1, { customers: sim.customers, servers: [] });
      expect({ x: actor.x, y: actor.y }).toEqual(position);
      return { serverLevel, seconds: 1200, dt: DT, servers: sim.servers.map(s => ({ x: s.x, y: s.y, phase: s.phase })),
        movementPer120Seconds, behaviors, after1200Seconds, emptyCare: { firstSleepAt, after60Seconds: { behavior: actor.behavior, resting: actor.resting, routePoints: actor.route.length }, remainsStillWithoutBlocker: true }, stateAndServiceInputsUnmodified: true };
    });
  }, 30000);

  it('keeps real open-service economy and complete runtime identical with cats on or off', () => {
    evidence.openServicePairs = [13, 517, 2026].map((seed, serverLevel) => {
      const run = (visuals: boolean) => {
        setSceneHeight(240); setKitchenLevel(0);
        const state = createInitialState(0); state.coins = 100000; state.pantry.beans = 10000; state.items.espresso = 10; state.upgrades.server = serverLevel;
        for (const id of ['ginger', 'tuxedo', 'calico']) expect(adoptCat(state, id)).toBe(true);
        state.pets.forEach(p => { p.preferredArea = 'main'; });
        const sim = new Sim(rng(seed)), cats = new LivingCats(rng(seed + 10000)); openShop(state);
        let maximumRouteStall = 0, interactionFrames = 0;
        const stalls = new Map<string, number>();
        const distanceByCat: Record<string, number> = {};
        for (let i = 0; i < TICKS; i++) {
          sim.update(state, DT);
          if (!visuals) continue;
          const previous = new Map([...cats.actors].map(([id, a]) => [id, { x: a.x, y: a.y, hasRoute: a.route.length > 0 }]));
          cats.update(state, DT, sim);
          for (const [id, a] of cats.actors) {
            if (a.interaction) interactionFrames++;
            const old = previous.get(id); if (!old) continue;
            const distance = Math.hypot(a.x - old.x, a.y - old.y);
            distanceByCat[id] = (distanceByCat[id] ?? 0) + distance;
            const stalled = old.hasRoute && a.route.length > 0 && distance < 1e-8 ? (stalls.get(id) ?? 0) + DT : 0;
            stalls.set(id, stalled); maximumRouteStall = Math.max(maximumRouteStall, stalled);
          }
        }
        return { outcome: { state, runtime: sim.snapshot(state) }, diagnostics: { distanceByCat, maximumRouteStall, interactionFrames } };
      };
      const off = run(false), on = run(true);
      expect(on.outcome).toEqual(off.outcome);
      expect(on.diagnostics.maximumRouteStall).toBeLessThan(30);
      for (const distance of Object.values(on.diagnostics.distanceByCat)) expect(distance).toBeGreaterThan(50);
      return { seed, serverLevel, simulatedSeconds: 1200, dt: DT, exactStateAndRuntimeEquality: true,
        outcomeHash: hash(on.outcome), served: on.outcome.state.today.served, coins: on.outcome.state.coins, ...on.diagnostics };
    });
  }, 30000);

  it.skipIf(process.env.LIVING_CATS_REPAIR_EVIDENCE !== '1')('writes structured repair evidence', () => {
    mkdirSync('docs/living-cats/logs', { recursive: true });
    const report = { schemaVersion: 1, label: 'Automated deterministic Node simulation evidence, not human playtesting', generatedAt: new Date().toISOString(),
      sourceHash: createHash('sha256').update(readFileSync('src/game/living-cats.ts')).digest('hex'), ...evidence };
    writeFileSync('docs/living-cats/logs/repair-long-sim.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  });
});
