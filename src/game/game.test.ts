import { describe, expect, it } from 'vitest';
import { COMBO_CHANCE, DAY_SECONDS, MENU, PASS_SLOTS, UPGRADES, VARIETY_BONUS } from './data';
import { checkOpen, finishDay, formatOpenTime, openShop, type DayReport } from './day';
import {
  arrivalRate,
  orderShares,
  recipe,
  serviceCapacity,
  servingCost,
  bulkCost,
  buyItem,
  buyUpgrade,
  isItemAvailable,
  itemPrice,
  maxAffordable,
  milestoneMultiplier,
  quoteItem,
  quoteUpgrade,
  restock,
  restockQuote,
  servingsLeft,
  setBakePlan,
  setOnMenu,
  suggestedBake,
  tableCount,
  tipMultiplier,
} from './economy';
import {
  DEFAULT_ART_SPOT,
  FURNITURE,
  buyFurniture,
  canPlace,
  evictBlocked,
  moveFurniture,
  placeFurniture,
  storeFurniture,
} from './furniture';
import { COUNTER, FLOOR_Y, MAX_SCENE_H, MAX_TABLES, MIN_SCENE_H, SCENE_W, baristaSpot, baristaWorkSpot, roomRoute, serverHome, setSceneHeight, tableArea, tablePos } from './layout';
import { DECOR, DECOR_SLOTS, STARTER_THEMES, applyTheme, comfort, decorDef, useDecor, type DecorSlot } from './decor';
import { formatDuration, formatNumber } from './format';
import { GOALS, claimGoal, currentGoal, goalDone } from './goals';
import { REGIONS, unlockRegion } from './regions';
import { Sim } from './sim';
import { NAME_MAX, STARTER_BEANS, createInitialState, deserialize, serialize, type GameState } from './state';

