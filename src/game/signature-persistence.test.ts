import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize, SAVE_VERSION, type GameState } from './state';
import { deleteSignature, makeSignatureId, renameSignature, saveSignature, setSignatureOnMenu, trialSignature } from './signature-drinks';
import { recordServings, researchSignature, tasteTier } from './taste';
import { fastDrinkMeal, setCafeStyle, stylePrepMultiplier, styleSaleMultiplier, styleStages, teaPastryMeal } from './styles';
import { mealReview, recordReview, parseReputation } from './reputation';
import { Sim } from './sim';
import { validSnapshot } from './sim-snapshot';
import { openShop } from './day';
import { canEmergencyRestock, emergencyRestock } from './recovery';
import { GOALS } from './goals';

const coffee = makeSignatureId('coffee', { beans: 1 })!;
const tea = makeSignatureId('tea', { tea: 1 })!;
function fixture() {
  const state = createInitialState(0);
  state.pantry.beans = 1000;
  expect(trialSignature(state, 'coffee', { beans: 1 }).ok).toBe(true);
  expect(saveSignature(state, coffee, 'House cup')).toBe(true);
  expect(setSignatureOnMenu(state, coffee, true)).toBe(true);
  return state;
}
const reload = (state: GameState) => deserialize(serialize(state), 0);
function until(state: GameState, sim: Sim, done: () => boolean) {
  for (let i = 0; i < 3000 && !done(); i++) sim.update(state, .05);
  expect(done()).toBe(true);
}

