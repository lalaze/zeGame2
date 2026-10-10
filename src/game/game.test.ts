import { describe, expect, it } from 'vitest';
import { CLOSING_GRACE, COMBO_CHANCE, DAY_SECONDS, MENU, UPGRADES, VARIETY_BONUS, VIP_CHANCE, VIP_MULTIPLIER } from './data';
import { checkOpen, clockHours, finishDay, openShop, type DayReport } from './day';
import {
  arrivalRate,
  awayCapSeconds,
  dayProfit,
  orderShares,
  recipe,
  serviceCapacity,
  servingCost,
  awayEarnings,
  bulkCost,
  buyItem,
  buyUpgrade,
  incomePerSecond,
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
import { MAX_SCENE_H, MAX_TABLES, MIN_SCENE_H, SCENE_W, setSceneHeight, tablePos } from './layout';
import { DECOR, DECOR_SLOTS, STARTER_THEMES, applyTheme, comfort, decorDef, useDecor, type DecorSlot } from './decor';
import { formatDuration, formatNumber } from './format';
import { GOALS, claimGoal, currentGoal, goalDone } from './goals';
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
    // Every category starts unlockable on its own and unlocks in order.
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

  it('caps away earnings and scales with manager level', () => {
    const s = createInitialState(0);
    const full = awayEarnings(s, 1e9);
    expect(full.countedSeconds).toBe(awayCapSeconds(s));
    expect(full.earned).toBeGreaterThan(0);
    s.upgrades.manager = 5;
    // At 100% efficiency an hour away is worth one day's profit, far below full-speed income.
    expect(awayEarnings(s, 3600).earned).toBeCloseTo(dayProfit(s), 6);
    expect(awayEarnings(s, 3600).earned).toBeLessThan(incomePerSecond(s) * 3600);
    expect(awayEarnings(s, -50).earned).toBe(0);
  });

  it('a day\'s profit is sales minus ingredients', () => {
    const s = createInitialState(0);
    // Espresso Lv 1 sells for $3 and uses $1 of beans.
    const customers = Math.min(arrivalRate(s), serviceCapacity(s)) * DAY_SECONDS;
    const vip = 1 + VIP_CHANCE * (VIP_MULTIPLIER - 1);
    expect(dayProfit(s)).toBeCloseTo(customers * (3 * vip - 1), 6);
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
      JSON.stringify({ coins: -5, items: { espresso: 0, latte: 'x' }, upgrades: { barista: 99 }, lastSeen: 1e15 }),
      100,
    );
    expect(s.coins).toBe(0);
    expect(s.items.espresso).toBe(1);
    expect(s.items.latte).toBe(0);
    expect(s.upgrades.barista).toBe(3);
    expect(s.lastSeen).toBe(100);
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

  it('real throughput roughly matches the income estimate', () => {
    const s = openState();
    s.items.latte = 5;
    s.items.espresso = 12;
    setOnMenu(s, 'latte', true);
    s.upgrades.marketing = 10;
    s.upgrades.barista = 2;
    const sim = new Sim(seeded(7));
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.05) {
        s.dayTime = 0;
        sim.update(s, 0.05);
      }
    };
    run(120);
    const before = s.totalEarned;
    const duration = 1200;
    run(duration);
    const actual = (s.totalEarned - before) / duration;
    const expected = incomePerSecond(s);
    expect(actual / expected).toBeGreaterThan(0.75);
    expect(actual / expected).toBeLessThan(1.25);
  });

  it('keeps the line bounded and hires baristas as upgrades are bought', () => {
    const s = openState();
    s.upgrades.marketing = 25;
    const sim = new Sim(seeded(3));
    for (let t = 0; t < 200; t += 0.05) {
      s.dayTime = 0;
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

describe('business day', () => {
  function runDay(s: GameState, sim: Sim): DayReport {
    for (let t = 0; t < DAY_SECONDS + CLOSING_GRACE + 5; t += 0.05) {
      const end = sim.update(s, 0.05).find((e) => e.type === 'dayEnd');
      if (end && end.type === 'dayEnd') return end.report;
    }
    throw new Error('the day never ended');
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
    expect(report.ingredientCost).toBe(report.served);
    expect(report.profit).toBeCloseTo(report.revenue - report.ingredientCost);
    expect(report.bestSeller).toBe('espresso');
    expect(s.pantry.beans).toBe(STARTER_BEANS - report.served);
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

  it('runs the shop clock from 8:00 to 20:00 and saves a day in progress', () => {
    const s = createInitialState(0);
    expect(clockHours(s)).toBeLessThan(8);
    openShop(s);
    expect(clockHours(s)).toBe(8);
    s.dayTime = DAY_SECONDS / 2;
    expect(clockHours(s)).toBe(14);
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
    buyItem(s, 'roll', 1);
    s.pantry.flour = 100;
    s.pantry.butter = 100;
    s.pantry.beans = 1e6;
    setBakePlan(s, 'roll', rollPlan);
    return s;
  }

  function runDay(s: GameState, seed: number): DayReport {
    const sim = new Sim(seeded(seed));
    for (let t = 0; t < DAY_SECONDS + CLOSING_GRACE + 5; t += 0.05) {
      const end = sim.update(s, 0.05).find((e) => e.type === 'dayEnd');
      if (end && end.type === 'dayEnd') return end.report;
    }
    throw new Error('the day never ended');
  }

  it('suggests a bake amount when a bread goes on the menu', () => {
    const s = createInitialState(0);
    s.coins = 1000;
    buyItem(s, 'roll', 1);
    expect(s.bakePlan.roll).toBe(suggestedBake(s, 'roll'));
    expect(s.bakePlan.roll! % 5).toBe(0);
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
    // Selling a roll takes it off the shelf; no more flour is used.
    const report = runDay(s, 21);
    expect(s.pantry.flour).toBe(70);
    const sold = report.sales.roll ?? 0;
    expect(sold).toBeGreaterThan(0);
    expect(sold + (report.stale.roll ?? 0)).toBe(30);
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
    const report = runDay(s, 23);
    expect(report.sales.roll).toBe(5);
    expect(report.shelfSoldOut).toEqual(['roll']);
    expect(report.stale).toEqual({});
  });

  it('bakes only what the pantry allows and warns before opening', () => {
    const s = bakeryState(40);
    s.pantry.butter = 12;
    expect(checkOpen(s)).toEqual({ ok: false, reason: 'lowStock', items: ['roll'] });
    expect(openShop(s)).toBe(12);
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
    placeFurniture(s, 'plant_fern', 34, 10, 2);
    expect(evictBlocked(s, 3)).toBe(0);
    // With five tables built, the sixth spot (front of the right nook) is reserved.
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