/** A shop that's open with plenty of every ingredient. */
function openState(): GameState {
  const s = createInitialState(0);
  for (const k of Object.keys(s.pantry) as (keyof GameState['pantry'])[]) s.pantry[k] = 1e6;
  openShop(s);
  return s;
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

describe('economy', () => {
  it('bulk cost matches summing single purchases', () => {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += 8 * 1.12 ** (5 + i);
    expect(bulkCost(8, 1.12, 5, 10)).toBeCloseTo(sum, 6);
  });

  it('maxAffordable never overspends', () => {
    for (const coins of [0, 7, 8, 100, 12345, 1e9]) {
      const n = maxAffordable(8, 1.12, 3, coins);
      expect(bulkCost(8, 1.12, 3, n)).toBeLessThanOrEqual(coins);
      expect(bulkCost(8, 1.12, 3, n + 1)).toBeGreaterThan(coins);
    }
  });

  it('applies price milestones', () => {
    expect(milestoneMultiplier(9)).toBe(1);
    expect(milestoneMultiplier(10)).toBe(2);
    expect(milestoneMultiplier(25)).toBe(4);
    expect(itemPrice(MENU[0], 10)).toBe(3 * 10 * 2);
  });

  it('buys items and upgrades, respecting caps and unlock order', () => {
    const s = createInitialState(0);
    expect(isItemAvailable(s, 'cappuccino')).toBe(false);
    expect(buyItem(s, 'espresso', 1)).toBe(false);
    s.coins = 1e12;
    expect(buyItem(s, 'latte', 1)).toBe(false);
    expect(buyItem(s, 'americano', 1)).toBe(true);
    expect(buyItem(s, 'latte', 1)).toBe(true);
    expect(isItemAvailable(s, 'cappuccino')).toBe(true);
    // Food categories require a kitchen, then unlock independently in order.
    expect(isItemAvailable(s, 'roll')).toBe(false);
    expect(isItemAvailable(s, 'donut')).toBe(false);
    s.kitchen = true;
    expect(isItemAvailable(s, 'roll')).toBe(true);
    expect(isItemAvailable(s, 'blacktea')).toBe(true);
    expect(isItemAvailable(s, 'donut')).toBe(true);
    expect(isItemAvailable(s, 'bagel')).toBe(false);
    expect(buyItem(s, 'roll', 1)).toBe(true);
    expect(isItemAvailable(s, 'bagel')).toBe(true);

    const barista = UPGRADES.find((u) => u.id === 'barista')!;
    expect(buyUpgrade(s, 'barista', 'max')).toBe(true);
    expect(s.upgrades.barista).toBe(barista.max);
    expect(buyUpgrade(s, 'barista', 1)).toBe(false);
    expect(quoteUpgrade(s, 'barista', 1).count).toBe(0);
  });

  it('max quote reports at least one level so the UI can show the next price', () => {
    const s = createInitialState(0);
    const q = quoteItem(s, 'espresso', 'max');
    expect(q.count).toBe(1);
    expect(q.affordable).toBe(false);
  });

});

describe('save data', () => {
  it('round-trips', () => {
    const s = createInitialState(1000);
    s.coins = 42;
    s.items.latte = 3;
    s.upgrades.tables = 2;
    s.profile = { cafeName: 'Moon Latte', ownerName: 'Lala', look: { skin: 1, hair: 2, hairStyle: 3, shirt: 4, pants: 0 } };
    s.decor.owned.push('rug_red');
    s.decor.equipped.rug = 'rug_red';
    s.goal = 3;
    expect(deserialize(serialize(s), 2000)).toEqual(s);
  });

  it('recovers from corrupt or hostile data', () => {
    expect(deserialize('not json', 5).coins).toBe(0);
    const s = deserialize(
      JSON.stringify({ coins: -5, items: { espresso: 0, latte: 'x' }, upgrades: { barista: 99 } }),
      100,
    );
    expect(s.coins).toBe(0);
    expect(s.items.espresso).toBe(1);
    expect(s.items.latte).toBe(0);
    expect(s.upgrades.barista).toBe(3);
  });

  it('refunds the retired Shift Manager once', () => {
    const s = deserialize(JSON.stringify({ coins: 10, upgrades: { manager: 2 } }), 0);
    expect(s.coins).toBe(10 + bulkCost(500, 4, 0, 2));
    expect(deserialize(serialize(s), 0).coins).toBe(s.coins);
  });
});

describe('simulation', () => {
  it('serves customers and earns money over time', () => {
    const s = openState();
    const sim = new Sim(seeded(1));
    let sales = 0;
    for (let t = 0; t < 600; t += 0.05) {
      s.dayTime = 0;
      sales += sim.update(s, 0.05).filter((e) => e.type === 'sale').length;
    }
    expect(sales).toBeGreaterThan(50);
    expect(s.served).toBe(sales);
    expect(s.coins).toBeGreaterThan(0);
    expect(s.totalEarned).toBe(s.coins);
  });

  it('real throughput roughly matches the forecast', () => {
    const s = openState();
    s.items.latte = 5;
    s.items.espresso = 12;
    setOnMenu(s, 'latte', true);
    s.upgrades.marketing = 10;
    s.upgrades.barista = 2;
    const sim = new Sim(seeded(7));
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.05) sim.update(s, 0.05);
    };
    run(120);
    const before = s.served;
    const duration = 1200;
    run(duration);
    const actual = (s.served - before) / duration;
    const expected = Math.min(arrivalRate(s), serviceCapacity(s));
    expect(actual / expected).toBeGreaterThan(0.75);
    expect(actual / expected).toBeLessThan(1.25);
  });

  it('keeps the line bounded and hires baristas as upgrades are bought', () => {
    const s = openState();
    s.upgrades.marketing = 25;
    const sim = new Sim(seeded(3));
    for (let t = 0; t < 200; t += 0.05) {
      sim.update(s, 0.05);
      expect(sim.queue.length).toBeLessThanOrEqual(6);
    }
    s.upgrades.barista = 2;
    sim.update(s, 0.05);
    expect(sim.baristas.length).toBe(3);
  });

  it('boost speeds up brewing', () => {
    const s = openState();
    const sim = new Sim(seeded(2));
    while (!sim.isBrewing(0)) sim.update(s, 0.05);
    const before = sim.baristas[0].remaining;
    expect(sim.boost()).toBe(true);
    expect(sim.baristas[0].remaining).toBeLessThan(before);
  });

  it('sends a barista back to the back bar to make an order, and forward again as it is done', () => {
    const s = openState();
    const sim = new Sim(seeded(2));
    expect(sim.baristaPose(0)).toEqual({ ...baristaSpot(0), facing: 'down', walking: false, working: false });
    while (!sim.isBrewing(0)) sim.update(s, 0.05);
    const b = sim.baristas[0];
    const poses = [];
    for (const left of [b.total, b.total * 0.98, b.total / 2, 0.02, 0]) {
      b.remaining = left;
      poses.push(sim.baristaPose(0));
    }
    const [start, going, working, coming, done] = poses;
    expect(start).toMatchObject({ ...baristaSpot(0), facing: 'up' });
    expect(going.y).toBeLessThan(baristaSpot(0).y);
    expect(going.y).toBeGreaterThan(baristaWorkSpot(0).y);
    expect(working).toEqual({ ...baristaWorkSpot(0), facing: 'up', walking: false, working: true });
    expect(coming).toMatchObject({ facing: 'down', walking: true });
    expect(done).toEqual({ ...baristaSpot(0), facing: 'down', walking: false, working: false });
    // Everyone stays inside the bar: in front of the back bar and behind the counter.
    for (const p of poses) {
      expect(p.y).toBeGreaterThan(FLOOR_Y);
      expect(p.y).toBeLessThan(COUNTER.top + (COUNTER.bottom - COUNTER.front));
    }
  });
});

describe('format', () => {
  it('formats numbers compactly', () => {
    expect(formatNumber(999.9)).toBe('999');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(999_999)).toBe('999K');
    expect(formatNumber(2.5e9)).toBe('2.50B');
    expect(formatDuration(3725)).toBe('1h 2m');
    expect(formatDuration(42)).toBe('42s');
  });
});

