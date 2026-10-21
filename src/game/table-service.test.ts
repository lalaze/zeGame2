import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MAX_PASS_SLOTS, MENU, UPGRADES } from './data';
import { openShop } from './day';
import {
  buyUpgrade, counterCapacity, passCapacity, quoteUpgrade, serverCount, serviceCapacity, tableServiceCapacity, upgradeMax,
} from './economy';
import { MAX_SERVERS, SCENE_W, serverHome } from './layout';
import { operationStatus } from './operations';
import { Sim } from './sim';
import { validSnapshot } from './sim-snapshot';
import { createInitialState, type GameState } from './state';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
/** A grown café: every room, a full main room and a broad menu with plenty of stock. */
function grown(): GameState {
  const s = createInitialState(0);
  s.coins = 1e9;
  s.kitchen = true;
  s.regions = ['reading', 'greenhouse', 'terrace'];
  Object.assign(s.upgrades, { marketing: 14, machine: 12, barista: 3, cook: 2, tables: 4 });
  for (const id of ['espresso', 'americano', 'latte', 'cappuccino', 'blacktea', 'hotchoc'] as const) s.items[id] = 20;
  s.onMenu = ['espresso', 'americano', 'latte', 'cappuccino', 'blacktea', 'hotchoc'];
  for (const ing of INGREDIENTS) s.pantry[ing.id] = 1e6;
  return s;
}

describe('table service', () => {
  it('lets each opened room hire one more server', () => {
    const s = createInitialState(0);
    s.coins = 1e12;
    expect(upgradeMax(s, 'server')).toBe(2);
    expect(buyUpgrade(s, 'server', 'max')).toBe(true);
    expect(s.upgrades.server).toBe(2);
    expect(quoteUpgrade(s, 'server', 1).count).toBe(0);
    expect(buyUpgrade(s, 'server', 1)).toBe(false);
    s.regions = ['reading', 'greenhouse', 'terrace'];
    expect(upgradeMax(s, 'server')).toBe(5);
    expect(buyUpgrade(s, 'server', 'max')).toBe(true);
    expect(serverCount(s)).toBe(6);
    expect(UPGRADES.find((u) => u.id === 'server')!.max).toBe(MAX_SERVERS - 1);
  });

  it('gives every server a waiting spot inside the room', () => {
    const spots = Array.from({ length: MAX_SERVERS }, (_, i) => serverHome(i));
    expect(new Set(spots.map((p) => `${p.x},${p.y}`)).size).toBe(MAX_SERVERS);
    for (const p of spots) expect(p.x).toBeLessThan(SCENE_W - 8);
  });

  it('holds six more plates for each Expand the Pass level', () => {
    const s = createInitialState(0);
    expect(passCapacity(s)).toBe(6);
    s.coins = 1e12;
    expect(buyUpgrade(s, 'pass', 'max')).toBe(true);
    expect(passCapacity(s)).toBe(MAX_PASS_SLOTS);
    expect(buyUpgrade(s, 'pass', 1)).toBe(false);
  });

  it('only stops a barista once the pass, however large, is full', () => {
    const run = (pass: number) => {
      const s = grown();
      s.upgrades.pass = pass;
      openShop(s);
      const sim = new Sim(seeded(4));
      // Nobody collects: the servers are kept away while orders pile up.
      let held = 0;
      for (let n = 0; n < 2400; n++) {
        sim.update(s, 0.05);
        for (const server of sim.servers) { server.phase = 'returning'; server.plates = []; server.tx = server.x; server.ty = server.y; }
        if (sim.baristas.some((_, i) => sim.isHolding(i))) held++;
        expect(sim.pass.length).toBeLessThanOrEqual(passCapacity(s));
      }
      return { held, plates: sim.pass.length, snapshot: validSnapshot(sim.snapshot(s), s) };
    };
    const small = run(0), large = run(2);
    expect(small.plates).toBe(6);
    expect(large.plates).toBeGreaterThan(6);
    expect(large.held).toBeLessThan(small.held);
    expect(large.snapshot).toBe(true);
  });

  it('forecasts what the floor staff can carry, not just what the counter can make', () => {
    const s = grown();
    // A small café never outpaces its servers.
    const starter = createInitialState(0);
    expect(tableServiceCapacity(starter)).toBe(Infinity);
    // Far rooms and few servers: the floor, not the counter, sets the pace.
    s.upgrades.server = 0;
    const one = tableServiceCapacity(s);
    expect(one).toBeLessThan(counterCapacity(s));
    expect(serviceCapacity(s)).toBe(one);
    s.upgrades.server = 2;
    expect(tableServiceCapacity(s)).toBeCloseTo(one * 3, 6);
    s.upgrades.pass = 2;
    expect(tableServiceCapacity(s)).toBeCloseTo(one * 3 * 1.7, 6);
  });

  it('takes roughly the orders it forecasts when the servers are the limit', () => {
    for (const servers of [2, 4]) {
      const s = grown();
      s.upgrades.server = servers - 1;
      expect(tableServiceCapacity(s)).toBeLessThan(counterCapacity(s));
      openShop(s);
      const sim = new Sim(seeded(9));
      // Orders taken at the counter: paid for, or made for a guest who gave up at their table.
      const taken = () => s.served + s.today.tableLost;
      for (let n = 0; n < 1200; n++) sim.update(s, 0.05);
      const before = taken();
      // Repeat whole traffic waves, as the counter forecast test does.
      for (let n = 0; n < 7200; n++) { s.dayTime %= 90; sim.update(s, 0.05); }
      const rate = (taken() - before) / 360;
      expect(rate / serviceCapacity(s)).toBeGreaterThan(0.75);
      expect(rate / serviceCapacity(s)).toBeLessThan(1.3);
    }
  });

  it('warns that guests are turned away when plates back up with the line full', () => {
    const s = grown();
    openShop(s);
    const sim = new Sim(seeded(2));
    for (let n = 0; n < 40; n++) sim.update(s, 0.05);
    sim.baristas[0].customerId = 999; sim.baristas[0].total = 3; sim.baristas[0].remaining = 0;
    expect(operationStatus(s, sim).kind).toBe('delivery');
    sim.queue = [1, 2, 3, 4, 5, 6];
    expect(operationStatus(s, sim).kind).toBe('turnedAway');
    // A few plates on a big pass are normal; only a backlog counts.
    sim.baristas[0].customerId = null;
    sim.queue = [];
    s.upgrades.pass = 2;
    sim.pass = Array.from({ length: 4 }, (_, i) => ({ customerId: i, items: [MENU[0].id], barista: 0, server: null, waited: 0 }));
    expect(operationStatus(s, sim).kind).not.toBe('delivery');
    sim.pass = Array.from({ length: 9 }, (_, i) => ({ customerId: i, items: [MENU[0].id], barista: 0, server: null, waited: 0 }));
    expect(operationStatus(s, sim).kind).toBe('delivery');
  });
});
