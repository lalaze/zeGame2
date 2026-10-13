import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MENU, UPGRADES } from './data';
import { DECOR } from './decor';
import { finishDay, openShop } from './day';
import { buyIngredient, consumeServing, servingCost } from './economy';
import { COLS, FURNITURE, WALL_ROWS, canPlace, placeFurniture, storeFurniture } from './furniture';
import { claimGoal, GOALS } from './goals';
import { canEmergencyRestock, emergencyRestock } from './recovery';
import { createInitialState, deserialize, serialize, type GameState } from './state';

function stranded(): GameState {
  const state = createInitialState(0);
  state.goal = GOALS.length;
  state.pantry.beans = 0;
  return state;
}
const goalIndex = (id: string) => GOALS.findIndex((g) => g.id === id);
const unchangedAndBlocked = (state: GameState) => {
  const before = structuredClone(state);
  expect(canEmergencyRestock(state)).toBe(false);
  expect(emergencyRestock(state)).toBe(false);
  expect(state).toEqual(before);
};

describe('one-bean emergency restock', () => {
  it('grants one bean only to an otherwise stranded preparation state', () => {
    const state = stranded();
    const before = structuredClone(state);
    expect(canEmergencyRestock(state)).toBe(true);
    expect(state).toEqual(before);
    expect(emergencyRestock(state)).toBe(true);
    expect(state).toEqual({ ...before, pantry: { ...before.pantry, beans: 1 } });
    unchangedAndBlocked(state);
    unchangedAndBlocked(deserialize(serialize(state), 1000));
  });

  it('enables already unlocked espresso without dropping another menu selection', () => {
    const state = stranded(); state.items.latte = 1; state.onMenu = ['latte'];
    expect(emergencyRestock(state)).toBe(true);
    expect(state.onMenu).toEqual(['latte', 'espresso']);
    expect(state.items.espresso).toBe(1);
    expect(state.items.latte).toBe(1);
    unchangedAndBlocked(state);
  });

  it('can restore an empty menu but never unlocks or repairs a missing espresso', () => {
    const state = stranded(); state.onMenu = [];
    expect(emergencyRestock(state)).toBe(true);
    expect(state.onMenu).toEqual(['espresso']);
    for (const espresso of [0, -1, NaN, 0.5]) {
      const invalid = stranded(); invalid.onMenu = []; invalid.items.espresso = espresso;
      unchangedAndBlocked(invalid);
    }
  });

  it.each(['open', 'closing'] as const)('does not grant during %s service', (phase) => {
    const state = stranded(); state.phase = phase;
    unchangedAndBlocked(state);
  });

  it('does not grant to a new game, existing beans or an affordable ordinary bean', () => {
    unchangedAndBlocked(createInitialState(0));
    const beans = stranded(); beans.pantry.beans = 1; unchangedAndBlocked(beans);
    for (const coins of [1, 1.001, 10, 1000]) {
      const state = stranded(); state.coins = coins;
      unchangedAndBlocked(state);
      expect(buyIngredient(state, 'beans', 1)).toBe(true);
    }
    const short = stranded(); short.coins = 0.999;
    expect(emergencyRestock(short)).toBe(true);
    expect(short.coins).toBe(0.999);
  });

  it.each(['latte', 'blacktea', 'roll'] as const)('finds usable off-menu %s ingredients', (id) => {
    const state = stranded(); state.items[id] = 1;
    if (id === 'roll') { state.kitchen = true; state.pantry.flour = 1; state.pantry.butter = 1; }
    if (id === 'latte') { state.pantry.beans = 1; state.pantry.milk = 1; }
    if (id === 'blacktea') state.pantry.tea = 1;
    unchangedAndBlocked(state);
  });

  it('ignores raw ingredients for a locked or inaccessible recipe', () => {
    const state = stranded(); state.pantry.tea = 1;
    expect(canEmergencyRestock(state)).toBe(true);
    state.items.roll = 1; state.pantry.flour = 1; state.pantry.butter = 1;
    expect(canEmergencyRestock(state)).toBe(true);
    state.kitchen = true;
    unchangedAndBlocked(state);
  });

  it('does not grant when an off-menu recipe is missing only affordable ingredients', () => {
    const state = stranded(); state.items.blacktea = 1; state.coins = 2;
    unchangedAndBlocked(state);
    state.kitchen = true; state.items.roll = 1; state.pantry.flour = 1; state.coins = 3;
    unchangedAndBlocked(state);
  });

  it.each(['shelf', 'inProduction'] as const)('preserves paid off-menu %s food instead of granting', (key) => {
    const state = stranded(); state.kitchen = true; state.items.roll = 1; state[key].roll = 1;
    unchangedAndBlocked(state);
  });

  it('allows recovery while legacy bakery shelf remains suspended without a kitchen', () => {
    const state = stranded(); state.items.roll = 1; state.shelf.roll = 2;
    const loaded = deserialize(serialize(state), 1000);
    expect(loaded.kitchen).toBe(false);
    expect(loaded.shelf.roll).toBe(2);
    expect(emergencyRestock(loaded)).toBe(true);
    expect(loaded.pantry.beans).toBe(1);
    expect(loaded.shelf.roll).toBe(2);
    const available = structuredClone(state); available.kitchen = true;
    unchangedAndBlocked(available);
  });

  it('blocks any currently claimable sequential reward', () => {
    const examples: [string, (s: GameState) => void][] = [
      ['espresso5', (s) => { s.items.espresso = 5; }],
      ['roll', (s) => { s.kitchen = true; s.items.roll = 1; }],
      ['milk', (s) => { s.pantry.milk = 20; }],
      ['sign', (s) => { s.upgrades.machine = 1; }],
      ['decor', (s) => { s.decor.stored.plant_fern = 1; }],
      ['table', (s) => { s.kitchen = true; }],
      ['barista', (s) => { s.upgrades.server = 1; }],
      ['served', (s) => { s.served = 500; }],
    ];
    for (const [id, prepare] of examples) {
      const state = stranded(); state.goal = goalIndex(id); prepare(state);
      unchangedAndBlocked(state);
      expect(claimGoal(state)).toBeGreaterThan(0);
    }
  });

  it.each(['firstDay', 'days5'])('blocks the free %s day-goal route before completion or claim', (id) => {
    const state = stranded(); state.goal = goalIndex(id); state.onMenu = [];
    unchangedAndBlocked(state);
    state.day = id === 'firstDay' ? 2 : 6;
    unchangedAndBlocked(state);
    expect(claimGoal(state)).toBeGreaterThan(0);
  });

  it('does not block for future rewards behind unaffordable current prerequisites', () => {
    const state = stranded(); state.goal = goalIndex('espresso5');
    expect(emergencyRestock(state)).toBe(true);
  });

  it('checks free owned room-style and stored-furniture comfort rewards', () => {
    const bare = stranded(); bare.goal = goalIndex('comfort');
    expect(canEmergencyRestock(bare)).toBe(true);
    const room = structuredClone(bare); room.decor.owned.push('wall_stars'); unchangedAndBlocked(room);
    const furniture = structuredClone(bare); furniture.decor.stored.plant_lemon = 1; unchangedAndBlocked(furniture);
    const combined = structuredClone(bare); combined.decor.owned.push('wall_dots'); combined.decor.stored.display_cabinet = 1;
    unchangedAndBlocked(combined);
    // Furniture comfort counts distinct kinds, and room styles only the best per slot.
    const duplicates = structuredClone(bare); duplicates.decor.stored.plant_fern = 100;
    duplicates.decor.owned.push('wall_dots', 'wall_brick');
    unchangedAndBlocked(duplicates); // best wall14 + unique fern3 can earn the reward.
    const low = structuredClone(bare); low.decor.stored.plant_fern = 100; low.decor.owned.push('wall_dots');
    expect(canEmergencyRestock(low)).toBe(true); // 6 + 3, never 6 + 300.
  });

  it('allows aid when individually placeable owned paintings cannot jointly reach comfort 15', () => {
    const state = stranded(); state.goal = goalIndex('comfort');
    state.decor.stored = { art_cat: 1, art_landscape: 1, poster_bakery: 1 };
    const empty = { ...state, decor: { ...state.decor, placed: [] } };
    // Each piece fits alone, but the two 4×5 wall panels fit at most two
    // height-three paintings. Their best possible pair contributes only 12.
    for (const id of Object.keys(state.decor.stored)) {
      let fits = false;
      for (let col = 0; col < COLS; col++) for (let row = 0; row < WALL_ROWS; row++) fits ||= canPlace(empty, id, col, row, 2);
      expect(fits).toBe(true);
    }
    const before = structuredClone(state);
    expect(canEmergencyRestock(state)).toBe(true);
    expect(state).toEqual(before);
    expect(emergencyRestock(state)).toBe(true);
    expect(state.decor).toEqual(before.decor);
  });

  it('blocks aid only when a legal free rearrangement can actually earn the comfort reward', () => {
    const state = stranded(); state.goal = goalIndex('comfort');
    state.decor.stored = { art_cat: 1, art_landscape: 1, poster_bakery: 1, garland: 1 };
    // Keep the existing zero-comfort props: the solver must be able to store them.
    unchangedAndBlocked(state);
    const witness = structuredClone(state);
    while (witness.decor.placed.length) storeFurniture(witness, 0);
    expect(placeFurniture(witness, 'art_cat', 9, 0, 2)).toBe(true);
    expect(placeFurniture(witness, 'art_landscape', 27, 0, 2)).toBe(true);
    expect(placeFurniture(witness, 'garland', 9, 3, 2)).toBe(true);
    expect(claimGoal(witness)).toBe(1000);
    // Existing placement is not an obstacle: a player can store and reposition it.
    const moved = structuredClone(state);
    while (moved.decor.placed.length) storeFurniture(moved, 0);
    expect(placeFurniture(moved, 'art_landscape', 9, 0, 2)).toBe(true);
    unchangedAndBlocked(moved);
  });

  it('uses actual opened regions and current table obstacles with no stale eligibility', () => {
    const state = stranded(); state.goal = goalIndex('comfort');
    state.decor.stored = { art_cat: 1, art_landscape: 1, poster_bakery: 1 };
    expect(canEmergencyRestock(state)).toBe(true);
    state.regions = ['reading'];
    unchangedAndBlocked(state);
    const witness = structuredClone(state);
    expect(placeFurniture(witness, 'art_cat', 42, 0, 2)).toBe(true);
    expect(placeFurniture(witness, 'art_landscape', 46, 0, 2)).toBe(true);
    expect(placeFurniture(witness, 'poster_bakery', 50, 0, 2)).toBe(true);
    expect(claimGoal(witness)).toBe(1000);
    state.regions = [];
    expect(canEmergencyRestock(state)).toBe(true);
    state.decor.stored = { piano: 1 }; state.upgrades.tables = 6;
    expect(canEmergencyRestock(state)).toBe(true); // No legal main-room 5×2 footprint.
    state.upgrades.tables = 0;
    unchangedAndBlocked(state);
    state.upgrades.tables = 6;
    expect(canEmergencyRestock(state)).toBe(true);
  });

  it('counts independently placeable floor and wall kinds once each', () => {
    const state = stranded(); state.goal = goalIndex('comfort');
    state.decor.stored = { art_cat: 1, art_landscape: 1, plant_fern: 1 };
    unchangedAndBlocked(state); // wall12 + floor3 reach15.
    state.decor.stored = { art_landscape: 100, plant_fern: 100 };
    expect(canEmergencyRestock(state)).toBe(true); // Copies add no comfort.
  });

  it('invalidates comfort results for owned kinds/styles while keeping live blockers authoritative', () => {
    const state = stranded(); state.goal = goalIndex('comfort');
    state.decor.stored = { art_cat: 1, art_landscape: 1, poster_bakery: 1 };
    expect(canEmergencyRestock(state)).toBe(true);
    state.decor.stored.garland = 1; unchangedAndBlocked(state);
    state.decor.stored.garland = 0; expect(canEmergencyRestock(state)).toBe(true);
    state.decor.owned.push('wall_stars'); unchangedAndBlocked(state);
    state.decor.owned.pop(); expect(canEmergencyRestock(state)).toBe(true);
    state.coins = 1; unchangedAndBlocked(state);
    state.coins = 0; state.pantry.beans = 1; unchangedAndBlocked(state);
    state.pantry.beans = 0; expect(canEmergencyRestock(state)).toBe(true);
    state.decor.stored.garland = 1; unchangedAndBlocked(state);
    state.goal = goalIndex('espresso5'); expect(canEmergencyRestock(state)).toBe(true);
    state.goal = goalIndex('comfort'); unchangedAndBlocked(state);
  });

  it('keeps the tiny-cash paid-prerequisite proof tied to the catalog', () => {
    const bean = INGREDIENTS.find((i) => i.id === 'beans')!.cost;
    for (const cost of [...INGREDIENTS.map((i) => i.cost), ...MENU.map((m) => m.baseCost), ...UPGRADES.map((u) => u.baseCost),
      ...DECOR.filter((d) => d.cost > 0).map((d) => d.cost), ...FURNITURE.filter((d) => d.cost > 0).map((d) => d.cost)]) expect(cost).toBeGreaterThanOrEqual(bean);
    for (const d of [...DECOR, ...FURNITURE].filter((d) => d.cost === 0)) expect(d.comfort).toBe(0);
  });

  it('does not create sale revenue, cash, earned totals or a hidden expense for the grant', () => {
    const state = stranded(); const initialCash = state.coins;
    expect(emergencyRestock(state)).toBe(true);
    const grantCost = servingCost('espresso');
    expect(state.coins).toBe(initialCash);
    expect(state.totalEarned).toBe(0);
    expect(state.today.revenue).toBe(0);
    expect(state.today.ingredientCost).toBe(0);
    openShop(state); expect(consumeServing(state, 'espresso', state.today)).toBe(true);
    const report = finishDay(state);
    expect(report.ingredientCost).toBe(grantCost);
    expect(state.coins - initialCash).toBe(report.profit + grantCost);
    // Once actually consumed and still stranded, a new request can help again.
    expect(canEmergencyRestock(state)).toBe(true);
    expect(emergencyRestock(state)).toBe(true);
    expect(state.pantry.beans).toBe(1);
    unchangedAndBlocked(state);
  });

  it.each([
    (s: GameState) => { s.coins = NaN; },
    (s: GameState) => { s.coins = -1; },
    (s: GameState) => { s.pantry.milk = Infinity; },
    (s: GameState) => { s.pantry.beans = 0.1; },
    (s: GameState) => { s.pantry.tea = -1; },
    (s: GameState) => { s.items.latte = 0.5; },
    (s: GameState) => { s.shelf.roll = NaN; },
    (s: GameState) => { s.inProduction.roll = -1; },
    (s: GameState) => { s.goal = -1; },
    (s: GameState) => { s.goal = GOALS.length + 1; },
    (s: GameState) => { s.decor.stored.plant_fern = -1; },
    (s: GameState) => { s.onMenu = ['espresso', 'espresso']; },
    (s: GameState) => { s.upgrades.marketing = 1000; },
    (s: GameState) => { s.today.revenue = NaN; },
  ])('rejects malformed economic state without repair or mutation %#', (corrupt) => {
    const state = stranded(); corrupt(state); unchangedAndBlocked(state);
  });

  it('fails closed for missing structures or unknown IDs rather than throwing', () => {
    for (const patch of [{ pantry: null }, { items: {} }, { decor: {} }, { onMenu: ['missing'] }, { shelf: { missing: 1 } }, { goal: 'all' }]) {
      const state = Object.assign(stranded(), patch) as GameState;
      unchangedAndBlocked(state);
    }
    expect(canEmergencyRestock(null as unknown as GameState)).toBe(false);
    expect(emergencyRestock(undefined as unknown as GameState)).toBe(false);
  });
});
