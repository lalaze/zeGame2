import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import { INGREDIENTS, type ItemId } from './data';
import { openShop } from './day';
import { averageDishPrice, recipe, salePrice } from './economy';
import { FLAVORS, guestTaste } from './flavors';
import {
  CAT_REWARD, CUE_SECONDS, DELIVERIES_PER_DAY, GREET_PATIENCE, GREET_TIP, MomentDirector, PHOTO_REWARD, RECOMMEND_TIP, SAMPLE_SERVINGS,
  deliveryGift, recommendOptions, recommendVerdict, type MomentStage,
} from './moments';
import { REGULAR_GUESTS } from './regular-guests-content';
import { Sim, type Customer, type SimEvent } from './sim';
import { validSnapshot } from './sim-snapshot';
import { createInitialState, type GameState } from './state';

const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
const DRINKS: ItemId[] = ['espresso', 'americano', 'latte', 'mocha', 'hotchoc', 'blacktea', 'chai', 'fruittea', 'lemontea', 'matcha', 'smoothie', 'frappe'];
/** The visiting cat on the main room's windowsill: always free to knock a cup over. */
const WITH_CAT: MomentStage = { area: 'main', cats: [{ id: 'window', x: 26, y: 53, area: 'main', sill: true }] };
function cafe(): GameState {
  const state = createInitialState(0);
  for (const ing of INGREDIENTS) state.pantry[ing.id] = 10000;
  for (const id of DRINKS) state.items[id] = 1;
  state.onMenu = [...DRINKS];
  openShop(state);
  return state;
}
/** A café with a line of plain guests; appearance 2 likes chocolate and avoids milk. */
function line(): { state: GameState; sim: Sim; guest: Customer } {
  const state = cafe(), sim = new Sim(seeded(3));
  for (let n = 0; n < 4000 && sim.queue.length < 4; n++) sim.update(state, 0.05);
  expect(sim.queue.length).toBeGreaterThanOrEqual(4);
  for (const c of sim.customers) { delete c.regularGuestId; delete c.regularGuestVisitId; c.patience = 5; }
  const guest = sim.customers.find((c) => c.id === sim.queue.at(-1))!;
  Object.assign(guest, { appearanceId: 2, order: 'espresso', extra: null, patience: 60 });
  return { state, sim, guest };
}
/** Real seconds, one at a time, until a moment is waiting. */
function waitForMoment(director: MomentDirector, state: GameState, sim: Sim, stage: MomentStage, limit = 120): number {
  let seconds = 0;
  while (!director.active && seconds < limit) { director.update(state, sim, 1, 1, stage); seconds++; }
  return seconds;
}