describe('save migration and profile', () => {
  it('turns the old Cozy Decor upgrade into a refund plus tables', () => {
    const v1 = JSON.stringify({ version: 1, coins: 100, items: { espresso: 3 }, upgrades: { decor: 6, marketing: 2 } });
    const s = deserialize(v1, 0);
    expect(s.coins).toBeCloseTo(100 + bulkCost(200, 2.2, 0, 6), 6);
    expect(s.upgrades.tables).toBe(2);
    expect(s.upgrades.marketing).toBe(2);
    expect(s.profile).toBeNull();
    // Already-migrated saves must not be refunded again.
    expect(deserialize(serialize(s), 0).coins).toBeCloseTo(s.coins, 6);
  });

  it('cleans profile and decor data', () => {
    const s = deserialize(
      JSON.stringify({
        version: 2,
        profile: { cafeName: '  ' + 'x'.repeat(40), ownerName: 7, look: { skin: 99, hair: -2, hairStyle: 'a' } },
        decor: { owned: ['rug_blue', 'not_a_thing'], equipped: { rug: 'rug_blue', floor: 'floor_marble', neon: 'rug_blue' } },
      }),
      0,
    );
    expect(s.profile!.cafeName).toHaveLength(NAME_MAX);
    expect(s.profile!.ownerName).toBe('');
    expect(s.profile!.look).toEqual({ skin: 3, hair: 0, hairStyle: 0, shirt: 0, pants: 0 });
    expect(s.decor.owned).toContain('rug_blue');
    expect(s.decor.owned).not.toContain('not_a_thing');
    expect(s.decor.equipped.rug).toBe('rug_blue');
    expect(s.decor.equipped.floor).toBe('floor_checker'); // not owned
    expect(s.decor.equipped.neon).toBe('neon_none'); // wrong slot
    expect(deserialize(JSON.stringify({ profile: { cafeName: '   ' } }), 0).profile).toBeNull();
  });
});

describe('decor', () => {
  it('starts with every free item owned and nothing adding comfort', () => {
    const s = createInitialState(0);
    for (const d of DECOR.filter((d) => d.cost === 0)) expect(s.decor.owned).toContain(d.id);
    for (const slot of DECOR_SLOTS) expect(decorDef(s.decor.equipped[slot])!.slot).toBe(slot);
    expect(comfort(s)).toBe(0);
    expect(tipMultiplier(s)).toBe(1);
  });

  it('buys once, then swaps for free; comfort counts only what is in use', () => {
    const s = createInitialState(0);
    expect(useDecor(s, 'rug_red')).toBe(false);
    s.coins = 1000;
    expect(useDecor(s, 'rug_red')).toBe(true);
    expect(s.coins).toBe(300);
    expect(comfort(s)).toBe(5);
    expect(tipMultiplier(s)).toBeCloseTo(1.05);
    expect(useDecor(s, 'rug_none')).toBe(true);
    expect(comfort(s)).toBe(0);
    expect(useDecor(s, 'rug_red')).toBe(true);
    expect(s.coins).toBe(300);
  });

  it('starter themes are free and only change looks', () => {
    for (const theme of STARTER_THEMES) {
      const s = createInitialState(0);
      applyTheme(s, theme.id);
      expect(s.coins).toBe(0);
      expect(comfort(s)).toBe(0);
      for (const [slot, id] of Object.entries(theme.equip)) expect(s.decor.equipped[slot as DecorSlot]).toBe(id);
    }
  });

  it('every slot has a free option', () => {
    for (const slot of DECOR_SLOTS) expect(DECOR.some((d) => d.slot === slot && d.cost === 0)).toBe(true);
  });
});

describe('goals', () => {
  it('pays out in order and only when complete', () => {
    const s = createInitialState(0);
    expect(currentGoal(s)!.id).toBe('firstDay');
    expect(claimGoal(s)).toBe(0);
    s.day = 2;
    expect(goalDone(s)).toBe(true);
    expect(claimGoal(s)).toBe(GOALS[0].reward);
    expect(s.coins).toBe(GOALS[0].reward);
    expect(s.goal).toBe(1);
    expect(claimGoal(s)).toBe(0);
  });

  it('every goal is reachable and ends cleanly', () => {
    const s = createInitialState(0);
    s.goal = GOALS.length;
    expect(currentGoal(s)).toBeNull();
    expect(goalDone(s)).toBe(false);
    for (const g of GOALS) expect(g.progress(createInitialState(0))[1]).toBeGreaterThan(0);
  });
});