describe('signature recipe saves and immutable history', () => {
  it('migrates old saves without inventing recipes, mastery or trial history', () => {
    const state = deserialize(JSON.stringify({ version: 14, taste: { served: { espresso: 100 }, signature: ['espresso'] } }), 0);
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.signatureDrinks).toEqual({ recipes: [], tested: [], served: {} });
    expect(state.taste.signature).toEqual(['espresso']);
    expect(reload(state).signatureDrinks).toEqual(state.signatureDrinks);
  });

  it('preserves quarter-unit trial inventory and keeps custom menu authority separate', () => {
    const state = fixture();
    expect(state.pantry.beans).toBe(999.75);
    const loaded = reload(state);
    expect(loaded.pantry).toEqual(state.pantry);
    expect(loaded.signatureDrinks).toEqual(state.signatureDrinks);
    expect(loaded.onMenu).toEqual(['espresso']);
    expect(loaded.items[coffee]).toBe(1);
    expect(loaded.taste.served[coffee]).toBeUndefined();
  });

  it('rejects malicious IDs, duplicate recipes, false trial claims and invalid growth', () => {
    const state = deserialize(JSON.stringify({
      signatureDrinks: {
        tested: [coffee, coffee, '__proto__', 'sig:coffee:beans=1,beans=1'],
        recipes: [
          { id: coffee, name: '\u0000House\n cup', onMenu: true },
          { id: coffee, name: 'Duplicate', onMenu: true },
          { id: tea, name: 'Untested', onMenu: true },
          { id: '__proto__', name: 'Bad', onMenu: true },
          { id: 'sig:coffee:beans=1,sugar=999', name: 'Bad', onMenu: true },
        ],
        served: { [coffee]: 29, [tea]: 1.5, '__proto__': 100, bad: 100 },
      },
      taste: { served: { [coffee]: 9999 }, signature: [coffee] },
      today: { sales: { [coffee]: 3, bad: 10 }, shortages: { [coffee]: 2, bad: 10 } },
    }), 0);
    expect(state.signatureDrinks.recipes).toEqual([{ id: coffee, name: 'House cup', onMenu: true }]);
    expect(state.signatureDrinks.tested).toEqual([coffee]);
    expect(state.signatureDrinks.served).toEqual({ [coffee]: 29 });
    expect(state.taste.served).toEqual({ [coffee]: 29 });
    expect(state.taste.signature).toEqual([]);
    expect(tasteTier(state, coffee)).toBe('standard');
    expect(state.today.sales).toEqual({ [coffee]: 3 });
    expect(state.today.shortages).toEqual({ [coffee]: 2 });
  });

  it('earns custom skill at 30 and mastery at 100 actual servings without research purchases', () => {
    const state = fixture();
    state.coins = 10000;
    recordServings(state, Array(29).fill(coffee));
    expect(tasteTier(state, coffee)).toBe('standard');
    expect(researchSignature(state, coffee)).toBe(false);
    recordServings(state, [coffee]);
    expect(tasteTier(state, coffee)).toBe('skilled');
    recordServings(state, Array(69).fill(coffee));
    expect(tasteTier(state, coffee)).toBe('skilled');
    recordServings(state, [coffee]);
    expect(tasteTier(state, coffee)).toBe('signature');
    expect(state.taste.served[coffee]).toBe(100);
    expect(state.signatureDrinks.served[coffee]).toBe(100);
    expect(researchSignature(state, coffee)).toBe(false);
    expect(state.coins).toBe(10000);
    expect(state.taste.signature).toEqual([]);
    expect(tasteTier(reload(state), coffee)).toBe('signature');
  });

  it('retains sales, shortages, reviews and growth after deletion, rename and recreation', () => {
    const state = fixture();
    recordServings(state, Array(100).fill(coffee));
    state.today.sales[coffee] = 7;
    state.today.shortages[coffee] = 2;
    recordReview(state, mealReview(state, [coffee], 1, false));
    expect(renameSignature(state, coffee, '<img src=x onerror=x>')).toBe(true);
    expect(state.signatureDrinks.served[coffee]).toBe(100);
    expect(deleteSignature(state, coffee)).toBe(true);
    const loaded = reload(state);
    expect(loaded.signatureDrinks.recipes).toEqual([]);
    expect(loaded.today.sales[coffee]).toBe(7);
    expect(loaded.today.shortages[coffee]).toBe(2);
    expect(loaded.reputation.recent[0].items).toEqual([coffee]);
    expect(loaded.signatureDrinks.served[coffee]).toBe(100);
    expect(loaded.taste.served[coffee]).toBe(100);
    expect(saveSignature(loaded, coffee, 'Recreated')).toBe(true);
    expect(saveSignature(loaded, coffee, 'Duplicate')).toBe(false);
    expect(tasteTier(loaded, coffee)).toBe('signature');
    expect(loaded.signatureDrinks.served[coffee]).toBe(100);
  });

  it('preserves weaker custom recipe and combo taste reviews without weakening stock validation', () => {
    const state = fixture();
    const weak = makeSignatureId('coffee', { beans: 1, sugar: 2, spice: 2 })!;
    const review = mealReview(state, [weak], 1, false);
    expect(review.taste).toBe(3.7);
    expect(review.stars).toBe(3.7);
    recordReview(state, review);
    const combo = mealReview(state, [weak, 'espresso'], 1, false);
    expect(combo.taste).toBe(3.9);
    recordReview(state, combo);
    expect(reload(state).reputation).toEqual(state.reputation);
    const parsed = parseReputation({ recent: [
      { stars: 3.7, taste: 3.7, day: 1, reason: 'standardTaste', items: ['espresso'] },
      { stars: 3.7, taste: 3.7, day: 1, reason: 'standardTaste', items: ['sig:coffee:beans=999'] },
      { stars: 3.6, taste: 3.6, day: 1, reason: 'standardTaste', items: [weak] },
      { stars: 3.7, taste: 3.7, day: 1, reason: 'standardTaste', items: [weak, 'espresso'] },
    ] });
    expect(parsed.recent).toHaveLength(4);
    expect(parsed.recent.every((entry) => entry.taste === undefined)).toBe(true);
  });

  it('applies custom categories to styles and counts immutable mastery once', () => {
    const state = fixture();
    setCafeStyle(state, 'coffee');
    expect(stylePrepMultiplier(state, coffee)).toBe(1.12);
    expect(styleSaleMultiplier(state, coffee)).toBe(1.04);
    expect(fastDrinkMeal([coffee])).toBe(false);
    expect(teaPastryMeal([tea, 'scone'])).toBe(true);
    recordServings(state, Array(100).fill(coffee));
    expect(styleSaleMultiplier(state, coffee)).toBe(1.12);
    expect(styleStages(state, 'coffee')[0].goals.find((g) => g.id === 'coffee30')?.done).toBe(true);
    expect(styleStages(state, 'coffee')[1].goals.find((g) => g.id === 'coffeeSignature1')?.current).toBe(1);
    deleteSignature(state, coffee);
    expect(styleStages(reload(state), 'coffee')[2].goals.find((g) => g.id === 'coffeeSignature2')?.current).toBe(1);
  });

  it.each([.25, .5, .75])('can recover a stranded %s-bean trial remainder exactly once', (beans) => {
    const state = reload(fixture());
    state.goal = GOALS.length;
    state.pantry.beans = beans;
    expect(canEmergencyRestock(state)).toBe(true);
    expect(emergencyRestock(state)).toBe(true);
    expect(state.pantry.beans).toBe(beans + 1);
    expect(emergencyRestock(state)).toBe(false);
    expect(state.pantry.beans).toBe(beans + 1);
    expect(canEmergencyRestock(reload(state))).toBe(false);
    const stranded = reload(fixture());
    stranded.goal = GOALS.length;
    stranded.pantry.beans = beans;
    stranded.coins = 1 - beans;
    // Ingredient purchases are whole units, so fractions are not affordable stock.
    expect(canEmergencyRestock(stranded)).toBe(true);
  });

  it('keeps emergency recovery usable with saved recipes and quarter pantry while rejecting corrupt signatures', () => {
    const state = reload(fixture());
    state.goal = GOALS.length;
    state.pantry.beans = 0;
    state.pantry.milk = .75;
    expect(canEmergencyRestock(state)).toBe(true);
    const invalid = structuredClone(state);
    invalid.signatureDrinks.recipes.push({ id: 'sig:bad', name: 'Bad', onMenu: true });
    expect(canEmergencyRestock(invalid)).toBe(false);
    const fakeItem = structuredClone(state);
    fakeItem.items['sig:bad'] = 1;
    expect(canEmergencyRestock(fakeItem)).toBe(false);
    const overLevel = structuredClone(state);
    overLevel.items[coffee] = 2;
    expect(canEmergencyRestock(overLevel)).toBe(false);
    const badPantry = structuredClone(state);
    badPantry.pantry.milk = .1;
    expect(canEmergencyRestock(badPantry)).toBe(false);
  });

  it('restores an in-flight custom order, delivers once, and rejects missing or corrupt recipes', () => {
    const state = fixture();
    state.onMenu = [];
    openShop(state);
    const sim = new Sim(() => 0);
    until(state, sim, () => sim.customers.some((c) => c.phase === 'waiting'));
    sim.beginClosing(state);
    expect(state.signatureDrinks.served[coffee]).toBeUndefined();
    const snapshot = sim.snapshot(state);
    expect(snapshot.customers[0].order).toBe(coffee);
    const loaded = reload(state);
    expect(validSnapshot(snapshot, loaded)).toBe(true);
    const missing = reload(state);
    missing.signatureDrinks.recipes = [];
    expect(validSnapshot(snapshot, missing)).toBe(false);
    const corrupt = structuredClone(snapshot);
    corrupt.customers[0].order = 'sig:coffee:beans=999';
    expect(validSnapshot(corrupt, loaded)).toBe(false);
    const restored = new Sim(() => 0);
    expect(restored.restore(snapshot, loaded)).toBe(true);
    until(loaded, restored, () => loaded.today.served === 1);
    expect(loaded.signatureDrinks.served[coffee]).toBe(1);
    expect(loaded.taste.served[coffee]).toBe(1);
    expect(loaded.today.sales[coffee]).toBe(1);
    const paid = reload(loaded);
    const resumed = new Sim(() => 0);
    expect(resumed.restore(restored.snapshot(loaded), paid)).toBe(true);
    until(paid, resumed, () => resumed.customers.length === 0);
    expect(paid.signatureDrinks.served[coffee]).toBe(1);
  });
});
