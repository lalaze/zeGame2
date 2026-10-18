import { describe, expect, it } from 'vitest';
import { INGREDIENTS, MENU, type IngredientId } from './data';
import { checkOpen, openShop } from './day';
import { consumeServing, dayDemand, dayNeeds, menuItems, prepTime, recipe, restock, restockQuote, salePrice, servingCost, servingsLeft, soldOutItems } from './economy';
import { operationStatus } from './operations';
import { mealReview, reviewCount } from './reputation';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize, type GameState } from './state';
import { makeSignatureId, saveSignature, setSignatureOnMenu, signatureDefinition, trialSignature, type SignatureBase, type SignatureRecipe } from './signature-drinks';
import { mealTaste, tasteScore } from './taste';

const blend = { beans: 1, milk: 2 } as const;
function ready(combo = false) {
  const s = createInitialState(0);
  s.items.latte = 1;
  s.coins = 10000;
  for (const ing of INGREDIENTS) s.pantry[ing.id] = 1000;
  const id = makeSignatureId('coffee', blend)!;
  expect(trialSignature(s, 'coffee', blend).ok).toBe(true);
  expect(saveSignature(s, id, 'Cloud Cream')).toBe(true);
  expect(setSignatureOnMenu(s, id, true)).toBe(true);
  s.onMenu = combo ? ['roll'] : [];
  if (combo) { s.kitchen = true; s.items.roll = 1; s.bakePlan.roll = 1; }
  return { s, id };
}
function until(s: GameState, sim: Sim, done: () => boolean) {
  for (let i = 0; i < 8000 && !done(); i++) sim.update(s, .05);
  expect(done()).toBe(true);
}