describe('table service', () => {
  const tick = (s: GameState, sim: Sim) => {
    s.dayTime = 0;
    return sim.update(s, 0.05);
  };

  it('dine-in guests order at the counter, sit down, and a server brings the order over when the bell rings', () => {
    const s = openState();
    const sim = new Sim(seeded(21));
    const waited = new Set<number>();
    let bells = 0;
    let delivered = 0;
    for (let t = 0; t < 300 && delivered < 3; t += 0.05) {
      const before = new Map(sim.customers.map((c) => [c.id, c.phase]));
      const servedBefore = s.served;
      const events = tick(s, sim);
      bells += events.filter((e) => e.type === 'bell').length;
      for (const c of sim.customers) {
        if (c.phase === 'waiting') {
          waited.add(c.id);
          // Paid for on delivery, so nothing in hand yet.
          expect(c.hasCup).toBe(false);
        }
        if (before.get(c.id) === 'waiting' && c.phase === 'sitting') {
          delivered++;
          expect(s.served).toBe(servedBefore + 1);
          expect(c.hasCup).toBe(true);
          // A server is standing right there.
          expect(sim.servers.some((server) => Math.hypot(server.x - c.x, server.y - c.y) < 20)).toBe(true);
        }
      }
    }
    expect(delivered).toBe(3);
    expect(bells).toBeGreaterThanOrEqual(3);
    // Back by the kitchen door once there's nothing to carry.
    for (let t = 0; t < 30 && sim.servers[0].phase !== 'idle'; t += 0.05) tick(s, sim);
  });

  it('takeaway guests are handed their order over the counter, with no bell', () => {
    const s = openState();
    const sim = new Sim(seeded(22));
    tick(s, sim);
    sim.seats = sim.seats.map(() => -1);
    let bells = 0;
    for (let t = 0; t < 120; t += 0.05) {
      bells += tick(s, sim).filter((e) => e.type === 'bell').length;
      expect(sim.customers.some((c) => c.dineIn || c.phase === 'waiting')).toBe(false);
    }
    expect(bells).toBe(0);
    expect(s.served).toBeGreaterThan(5);
  });

  it('with the pass full, the barista holds the order and keeps calling until there is room', () => {
    const s = openState();
    const sim = new Sim(seeded(23));
    tick(s, sim);
    // Four orders already up, each spoken for.
    const full = Array.from({ length: PASS_SLOTS }, () => ({ customerId: -1, items: ['espresso' as const], barista: 0, server: 0, waited: 0 }));
    sim.pass = [...full];
    let t = 0;
    for (; t < 120 && !sim.isHolding(0); t += 0.05) {
      sim.pass = [...full];
      expect(tick(s, sim).some((e) => e.type === 'bell')).toBe(false);
    }
    expect(sim.isHolding(0)).toBe(true);
    expect(sim.baristas[0].calling).toBeGreaterThan(0);
    sim.pass = [];
    expect(tick(s, sim).some((e) => e.type === 'bell')).toBe(true);
    expect(sim.pass).toHaveLength(1);
    expect(sim.isHolding(0)).toBe(false);
  });

  it('guests left waiting too long give up without paying', () => {
    const s = openState();
    const sim = new Sim(seeded(24));
    let guest: ReturnType<typeof sim.customers.find>;
    for (let t = 0; t < 120 && !guest; t += 0.05) {
      tick(s, sim);
      guest = sim.customers.find((c) => c.phase === 'waiting');
    }
    expect(guest).toBeDefined();
    const seat = guest!.seat;
    const served = s.served;
    const missed = s.today.missed;
    guest!.timer = 0.01;
    tick(s, sim);
    expect(guest!.phase).toBe('exiting');
    expect(guest!.mood).toBe('sad');
    expect(sim.seats[seat]).toBeNull();
    expect(s.today.missed).toBe(missed + 1);
    expect(s.served).toBe(served);
    expect(sim.pass.some((p) => p.customerId === guest!.id && p.server === null)).toBe(false);
  });

  /** An open shop with every room built and a busy day ahead. */
  function expanded(): GameState {
    const s = createInitialState(0);
    for (const k of Object.keys(s.pantry) as (keyof GameState['pantry'])[]) s.pantry[k] = 1e6;
    s.coins = 1e9;
    for (const region of REGIONS) expect(unlockRegion(s, region.id)).toBe(true);
    openShop(s);
    s.upgrades.marketing = 25;
    s.upgrades.barista = 3;
    return s;
  }

  it('batches up to three orders a trip and delivers them nearest room first', () => {
    const s = expanded();
    const sim = new Sim(seeded(25));
    tick(s, sim);
    const depth = (seat: number) => roomRoute('main', tableArea(Math.floor(seat / 2))).length;
    let trips = 0;
    let acrossRooms = false;
    let carried: number[] = [];
    let delivered: number[] = [];
    for (let t = 0; t < 900 && (trips < 3 || !acrossRooms); t += 0.05) {
      const server = sim.servers[0];
      const before = server.plates.map((p) => p.customerId);
      tick(s, sim);
      expect(server.plates.length).toBeLessThanOrEqual(3);
      if (server.phase === 'toPass' && before.length === 0) {
        carried = server.plates.map((p) => p.customerId);
        delivered = [];
      }
      // Whoever just came off the tray was served.
      for (const id of before) {
        if (server.plates.some((p) => p.customerId === id)) continue;
        const c = sim.customers.find((cc) => cc.id === id);
        if (c?.phase === 'sitting') delivered.push(depth(c.seat));
      }
      if (server.phase === 'returning' && carried.length >= 2 && delivered.length >= 2) {
        expect(delivered).toEqual([...delivered].sort((a, b) => a - b));
        acrossRooms ||= new Set(delivered).size > 1;
        trips++;
        carried = [];
      }
    }
    expect(trips).toBeGreaterThanOrEqual(3);
    // At least one trip dropped orders in two rooms on the way.
    expect(acrossRooms).toBe(true);
  });

  it('answers the guest closest to giving up first', () => {
    const s = expanded();
    const sim = new Sim(seeded(26));
    tick(s, sim);
    const server = () => sim.servers[0];
    // Keep the server busy elsewhere until two guests are waiting on plates.
    const hold = () => {
      server().phase = 'returning';
      server().via = [];
      server().tx = server().x + 1000;
    };
    let waiting: typeof sim.pass = [];
    for (let t = 0; t < 300 && waiting.length < 2; t += 0.05) {
      hold();
      tick(s, sim);
      waiting = sim.pass.filter((p) => sim.customers.find((c) => c.id === p.customerId)?.phase === 'waiting');
    }
    expect(waiting.length).toBeGreaterThanOrEqual(2);
    const [older, newer] = waiting;
    sim.customers.find((c) => c.id === older.customerId)!.timer = 40;
    sim.customers.find((c) => c.id === newer.customerId)!.timer = 5;
    Object.assign(server(), { ...serverHome(0), tx: serverHome(0).x, ty: serverHome(0).y, via: [], phase: 'idle' });
    tick(s, sim);
    expect(server().plates[0]).toBe(newer);
  });

  it('hires servers with the upgrade', () => {
    const s = openState();
    const sim = new Sim(seeded(27));
    tick(s, sim);
    expect(sim.servers).toHaveLength(1);
    s.upgrades.server = 2;
    tick(s, sim);
    expect(sim.servers).toHaveLength(3);
  });
});

