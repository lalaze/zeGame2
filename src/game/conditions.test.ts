import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import {
  CONDITIONS, FAVORED_WEIGHT, FIRST_CONDITION_DAY, LESS_WEIGHT, conditionOn, dishMood, menuWeights, todayCondition, weightedIndex,
  type ConditionId,
} from './conditions';
import { INGREDIENTS, type ItemId } from './data';
import { openShop } from './day';
import { arrivalRate, dayDemand, menuItems, orderShares, patienceSeconds, tablePatience } from './economy';
import { Sim } from './sim';
import { createInitialState, type GameState } from './state';
import { thoughtCandidates } from '../render/thoughts';
import { prepConditionHtml, tomorrowConditionHtml } from '../ui/conditions';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
/** The first day at a café of this age with the given condition. */
function dayOf(id: ConditionId, createdAt = 0): number {
  for (let day = FIRST_CONDITION_DAY; day < 500; day++) if (conditionOn({ createdAt }, day) === id) return day;
  throw new Error(`no ${id} day`);
}
const DRINKS: ItemId[] = ['espresso', 'latte', 'blacktea', 'hotchoc', 'frappe', 'chai'];
function cafe(day: number, menu: ItemId[] = DRINKS): GameState {
  const state = createInitialState(0);
  for (const ing of INGREDIENTS) state.pantry[ing.id] = 100000;
  for (const id of menu) state.items[id] = 1;
  state.onMenu = [...menu];
  state.day = day;
  return state;
}

