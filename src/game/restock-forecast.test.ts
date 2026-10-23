import { describe, expect, it } from 'vitest';
import { conditionOn } from './conditions';
import { INGREDIENTS } from './data';
import { checkOpen, openShop } from './day';
import { buyItem, counterCapacity, restock, setOnMenu } from './economy';
import { syncPartners } from './partners';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize } from './state';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};

describe('reliable menu preparation', () => {
  it('keeps newly unlocked recipes off the selected menu until explicitly added, including after reload', () => {
    const state = createInitialState(0); state.coins = 1000; state.items.espresso = 5;
    expect(buyItem(state, 'americano', 1)).toBe(true);
    expect(state.items.americano).toBe(1);
    expect(state.onMenu).toEqual(['espresso']);
    const loaded = deserialize(serialize(state), 0);
    expect(loaded.onMenu).toEqual(['espresso']);
    setOnMenu(loaded, 'americano', true);
    expect(loaded.onMenu).toEqual(['espresso', 'americano']);
    expect(buyItem(loaded, 'americano', 1)).toBe(true);
    expect(loaded.onMenu).toEqual(['espresso', 'americano']);
  });

  it('includes the assigned barista’s real preparation specialty in the forecast', () => {
    const state = createInitialState(0); state.upgrades.barista = 1; syncPartners(state);
    const partner = state.partners.active.barista[0];
    const ordinary = counterCapacity(state);
    state.partners.roster[partner].specialty = 'a';
    expect(counterCapacity(state)).toBeGreaterThan(ordinary);
    state.partners.roster[partner].specialty = 'b';
    expect(counterCapacity(state)).toBeLessThan(ordinary);
  });

  it.each(['fair', 'rain', 'market'] as const)('recommended stock handles ordinary mixed-menu variation on %s days', weather => {
    let stockouts = 0, totalLost = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const state = createInitialState(101); state.coins = 20000; state.day = 3;
      while (conditionOn(state, state.day) !== weather) state.day++;
      state.items.espresso = 5; state.items.latte = 1; state.items.blacktea = 1;
      state.onMenu = ['espresso', 'latte', 'blacktea'];
      for (const ingredient of INGREDIENTS) state.pantry[ingredient.id] = 0;
      restock(state);
      expect(checkOpen(state)).toEqual({ ok: true });
      // A reserve should protect the day, not require several days of stock.
      expect(20000 - state.coins).toBeLessThan(160);
      openShop(state); const sim = new Sim(seeded(seed * 1701));
      for (let step = 0; step < 10000 && (state.phase === 'open' || !sim.finishedService); step++) sim.update(state, .05);
      expect(sim.finishedService).toBe(true);
      const report = sim.closeShop(state)!;
      if (report.soldOut) stockouts++;
      totalLost += report.soldOut;
    }
    expect(stockouts).toBeLessThanOrEqual(4);
    expect(totalLost / 20).toBeLessThanOrEqual(.6);
  }, 30000);
});