describe('business day', () => {
  function runDay(s: GameState, sim: Sim): DayReport {
    for (let t = 0; t < DAY_SECONDS; t += 0.05) sim.update(s, 0.05);
    return sim.closeShop(s)!;
  }

  it('stays closed until opened, then runs one day and reports it', () => {
    const s = createInitialState(0);
    const sim = new Sim(seeded(4));
    for (let t = 0; t < 60; t += 0.05) sim.update(s, 0.05);
    expect(sim.customers.length).toBe(0);
    expect(s.coins).toBe(0);

    expect(checkOpen(s).ok).toBe(true);
    openShop(s);
    const report = runDay(s, sim);
    expect(report.day).toBe(1);
    expect(report.served).toBeGreaterThan(10);
    expect(report.revenue).toBeCloseTo(s.coins);
    // A drink that was being made when the doors shut used its beans but wasn't sold.
    expect(report.ingredientCost).toBeGreaterThanOrEqual(report.served);
    expect(report.ingredientCost).toBeLessThanOrEqual(report.served + 1);
    expect(report.profit).toBeCloseTo(report.revenue - report.ingredientCost);
    expect(report.bestSeller).toBe('espresso');
    expect(s.pantry.beans).toBe(STARTER_BEANS - report.ingredientCost);
    expect(s.phase).toBe('prep');
    expect(s.day).toBe(2);
    expect(s.today.served).toBe(0);
  });

  it('sells out when an ingredient runs out and counts the lost customers', () => {
    const s = createInitialState(0);
    s.pantry.beans = 3;
    openShop(s);
    const report = runDay(s, new Sim(seeded(5)));
    expect(report.served).toBe(3);
    expect(report.soldOut).toBeGreaterThan(0);
    expect(report.missed).toBeGreaterThanOrEqual(report.soldOut);
    expect(report.outOfStock).toEqual(['espresso']);
    expect(s.pantry.beans).toBe(0);
  });

  it('only sells dishes on today\'s menu and checks before opening', () => {
    const s = createInitialState(0);
    s.coins = 1000;
    s.kitchen = true;
    buyItem(s, 'roll', 1);
    expect(s.onMenu).toEqual(['espresso', 'roll']);
    expect(checkOpen(s)).toEqual({ ok: false, reason: 'lowStock', items: ['roll'] });
    setOnMenu(s, 'roll', false);
    setOnMenu(s, 'espresso', false);
    expect(checkOpen(s)).toEqual({ ok: false, reason: 'emptyMenu' });
    setOnMenu(s, 'espresso', true);
    s.pantry.beans = 1e6;
    openShop(s);
    const report = runDay(s, new Sim(seeded(6)));
    expect(Object.keys(report.sales)).toEqual(['espresso']);
  });

  it('restocks a day of ingredients, scaled down when money is short', () => {
    const s = createInitialState(0);
    s.items.latte = 1;
    setOnMenu(s, 'latte', true);
    s.pantry.beans = 0;
    const q = restockQuote(s);
    expect(q.buy.beans).toBeGreaterThan(0);
    expect(q.buy.milk).toBeGreaterThan(0);
    s.coins = q.cost;
    expect(restock(s)).toBe(true);
    expect(s.coins).toBeCloseTo(0);
    expect(restockQuote(s).cost).toBe(0);
    expect(servingsLeft(s, 'latte')).toBeGreaterThan(0);

    const poor = createInitialState(0);
    poor.pantry.beans = 0;
    poor.coins = 5;
    expect(restock(poor)).toBe(true);
    expect(poor.pantry.beans).toBe(5);
    expect(poor.coins).toBe(0);
  });

  it('stays open until closed, however long, and saves a day in progress', () => {
    const s = createInitialState(0);
    s.pantry.beans = 1e6;
    const sim = new Sim(seeded(9));
    expect(sim.closeShop(s)).toBeNull();
    openShop(s);
    for (let t = 0; t < DAY_SECONDS * 2; t += 0.05) sim.update(s, 0.05);
    expect(s.phase).toBe('open');
    // Customers keep coming long after a typical day.
    const served = s.today.served;
    for (let t = 0; t < 60; t += 0.05) sim.update(s, 0.05);
    expect(s.today.served).toBeGreaterThan(served);
    expect(formatOpenTime(s.dayTime)).toMatch(/^7:0\d$/);
    expect(formatOpenTime(3725)).toBe('1:02:05');
    s.dayTime = DAY_SECONDS / 2;
    s.today.served = 7;
    s.today.sales.espresso = 7;
    const back = deserialize(serialize(s), 0);
    expect(back.phase).toBe('open');
    expect(back.dayTime).toBe(DAY_SECONDS / 2);
    expect(back.today.sales).toEqual({ espresso: 7 });
    expect(finishDay(back).served).toBe(7);
  });

  it('gives saves from before days existed a stocked pantry', () => {
    const old = deserialize(JSON.stringify({ version: 2, coins: 50, items: { espresso: 3, latte: 2 } }), 0);
    expect(old.onMenu).toEqual(['espresso', 'latte']);
    expect(old.pantry.milk).toBeGreaterThan(0);
    expect(old.phase).toBe('prep');
  });
});