describe('daily conditions', () => {
  it('follow the café and the day: fair at first, then a stable, varied mix', () => {
    for (let day = 1; day < FIRST_CONDITION_DAY; day++) expect(conditionOn({ createdAt: 1760000000000 }, day)).toBe('fair');
    const counts = new Map<ConditionId, number>();
    let previous: ConditionId[] = [];
    for (let day = FIRST_CONDITION_DAY; day < FIRST_CONDITION_DAY + 6000; day++) {
      const id = conditionOn({ createdAt: 1760000000000 }, day);
      expect(conditionOn({ createdAt: 1760000000000 }, day)).toBe(id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      // The same weather never sets in for three days running.
      if (id !== 'fair') expect(previous.slice(-2).every((p) => p === id) && previous.length >= 2).toBe(false);
      previous = [...previous.slice(-1), id];
    }
    const total = CONDITIONS.reduce((sum, c) => sum + c.chance, 0);
    for (const c of CONDITIONS) expect(counts.get(c.id)! / 6000).toBeCloseTo(c.chance / total, 1);
    // Two cafés opened at different times don't share their weather.
    const week = (createdAt: number) => Array.from({ length: 14 }, (_, i) => conditionOn({ createdAt }, FIRST_CONDITION_DAY + i)).join();
    expect(week(1760000000000)).not.toBe(week(1760000123456));
  });

  it('change nothing at all on a fair day', () => {
    const day = dayOf('fair');
    const fair = cafe(day), first = cafe(1);
    expect(menuWeights(fair, menuItems(fair))).toBeNull();
    for (const share of orderShares(menuItems(fair), fair).values()) expect(share).toBe(1 / DRINKS.length);
    expect(arrivalRate(fair)).toBe(arrivalRate(first));
    expect(patienceSeconds(fair)).toBe(patienceSeconds(first));
    expect(tablePatience(fair)).toBe(tablePatience(first));
  });

  it('make a rainy day favor tea, cocoa and milky drinks over iced ones, in the forecast too', () => {
    const state = cafe(dayOf('rain'));
    expect(todayCondition(state).id).toBe('rain');
    expect(dishMood(state, 'blacktea')).toBe('favored');
    expect(dishMood(state, 'hotchoc')).toBe('favored');
    expect(dishMood(state, 'frappe')).toBe('less'); // iced, however milky
    expect(dishMood(state, 'coldbrew')).toBe('less');
    expect(dishMood(state, 'espresso')).toBeNull();
    const shares = orderShares(menuItems(state), state);
    expect(shares.get('blacktea')! / shares.get('espresso')!).toBeCloseTo(FAVORED_WEIGHT, 9);
    const demand = dayDemand(state);
    expect(demand.get('blacktea')!).toBeGreaterThan(demand.get('espresso')!);
    // A menu with something popular draws 10% more guests; one without, the usual crowd.
    const plain = cafe(state.day, ['espresso', 'coldbrew']), fairDay = cafe(dayOf('fair'), ['espresso', 'coldbrew']);
    expect(arrivalRate(plain)).toBeCloseTo(arrivalRate(fairDay), 12);
    expect(orderShares(menuItems(plain), plain).get('coldbrew')! / orderShares(menuItems(plain), plain).get('espresso')!).toBeCloseTo(LESS_WEIGHT, 9);
    const matched = cafe(state.day, ['espresso', 'blacktea']), matchedFair = cafe(dayOf('fair'), ['espresso', 'blacktea']);
    expect(arrivalRate(matched) / arrivalRate(matchedFair)).toBeCloseTo(1.1, 9);
  });

  it('bring a bigger takeaway crowd on market day and a calm, patient one on a quiet day', () => {
    const market = cafe(dayOf('market')), quiet = cafe(dayOf('quiet')), fair = cafe(dayOf('fair'));
    expect(arrivalRate(market) / arrivalRate(fair)).toBeCloseTo(1.2, 9);
    expect(arrivalRate(quiet) / arrivalRate(fair)).toBeCloseTo(0.85, 9);
    expect(patienceSeconds(quiet) - patienceSeconds(fair)).toBe(15);
    expect(tablePatience(quiet) - tablePatience(fair)).toBe(15);
    // Market crowds are keen on bakes: only a kitchen's bread and pastries are favored.
    market.kitchen = true;
    market.items.croissant = 1;
    market.onMenu.push('croissant');
    expect(dishMood(market, 'croissant')).toBe('favored');
    expect(dishMood(market, 'latte')).toBeNull();
  });

  it('pick a dish in proportion to its weight from one random draw', () => {
    for (let i = 0; i < 1000; i++) {
      const r = i / 1000;
      expect(weightedIndex([1, 1, 1, 1, 1], r)).toBe(Math.floor(r * 5));
    }
    expect(weightedIndex([1, 2, 1], 0.3)).toBe(1);
    expect(weightedIndex([1, 2, 1], 0.99)).toBe(2);
  });

  it('send real guests to the dishes the forecast expects', () => {
    const state = cafe(dayOf('rain'), ['espresso', 'blacktea', 'coldbrew']);
    state.items.coldbrew = 1;
    openShop(state);
    const sim = new Sim(seeded(5)), seen = new Set<number>(), orders = new Map<ItemId, number>();
    for (let n = 0; n < 60000; n++) {
      sim.update(state, 0.05);
      for (const c of sim.customers) if (!seen.has(c.id)) { seen.add(c.id); orders.set(c.order, (orders.get(c.order) ?? 0) + 1); }
      if (state.phase !== 'open') { state.phase = 'open'; state.dayTime = 0; }
    }
    const total = [...orders.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(300);
    const shares = orderShares(menuItems(state), state);
    for (const [id, share] of shares) expect(orders.get(id)! / total).toBeCloseTo(share, 1);
  });

  it('greet arriving guests with a word about the day', () => {
    const state = cafe(dayOf('rain'));
    openShop(state);
    const sim = new Sim(seeded(2));
    let arrivals: string[] = [];
    for (let n = 0; n < 400 && !arrivals.length; n++) {
      sim.update(state, 0.05);
      arrivals = thoughtCandidates(sim, state).filter((c) => c.context === 'queue:arrive').map((c) => c.key);
    }
    expect(arrivals[0]).toBe('thought.weather.rain');
  });

  it('show the day on the preparation card and tomorrow in the report', () => {
    const rain = cafe(dayOf('rain'));
    const html = prepConditionHtml(rain, menuItems(rain));
    expect(html).toContain(en['condition.rain.name']);
    expect(html).toContain('condition-match on');
    expect(prepConditionHtml(cafe(dayOf('fair')), [])).toBe('');
    expect(tomorrowConditionHtml(rain, rain.day - 1)).toContain(en['condition.rain.name']);
    expect(tomorrowConditionHtml(rain, dayOf('fair') - 1)).toBe('');
  });

  it('describe every condition in both languages', () => {
    for (const c of CONDITIONS) {
      for (const key of [`condition.${c.id}.name`, `condition.${c.id}.intro`, ...(c.id === 'fair' ? [] : [`thought.weather.${c.id}`])]) {
        expect(en, key).toHaveProperty([key]);
        expect(zh, key).toHaveProperty([key]);
      }
    }
  });
});