describe('café moments', () => {
  it('judges a dish by the guest’s liked and avoided flavors', () => {
    const taste = { liked: 'cocoa', avoided: 'milky' } as const;
    expect(guestTaste({ appearanceId: 2, look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 } })).toEqual(taste);
    expect(recommendVerdict('hotchoc', taste)).toBe('love');
    expect(recommendVerdict('mocha', taste)).toBe('fine');
    expect(recommendVerdict('espresso', taste)).toBe('fine');
    expect(recommendVerdict('latte', taste)).toBe('meh');
  });

  it('offers the original dish and a stocked alternative, including a two-item early menu', () => {
    const { state, sim, guest } = line();
    const options = recommendOptions(state, sim, guest, seeded(5));
    expect(options).toHaveLength(2);
    expect(options).toContain('hotchoc');
    expect(options[0]).toBe(guest.order);
    expect(options.every((id) => DRINKS.includes(id))).toBe(true);
    expect(options.map((id) => recommendVerdict(id, guestTaste(guest))).sort()).toEqual(['fine', 'love']);
    // A real choice need not contain a perfect match.
    state.onMenu = ['espresso', 'americano', 'latte'];
    expect(recommendOptions(state, sim, guest, seeded(5))).toEqual(['espresso', 'latte']);
    state.onMenu = ['espresso', 'americano'];
    expect(recommendOptions(state, sim, guest, seeded(5))).toEqual(['espresso', 'americano']);
    state.onMenu = ['espresso'];
    expect(recommendOptions(state, sim, guest, seeded(5))).toEqual([]);
  });

  it('waits a little into the day, never starts while paused, and fades if ignored', () => {
    const { state, sim, guest } = line();
    const director = new MomentDirector(seeded(1));
    for (let n = 0; n < 100; n++) director.update(state, sim, 0, 0, WITH_CAT);
    expect(director.active).toBeNull();
    director.update(state, sim, 5, 5, WITH_CAT);
    expect(director.active).toBeNull();
    director.update(state, sim, 10, 10, WITH_CAT);
    expect(director.active).not.toBeNull();
    const coins = state.coins;
    director.update(state, sim, 0, CUE_SECONDS + 1, WITH_CAT);
    expect(director.active).toBeNull();
    expect(guest).toMatchObject({ order: 'espresso' });
    expect(guest.momentTip).toBeUndefined();
    expect(state.coins).toBe(coins);
  });

  it('spaces moments 20 to 40 real seconds apart, whatever the café speed', () => {
    const { state, sim } = line();
    const director = new MomentDirector(seeded(7));
    waitForMoment(director, state, sim, WITH_CAT);
    for (let round = 0; round < 12; round++) {
      director.dismiss();
      // At 4× the café clock races ahead, but the gap is measured in the player's time.
      let seconds = 0;
      while (!director.active && seconds < 60) { director.update(state, sim, 4, 1, WITH_CAT); seconds++; }
      expect(seconds).toBeGreaterThanOrEqual(20);
      expect(seconds).toBeLessThanOrEqual(41);
    }
  });

  it('keeps to the same rhythm when the line is full of regulars', () => {
    const state = cafe(), sim = new Sim(seeded(8)), director = new MomentDirector(seeded(6));
    const regulars = REGULAR_GUESTS.map((g) => g.id);
    let moments = 0;
    for (let n = 0; n < 180 / 0.05; n++) {
      sim.update(state, 0.05);
      sim.customers.forEach((c, i) => { c.regularGuestId ??= regulars[i % regulars.length]; });
      const before = director.active;
      director.update(state, sim, 0.05, 0.05, WITH_CAT);
      if (director.active && director.active !== before) { moments++; director.greet(state, sim); }
    }
    // A three-minute day at 1×: the first after 12 seconds, then one every 20–40.
    expect(moments).toBeGreaterThanOrEqual(5);
    expect(moments).toBeLessThanOrEqual(9);
  });

  it('only starts a moment in the room on screen', () => {
    const { state, sim } = line();
    const director = new MomentDirector(seeded(2));
    const map: MomentStage = { area: null, cats: WITH_CAT.cats };
    for (let n = 0; n < 120; n++) director.update(state, sim, 1, 1, map);
    expect(director.active).toBeNull();
    // In the reading room, only its own cat can be up to something.
    const reading: MomentStage = { area: 'reading', cats: [...WITH_CAT.cats, { id: 'mochi', x: 400, y: 150, area: 'reading' }] };
    for (let round = 0; round < 6; round++) {
      waitForMoment(director, state, sim, reading);
      expect(director.active).toMatchObject({ kind: 'cat', spot: { area: 'reading', catId: 'mochi' } });
      director.dismiss();
    }
  });

  it('brings every kind of moment over a long, unanswered day', () => {
    const state = cafe(), sim = new Sim(seeded(11)), director = new MomentDirector(seeded(4));
    const seen = new Set<string>();
    for (let n = 0; n < 40000 && state.phase === 'open'; n++) {
      sim.update(state, 0.05);
      director.update(state, sim, 0.05, 0.05, WITH_CAT);
      if (director.active) seen.add(director.active.kind);
      // Keep the day open long enough to see them all.
      state.dayTime = Math.min(state.dayTime, 60);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['cat', 'delivery', 'photo', 'recommend']));
  });

  it('changes nothing unless the player answers, and leaves the café’s random draws alone', () => {
    const run = (withMoments: boolean) => {
      const state = cafe(), sim = new Sim(seeded(42)), director = new MomentDirector(seeded(9));
      let cued = 0;
      for (let n = 0; n < 3600; n++) {
        sim.update(state, 0.05);
        if (withMoments) { director.update(state, sim, 0.05, 0.05, WITH_CAT); if (director.active) cued++; }
      }
      return { cued, coins: state.coins, pantry: { ...state.pantry }, today: state.today, visits: sim.customers.map((c) => [c.id, c.order, c.momentTip]) };
    };
    const watched = run(true), unwatched = run(false);
    expect(watched.cued).toBeGreaterThan(0);
    expect({ ...watched, cued: 0 }).toEqual({ ...unwatched, cued: 0 });
  });

  it('serves the recommended dish and adds its tip to the bill', () => {
    const { state, sim, guest } = line();
    const director = new MomentDirector(seeded(1));
    director.active = { kind: 'recommend', customerId: guest.id, options: ['hotchoc', 'latte'], age: 0 };
    expect(director.recommend(state, sim, 'hotchoc')).toBe('love');
    expect(guest).toMatchObject({ order: 'hotchoc', momentTip: RECOMMEND_TIP.love, mood: 'happy' });
    expect(director.reaction?.key).toBe('moment.recommend.love');
    expect(director.active).toBeNull();
    let sale: number | undefined;
    for (let n = 0; n < 8000 && sale === undefined; n++)
      sale = sim.update(state, 0.05).find((e): e is Extract<SimEvent, { type: 'sale' }> => e.type === 'sale' && e.customerId === guest.id)?.amount;
    expect(sale).toBeCloseTo(salePrice(state, 'hotchoc', guest.vip, guest.dineIn, ['hotchoc']) * (1 + RECOMMEND_TIP.love), 6);
  });

  it('lets the player wave back at an arriving regular, who shares the story they are living', () => {
    const { state, sim, guest } = line();
    guest.regularGuestId = 'mina';
    const director = new MomentDirector(seeded(1));
    // Regulars wait for the same rhythm as everything else, then go first.
    director.update(state, sim, 7, 7);
    expect(director.active).toBeNull();
    director.update(state, sim, 6, 6);
    expect(director.active).toMatchObject({ kind: 'greet', customerId: guest.id });
    expect(director.greet(state, sim)).toBe('regular.guest.mina.name');
    expect(guest).toMatchObject({ momentTip: GREET_TIP, patience: 60 + GREET_PATIENCE, mood: 'happy' });
    // Before any chapter: the first one's beat.
    expect(director.reaction!.key).toBe('moment.greet.mina.1');
    // Two chapters in the journal: what's on their mind now is the third.
    state.regularGuests.guests.mina = {
      firstMetDay: 1, served: 2, unlockedChapters: [0, 1], readChapters: [], lastUnlockDay: 1,
      servedVisitIds: [], pendingVisitIds: [], pendingDay: state.day,
    };
    director.active = { kind: 'greet', customerId: guest.id, options: [], age: 0 };
    director.greet(state, sim);
    expect(director.reaction!.key).toBe('moment.greet.mina.3');
    state.regularGuests.guests.mina!.unlockedChapters = [0, 1, 2, 3, 4];
    director.active = { kind: 'greet', customerId: guest.id, options: [], age: 0 };
    director.greet(state, sim);
    expect(director.reaction!.key).toBe('moment.greet.mina.5');
  });

  it('pays a small tip for tidying up after the cat', () => {
    const { state, sim } = line();
    const director = new MomentDirector(seeded(1));
    waitForMoment(director, state, sim, { area: 'main', cats: [{ id: 'mochi', x: 100, y: 150, area: 'main' }] });
    while (director.active?.kind !== 'cat') { director.dismiss(); waitForMoment(director, state, sim, { area: 'main', cats: [{ id: 'mochi', x: 100, y: 150, area: 'main' }] }); }
    expect(director.active.spot).toMatchObject({ x: 110, y: 150, area: 'main', catId: 'mochi' });
    const before = { coins: state.coins, revenue: state.today.revenue };
    const coins = director.tidy(state)!;
    expect(coins).toBeCloseTo(CAT_REWARD * averageDishPrice(state), 1);
    expect(state.coins).toBeCloseTo(before.coins + coins, 6);
    expect(state.today.revenue).toBeCloseTo(before.revenue + coins, 6);
    expect(director.active).toBeNull();
    expect(director.tidy(state)).toBeNull();
  });

  it('takes a seated guest’s photo for a tip and a thank-you', () => {
    const { state, sim, guest } = line();
    Object.assign(guest, { phase: 'sitting', timer: 10 });
    const director = new MomentDirector(seeded(1));
    director.active = { kind: 'photo', customerId: guest.id, options: [], age: 0 };
    const coins = state.coins;
    const tip = director.photo(state, sim)!;
    expect(tip).toBeCloseTo(PHOTO_REWARD * averageDishPrice(state), 1);
    expect(state.coins).toBeCloseTo(coins + tip, 6);
    expect(guest.mood).toBe('happy');
    expect(director.reaction).toMatchObject({ customerId: guest.id, key: 'moment.photo.thanks' });
    // A guest who already left can't pose.
    director.active = { kind: 'photo', customerId: guest.id, options: [], age: 0 };
    guest.phase = 'exiting';
    director.update(state, sim, 0.1, 0.1);
    expect(director.active).toBeNull();
  });

  it('brings ingredients for a few servings of a dish on the menu, at most twice a day', () => {
    const state = cafe(), sim = new Sim(seeded(1));
    for (let n = 0; n < 20; n++) {
      const gift = deliveryGift(state, seeded(n))!;
      expect(DRINKS).toContain(gift.item);
      expect(gift.servings).toBeGreaterThanOrEqual(SAMPLE_SERVINGS.min);
      expect(gift.servings).toBeLessThanOrEqual(SAMPLE_SERVINGS.max);
      expect(gift.ingredients).toEqual(Object.fromEntries(recipe(gift.item).map(([ing, units]) => [ing, units * gift.servings])));
    }
    // A starter café: one espresso is worth a few beans, so the sample is a few espressos.
    const starter = createInitialState(0);
    openShop(starter);
    expect(deliveryGift(starter, seeded(1))).toEqual({ item: 'espresso', servings: 5, ingredients: { beans: 5 } });
    // An empty café: nothing to recommend or photograph, so only parcels come.
    const director = new MomentDirector(seeded(3));
    let offered = 0;
    for (let n = 0; n < 600; n++) {
      const before = director.active;
      director.update(state, sim, 1, 1);
      if (director.active && director.active !== before) offered++;
    }
    expect(offered).toBe(DELIVERIES_PER_DAY);
    // Signing for one puts it straight into the pantry.
    const next = new MomentDirector(seeded(3));
    waitForMoment(next, state, sim, { area: 'main', cats: [] });
    const gift = next.active!.gift!, pantry = { ...state.pantry };
    expect(next.signDelivery(state)).toEqual(gift);
    for (const [ing, units] of recipe(gift.item)) expect(state.pantry[ing]).toBe(pantry[ing] + units * gift.servings);
  });

  it('saves an answered tip with the live visit and rejects tampered ones', () => {
    const { state, sim, guest } = line();
    guest.momentTip = RECOMMEND_TIP.love;
    const snapshot = sim.snapshot(state);
    expect(validSnapshot(snapshot, state)).toBe(true);
    snapshot.customers.find((c) => c.id === guest.id)!.momentTip = 5;
    expect(validSnapshot(snapshot, state)).toBe(false);
  });

  it('has every story beat, hint and flavor phrase in both languages', () => {
    const keys = [
      ...REGULAR_GUESTS.flatMap((g) => g.chapters.map((_, n) => `moment.greet.${g.id}.${n + 1}`)),
      ...FLAVORS.flatMap((f) => [`moment.want.${f}`, `moment.avoid.${f}`, `moment.flavor.${f}`]),
      ...(['love', 'fine', 'meh'] as const).flatMap((v) => [`moment.recommend.${v}`, `moment.recommend.toast.${v}`]),
      ...(['recommend', 'greet', 'cat', 'photo', 'delivery'] as const).map((kind) => `moment.hint.${kind}`),
      'moment.cat.toast', 'moment.photo.toast', 'moment.photo.thanks', 'moment.delivery.toast',
    ];
    for (const key of keys) {
      expect(en, key).toHaveProperty([key]);
      expect(zh, key).toHaveProperty([key]);
    }
  });
});