describe('menu', () => {
  it('every dish has a category, a recipe and sensible numbers', () => {
    for (const m of MENU) {
      expect(recipe(m.id).length, m.id).toBeGreaterThan(0);
      expect(m.basePrice, m.id).toBeGreaterThan(servingCost(m.id));
      expect(m.prepTime, m.id).toBeGreaterThan(0);
    }
    for (const cat of ['coffee', 'tea', 'bread', 'pastry'] as const) {
      const chain = MENU.filter((m) => m.category === cat);
      expect(chain.length).toBeGreaterThanOrEqual(7);
      // Within a category, each unlock costs more and sells for more than the last.
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i].baseCost).toBeGreaterThan(chain[i - 1].baseCost);
        expect(chain[i].basePrice).toBeGreaterThan(chain[i - 1].basePrice);
      }
    }
    expect(MENU.filter((m) => m.category === 'bread').length).toBeGreaterThanOrEqual(10);
  });

  it('combo orders: drinks pair with bakery items, and shares add up', () => {
    const drinksOnly = orderShares(MENU.filter((m) => m.id === 'espresso' || m.id === 'latte'));
    expect([...drinksOnly.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    const mixed = orderShares(MENU.filter((m) => ['espresso', 'latte', 'roll'].includes(m.id)));
    // One dish per customer, plus an add-on for some.
    const total = [...mixed.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1 + COMBO_CHANCE);
    expect(mixed.get('roll')!).toBeGreaterThan(mixed.get('latte')!);
  });

  it('serves combos and records both items', () => {
    const s = createInitialState(0);
    s.kitchen = true;
    for (const k of Object.keys(s.pantry) as (keyof GameState['pantry'])[]) s.pantry[k] = 1e6;
    s.items.roll = 1;
    setOnMenu(s, 'roll', true);
    setBakePlan(s, 'roll', 1000);
    openShop(s);
    const sim = new Sim(seeded(11));
    for (let t = 0; t < 400; t += 0.05) {
      s.dayTime = 0;
      sim.update(s, 0.05);
    }
    const sold = (s.today.sales.espresso ?? 0) + (s.today.sales.roll ?? 0);
    expect(sold).toBeGreaterThan(s.today.served);
  });

  it('a wider menu draws more customers', () => {
    const s = createInitialState(0);
    s.kitchen = true;
    const before = arrivalRate(s);
    s.items.roll = 1;
    s.items.donut = 1;
    setOnMenu(s, 'roll', true);
    setOnMenu(s, 'donut', true);
    expect(arrivalRate(s)).toBeCloseTo(before * (1 + 2 * VARIETY_BONUS));
  });

  it('moves old flour-and-butter and strawberry stock to the new ingredients', () => {
    const s = deserialize(JSON.stringify({ version: 3, pantry: { pastry: 12, berries: 3, beans: 4 } }), 0);
    expect(s.pantry.flour).toBe(12);
    expect(s.pantry.butter).toBe(12);
    expect(s.pantry.fruit).toBe(3);
    expect(s.pantry.beans).toBe(4);
  });
});