describe('signature drinks in real café operations', () => {
  it('gives richer milk an actual taste/review benefit without hiding its cost and preparation tradeoff', () => {
    const { s, id } = ready();
    const price = salePrice(s, id);
    expect(price).toBe(salePrice(s, 'latte'));
    expect(servingCost(id)).toBeGreaterThan(servingCost('latte'));
    expect(prepTime(s, id)).toBeGreaterThan(prepTime(s, 'latte'));
    expect(signatureDefinition(id)!.quality).toBe(4.3);
    expect(mealTaste(s, [id])).toBeGreaterThan(mealTaste(s, ['latte']));
    expect(mealReview(s, [id], 8, false).stars).toBe(4.3);
    expect(mealReview(s, ['latte'], 8, false).stars).toBe(4);
    // Quality cannot erase a genuinely slow service review.
    expect(mealReview(s, [id], 35, false).stars).toBe(3);
    s.signatureDrinks.served[id] = 30;
    expect(tasteScore(s, id)).toBe(4.6);
    s.signatureDrinks.served[id] = 100;
    expect(tasteScore(s, id)).toBe(4.8);
    expect(salePrice(s, id)).toBe(price);
  });

  it.each([
    ['coffee', { beans: 1 }], ['tea', { tea: 1, milk: 1 }],
    ['milk', { milk: 1, sugar: 1 }], ['fruit', { fruit: 1, milk: 1 }],
  ] as [SignatureBase, SignatureRecipe][])('actually serves a %s-base custom drink through the barista', (base, formula) => {
    const s = createInitialState(0);
    for (const m of MENU) s.items[m.id] = 1;
    for (const ing of INGREDIENTS) s.pantry[ing.id] = 1000;
    const id = makeSignatureId(base, formula)!;
    expect(trialSignature(s, base, formula).ok).toBe(true);
    expect(saveSignature(s, id, 'Base integration')).toBe(true);
    expect(setSignatureOnMenu(s, id, true)).toBe(true);
    s.onMenu = [];
    const pantry = { ...s.pantry };
    openShop(s);
    const sim = new Sim(() => 0);
    until(s, sim, () => sim.customers.some(c => c.phase === 'toCounter'));
    sim.beginClosing(s);
    until(s, sim, () => sim.finishedService);
    expect(s.today.sales[id]).toBe(1);
    expect(s.signatureDrinks.served[id]).toBe(1);
    expect(s.today.ingredientCost).toBeCloseTo(servingCost(id));
    for (const [ing, dose] of recipe(id)) expect(s.pantry[ing]).toBe(pantry[ing] - dose);
    expect(s.reputation.recent[0].items).toEqual([id]);
  });

  it('forecasts every recipe dose, replenishes it, and reports shortages without partial consumption', () => {
    const { s, id } = ready();
    expect(menuItems(s).map(m => m.id)).toEqual([id]);
    expect(recipe(id)).toEqual([['beans', 1], ['milk', 2]]);
    const demand = dayDemand(s).get(id)!;
    expect(demand).toBeGreaterThan(0);
    expect(dayNeeds(s)).toEqual({ beans: Math.ceil(demand * 1.15), milk: Math.ceil(demand * 2.3) });
    for (const ing of INGREDIENTS) s.pantry[ing.id] = 0;
    expect(checkOpen(s)).toEqual({ ok: false, reason: 'lowStock', items: [id] });
    expect(soldOutItems(s).map(m => m.id)).toEqual([id]);
    const q = restockQuote(s), cash = s.coins;
    expect(restock(s)).toBe(true);
    expect(s.coins).toBeCloseTo(cash - q.cost);
    for (const [ing, amount] of Object.entries(dayNeeds(s))) expect(s.pantry[ing as IngredientId]).toBe(amount);
    expect(checkOpen(s)).toEqual({ ok: true });
    expect(restock(s)).toBe(false);
    s.pantry.milk = 1;
    const before = { ...s.pantry };
    expect(servingsLeft(s, id)).toBe(0);
    expect(consumeServing(s, id, s.today)).toBe(false);
    expect(s.pantry).toEqual(before);
    expect(s.today.ingredientCost).toBe(0);
    expect(operationStatus(s, new Sim())).toMatchObject({ kind: 'ingredients', ingredients: ['milk'] });
  });

  it('restocks one complete custom recipe when the budget cannot cover the forecast', () => {
    const { s, id } = ready();
    for (const ing of INGREDIENTS) s.pantry[ing.id] = 0;
    s.coins = servingCost(id);
    expect(restock(s)).toBe(true);
    expect(servingsLeft(s, id)).toBe(1);
    expect(s.coins).toBeCloseTo(0);
  });

  it('pays a real combo once, practices only at handoff, and survives closing refreshes', () => {
    const { s, id } = ready(true);
    s.signatureDrinks.served[id] = 29;
    const pantry = { ...s.pantry };
    const coins = s.coins;
    openShop(s);
    const sim = new Sim(() => 0);
    until(s, sim, () => sim.customers.some(c => c.phase === 'toCounter'));
    sim.beginClosing(s);
    until(s, sim, () => sim.customers.some(c => c.phase === 'waiting'));
    expect(s.today.served).toBe(0);
    expect(s.coins).toBe(coins);
    expect(s.signatureDrinks.served[id]).toBe(29);
    expect(s.pantry.beans).toBe(pantry.beans - 1);
    expect(s.pantry.milk).toBe(pantry.milk - 2);
    expect(s.today.ingredientCost).toBeCloseTo(servingCost(id) + ((s.today.baked.roll ?? 0) + (s.inProduction.roll ?? 0)) * servingCost('roll'));
    const loaded = deserialize(serialize(s), 0);
    const restored = new Sim(() => 0);
    expect(restored.restore(sim.snapshot(s), loaded)).toBe(true);
    const paidCost = loaded.today.ingredientCost;
    until(loaded, restored, () => loaded.today.served === 1);
    expect(loaded.today.sales).toEqual({ roll: 1, [id]: 1 });
    expect(loaded.signatureDrinks.served[id]).toBe(30);
    expect(tasteScore(loaded, id)).toBeCloseTo(signatureDefinition(id)!.quality + .3);
    expect(loaded.reputation.recent[0].items).toEqual(expect.arrayContaining([id, 'roll']));
    expect(loaded.reputation.recent[0].taste).toBe(4.2); // The handoff uses pre-practice recipe quality.
    const customer = restored.customers.find(c => c.hasCup)!;
    expect(loaded.today.revenue).toBeCloseTo(salePrice(loaded, id, customer.vip, customer.dineIn, [id, 'roll']) + salePrice(loaded, 'roll', customer.vip, customer.dineIn, [id, 'roll']));
    const paid = new Sim(() => 0);
    expect(paid.restore(restored.snapshot(loaded), loaded)).toBe(true);
    until(loaded, paid, () => paid.finishedService);
    expect(loaded.today.ingredientCost).toBe(paidCost);
    expect(loaded.signatureDrinks.served[id]).toBe(30);
    expect(reviewCount(loaded.today.reviews)).toBe(1);
    const report = paid.closeShop(loaded)!;
    expect(report.sales[id]).toBe(1);
    expect(report.profit).toBeCloseTo(report.revenue - report.ingredientCost);
    expect(paid.closeShop(loaded)).toBeNull();
    expect(loaded.day).toBe(2);
  });

  it('records a real stockout without payment, practice, or negative pantry stock', () => {
    const { s, id } = ready();
    // Espresso keeps the café open while the selected custom drink is sold out.
    s.onMenu = ['espresso'];
    s.pantry.milk = 1;
    openShop(s);
    const sim = new Sim(() => .99);
    until(s, sim, () => s.today.soldOut > 0);
    sim.beginClosing(s);
    until(s, sim, () => sim.finishedService);
    expect(s.today.shortages[id]).toBeGreaterThan(0);
    expect(s.today.revenue).toBe(0);
    expect(s.today.ingredientCost).toBe(0);
    expect(s.signatureDrinks.served[id] ?? 0).toBe(0);
    expect(s.pantry.milk).toBe(1);
  });
});