describe('morning bake', () => {
  function bakeryState(rollPlan: number): GameState {
    const s = createInitialState(0);
    s.coins = 1000;
    s.kitchen = true;
    buyItem(s, 'roll', 1);
    s.pantry.flour = 100;
    s.pantry.butter = 100;
    s.pantry.beans = 1e6;
    setBakePlan(s, 'roll', rollPlan);
    return s;
  }

  function runDay(s: GameState, seed: number): DayReport {
    const sim = new Sim(seeded(seed));
    for (let t = 0; t < DAY_SECONDS; t += 0.05) sim.update(s, 0.05);
    return sim.closeShop(s)!;
  }

  it('suggests a bake amount when a bread goes on the menu', () => {
    const s = createInitialState(0);
    s.coins = 1000;
    s.kitchen = true;
    buyItem(s, 'roll', 1);
    expect(s.bakePlan.roll).toBe(suggestedBake(s, 'roll'));
    expect(Number.isInteger(s.bakePlan.roll)).toBe(true);
    expect(s.bakePlan.roll).toBeGreaterThan(0);
  });

  it('bakes the planned batch at opening, using ingredients only once', () => {
    const s = bakeryState(30);
    const baked = openShop(s);
    expect(baked).toBe(30);
    expect(s.shelf.roll).toBe(30);
    expect(s.pantry.flour).toBe(70);
    expect(s.pantry.butter).toBe(70);
    expect(s.today.ingredientCost).toBe(30 * servingCost('roll'));
    // Exhaust butter so cooks cannot replenish this opening batch.
    s.pantry.butter = 0;
    // Selling a roll takes it off the shelf; no more flour is used.
    const sim = new Sim(seeded(21));
    // Count portions removed from the shelf, including any customer still waiting
    // when closing cancels their order. Table routes must not change this invariant.
    let removed = 0;
    for (let t = 0; t < DAY_SECONDS; t += 0.05) {
      const before = s.shelf.roll ?? 0;
      sim.update(s, 0.05);
      removed += before - (s.shelf.roll ?? 0);
    }
    const report = sim.closeShop(s)!;
    expect(s.pantry.flour).toBe(70);
    const sold = report.sales.roll ?? 0;
    expect(sold).toBeGreaterThan(0);
    expect(sold).toBeLessThanOrEqual(removed);
    expect(removed + (report.stale.roll ?? 0)).toBe(30);
    expect(s.shelf).toEqual({});
  });

  it('leftovers go stale and are counted in the report', () => {
    const report = runDay((() => { const s = bakeryState(100); openShop(s); return s; })(), 22);
    expect(report.stale.roll).toBeGreaterThan(0);
    expect(report.staleCost).toBeCloseTo(report.stale.roll! * servingCost('roll'));
    expect(report.shelfSoldOut).toEqual([]);
  });

  it('a small bake sells out on the shelf', () => {
    const s = bakeryState(5);
    openShop(s);
    // Keep this a fixed batch: no ingredients remain for live replenishment.
    s.pantry.flour = s.pantry.butter = 0;
    const report = runDay(s, 23);
    expect(report.sales.roll).toBe(5);
    expect(report.shelfSoldOut).toEqual(['roll']);
    expect(report.stale).toEqual({});
  });

  it('bakes only what the pantry allows and warns before opening', () => {
    const s = bakeryState(40);
    const available = Math.max(0, suggestedBake(s, 'roll') - 1);
    s.pantry.butter = available;
    expect(checkOpen(s)).toEqual({ ok: false, reason: 'lowStock', items: ['roll'] });
    expect(openShop(s)).toBe(available);
    expect(s.pantry.butter).toBe(0);
  });

  it('restocking covers the planned bake', () => {
    const s = bakeryState(40);
    s.pantry.flour = 0;
    s.pantry.butter = 0;
    s.coins = 1e6;
    restock(s);
    expect(s.pantry.flour).toBeGreaterThanOrEqual(40);
    expect(s.pantry.butter).toBeGreaterThanOrEqual(40);
  });

  it('keeps the plan and shelf in saves', () => {
    const s = bakeryState(25);
    openShop(s);
    s.shelf.roll = 9;
    const back = deserialize(serialize(s), 0);
    expect(back.bakePlan.roll).toBe(25);
    expect(back.shelf.roll).toBe(9);
    expect(back.today.baked.roll).toBe(25);
  });
});

describe('floor plan', () => {
  it('opens with two tables and expands to fill every table spot', () => {
    const s = createInitialState(0);
    expect(tableCount(s)).toBe(2);
    s.upgrades.tables = UPGRADES.find((u) => u.id === 'tables')!.max;
    expect(tableCount(s)).toBe(MAX_TABLES);
  });

  it('fits every table, chairs included, in the room without overlaps', () => {
    // A table with its chairs spans 46 x 28 pixels above its feet position.
    const HALF_W = 23;
    const H = 28;
    for (const sceneH of [MIN_SCENE_H, 240, MAX_SCENE_H]) {
      setSceneHeight(sceneH);
      const boxes = Array.from({ length: MAX_TABLES }, (_, i) => tablePos(i));
      for (const b of boxes) {
        expect(b.x - HALF_W).toBeGreaterThanOrEqual(0);
        expect(b.x + HALF_W).toBeLessThanOrEqual(SCENE_W);
        // Clear of the front wall along the bottom edge.
        expect(b.y).toBeLessThanOrEqual(sceneH - 8);
      }
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b) => {
          const apart = Math.abs(a.x - b.x) >= HALF_W * 2 || Math.abs(a.y - b.y) >= H;
          expect(apart).toBe(true);
        }),
      );
    }
    setSceneHeight(MIN_SCENE_H);
  });
});

describe('furniture', () => {
  const rich = () => {
    const s = createInitialState(0);
    s.coins = 1e9;
    return s;
  };

  it('opens with the clock and mug rack on the wall, adding no comfort', () => {
    const s = createInitialState(0);
    expect(s.decor.placed.map((p) => p.id)).toEqual(['clock', 'mugrack']);
    expect(comfort(s)).toBe(0);
    for (const p of s.decor.placed) expect(canPlace(s, p.id, p.col, p.row, tableCount(s), s.decor.placed.indexOf(p))).toBe(true);
  });

  it('buys into storage, places on a free spot, and counts each kind once', () => {
    const s = rich();
    expect(buyFurniture(s, 'plant_fern')).toBe(true);
    expect(buyFurniture(s, 'plant_fern')).toBe(true);
    expect(s.decor.stored.plant_fern).toBe(2);
    expect(comfort(s)).toBe(0); // stored pieces don't count
    expect(placeFurniture(s, 'plant_fern', 34, 10, 2)).toBe(true);
    expect(placeFurniture(s, 'plant_fern', 36, 10, 2)).toBe(true);
    expect(s.decor.stored.plant_fern).toBeUndefined();
    expect(comfort(s)).toBe(3);
    expect(placeFurniture(s, 'plant_fern', 30, 10, 2)).toBe(false); // none left in storage
    const poor = createInitialState(0);
    expect(buyFurniture(poor, 'plant_fern')).toBe(false);
  });

  it('keeps the counter, the walkway, tables and other pieces clear', () => {
    const s = rich();
    buyFurniture(s, 'bench');
    expect(canPlace(s, 'bench', 12, 2, 2)).toBe(false); // the counter
    expect(canPlace(s, 'bench', 18, 8, 2)).toBe(false); // the walkway to the door
    expect(canPlace(s, 'bench', 2, 1, 2)).toBe(false); // a built table
    expect(canPlace(s, 'bench', 2, 5, 2)).toBe(false); // where the next table goes
    expect(canPlace(s, 'plant_snake', 35, 0, 2)).toBe(false); // in front of the kitchen door
    expect(canPlace(s, 'bench', -1, 10, 2)).toBe(false); // off the grid
    expect(canPlace(s, 'bench', 33, 10, 2)).toBe(true);
    placeFurniture(s, 'bench', 33, 10, 2);
    buyFurniture(s, 'plant_fern');
    expect(canPlace(s, 'plant_fern', 34, 10, 2)).toBe(false); // on the bench
    // Wall pieces only go on the free wall either side of the menu board.
    expect(canPlace(s, 'art_cat', 15, 0, 2)).toBe(false);
    expect(canPlace(s, 'sconce', 9, 0, 2)).toBe(true);
    expect(canPlace(s, 'sconce', 10, 0, 2)).toBe(false); // the clock
  });

  it('moves and stores placed pieces', () => {
    const s = rich();
    const clock = s.decor.placed.findIndex((p) => p.id === 'clock');
    expect(moveFurniture(s, clock, 9, 2, 2)).toBe(true);
    expect(moveFurniture(s, clock, 27, 3, 2)).toBe(false); // the mug rack is there
    storeFurniture(s, clock);
    expect(s.decor.placed.some((p) => p.id === 'clock')).toBe(false);
    expect(s.decor.stored.clock).toBe(1);
  });

  it('sends pieces to storage when a new table needs their spot', () => {
    const s = rich();
    buyFurniture(s, 'plant_fern');
    placeFurniture(s, 'plant_fern', 26, 16, 2);
    expect(evictBlocked(s, 3)).toBe(0);
    // With five tables built, the sixth spot (front of the right bay) is reserved.
    expect(evictBlocked(s, 5)).toBe(1);
    expect(s.decor.stored.plant_fern).toBe(1);
  });

  it('every piece has a spot it fits in a new café', () => {
    const s = createInitialState(0);
    s.decor.placed = [];
    for (const f of FURNITURE) {
      let fits = false;
      for (let row = 0; row < 16 && !fits; row++) for (let col = 0; col < 40 && !fits; col++) fits = canPlace(s, f.id, col, row, 2);
      expect(fits, f.id).toBe(true);
    }
  });

  it('keeps new furnishings through purchase, placement, storage and reload without adding seats', () => {
    const s = rich();
    const seats = tableCount(s);
    for (const id of ['plant_lavender', 'poster_coffee', 'sofa', 'lantern']) {
      const def = FURNITURE.find((f) => f.id === id)!;
      const before = s.coins;
      expect(buyFurniture(s, id)).toBe(true);
      expect(s.coins).toBe(before - def.cost);
      let spot: { col: number; row: number } | undefined;
      for (let row = 0; row < 16 && !spot; row++) for (let col = 0; col < 40 && !spot; col++) {
        if (canPlace(s, id, col, row, seats)) spot = { col, row };
      }
      expect(spot, id).toBeDefined();
      expect(placeFurniture(s, id, spot!.col, spot!.row, seats)).toBe(true);
    }
    expect(tableCount(s)).toBe(seats);
    const saved = deserialize(serialize(s), 0);
    expect(saved.decor.placed).toEqual(s.decor.placed);
    expect(comfort(saved)).toBe(19);
    const sofa = saved.decor.placed.findIndex((p) => p.id === 'sofa');
    storeFurniture(saved, sofa);
    const restored = deserialize(serialize(saved), 0);
    expect(restored.decor.stored.sofa).toBe(1);
    expect(comfort(restored)).toBe(11);
    expect(tableCount(restored)).toBe(seats);
  });

  it('turns old wall art and plant slots into furniture', () => {
    const v5 = JSON.stringify({
      version: 5,
      decor: {
        owned: ['art_landscape', 'art_cat', 'plant_fern', 'rug_red'],
        equipped: { art: 'art_cat', plant: 'plant_fern', rug: 'rug_red' },
      },
    });
    const s = deserialize(v5, 0);
    expect(s.decor.placed).toContainEqual({ id: 'art_cat', ...DEFAULT_ART_SPOT });
    expect(s.decor.stored).toEqual({ art_landscape: 1, plant_fern: 1 });
    expect(s.decor.equipped.rug).toBe('rug_red');
    expect(comfort(s)).toBe(5 + 8);
  });

  it('drops placed pieces that are unknown, overlapping or off the grid', () => {
    const s = deserialize(
      JSON.stringify({
        version: 6,
        decor: {
          placed: [
            { id: 'clock', col: 10, row: 0 },
            { id: 'sconce', col: 10, row: 0 },
            { id: 'nope', col: 30, row: 10 },
            { id: 'bench', col: 99, row: 0 },
          ],
          stored: { lamp: 2, nope: 3, bench: -4 },
        },
      }),
      0,
    );
    expect(s.decor.placed).toEqual([{ id: 'clock', col: 10, row: 0 }]);
    expect(s.decor.stored).toEqual({ lamp: 2, sconce: 1, bench: 1 });
  });
});
