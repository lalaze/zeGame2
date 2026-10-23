import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from './data';
import { finishDay, openShop } from './day';
import { buyIngredient, buyItem, consumeServing, restock, restockQuote, servingsLeft, servingCost } from './economy';
import { KITCHEN_COST, shelveBatch, startBatch, unlockKitchen } from './kitchen';
import { adoptCat, CARE_SECONDS, catDef, refillPet, updatePetCare } from './pets';
import { bookPromotion, promotionPlan, updatePromotion } from './promotion';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize, type GameState } from './state';

const pantryValue = (s: GameState) => INGREDIENTS.reduce((sum, ing) => sum + s.pantry[ing.id] * ing.cost, 0);
const careValue = (s: GameState) => s.pets.reduce((sum, pet) => sum + pet.careSeconds / CARE_SECONDS * catDef(pet.id)!.careCost, 0);
const promotionValue = (s: GameState) => s.promotion ? s.promotion.remaining / promotionPlan(s.promotion.id)!.seconds * promotionPlan(s.promotion.id)!.cost : 0;
const liquidValue = (s: GameState) => s.coins + pantryValue(s) + careValue(s) + promotionValue(s);
function emptyShop() {
  const s = createInitialState(0);
  for (const ing of INGREDIENTS) s.pantry[ing.id] = 0;
  s.coins = 3000;
  return s;
}

describe('economy accounting invariants', () => {
  it('reconciles cash, unused stock, prepayments and capital to full-day operating profit', () => {
    const s = emptyShop();
    const initial = liquidValue(s);
    expect(unlockKitchen(s)).toBe(true);
    expect(buyItem(s, 'roll', 1)).toBe(true);
    expect(adoptCat(s, 'ginger')).toBe(true);
    expect(bookPromotion(s, 'noteLocal')).toBe(true);
    expect(buyIngredient(s, 'beans', 100)).toBe(true);
    expect(buyIngredient(s, 'flour', 20)).toBe(true);
    expect(buyIngredient(s, 'butter', 20)).toBe(true);
    s.bakePlan.roll = 3;
    const capital = KITCHEN_COST + 30 + catDef('ginger')!.adoption - catDef('ginger')!.careCost;
    expect(liquidValue(s) + capital).toBeCloseTo(initial);
    let seed = 7;
    const sim = new Sim(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; });
    openShop(s);
    for (let i = 0; i < 3600; i++) sim.update(s, 0.05);
    sim.beginClosing(s);
    for (let i = 0; i < 2400 && !sim.finishedService; i++) sim.update(s, 0.05);
    expect(sim.finishedService).toBe(true);
    const beforeClose = s.coins;
    const report = sim.closeShop(s)!;
    expect(report.served).toBeGreaterThan(0);
    expect(s.coins).toBe(beforeClose);
    expect(liquidValue(s) - initial + capital).toBeCloseTo(report.profit, 7);
    expect(report.profit).toBeCloseTo(report.revenue - report.ingredientCost - report.petCost - report.promotionCost);
  });

  it('expenses bought ingredients once when consumed, including an unsold paid batch', () => {
    const s = emptyShop(); s.kitchen = true; s.items.roll = 1; s.onMenu = ['espresso', 'roll']; s.bakePlan.roll = 0;
    buyIngredient(s, 'beans', 2); buyIngredient(s, 'flour', 4); buyIngredient(s, 'butter', 4);
    expect(s.today.ingredientCost).toBe(0);
    const paidCash = s.coins;
    openShop(s);
    expect(consumeServing(s, 'espresso', s.today)).toBe(true);
    startBatch(s, 'roll', 4);
    expect(s.inProduction.roll).toBe(4);
    expect(s.today.ingredientCost).toBe(1 + 4 * servingCost('roll'));
    shelveBatch(s, 'roll', 4);
    expect(consumeServing(s, 'roll', s.today)).toBe(true);
    const report = finishDay(s);
    expect(report.stale.roll).toBe(3);
    expect(report.staleCost).toBe(12);
    expect(report.ingredientCost).toBe(17);
    expect(report.profit).toBe(-17);
    expect(s.coins).toBe(paidCash);
    expect(s.pantry.beans).toBe(1);
  });

  it('preserves promotion prepayment over closing and reload and allocates the fee exactly once', () => {
    let s = emptyShop(); const initial = liquidValue(s);
    bookPromotion(s, 'noteLocal'); openShop(s); updatePromotion(s, 90);
    const first = finishDay(s);
    s = deserialize(serialize(s), 86400000);
    expect(liquidValue(s) - initial).toBeCloseTo(first.profit);
    const cash = s.coins;
    openShop(s); updatePromotion(s, 1000);
    const second = finishDay(s);
    expect(first.promotionCost + second.promotionCost).toBeCloseTo(50);
    expect(s.coins).toBe(cash);
    expect(s.promotion).toBeNull();
    expect(liquidValue(s) - initial).toBeCloseTo(first.profit + second.profit);
  });

  it('splits adoption into capital and included care, and carries unused refill value', () => {
    const s = emptyShop(); const initial = liquidValue(s);
    adoptCat(s, 'ginger');
    const capital = 300 - 8;
    expect(liquidValue(s) + capital).toBe(initial);
    refillPet(s, 'ginger');
    expect(liquidValue(s) + capital).toBe(initial);
    const cash = s.coins;
    openShop(s); updatePetCare(s, 270);
    const first = finishDay(s);
    expect(first.petCost).toBe(12);
    expect(careValue(s)).toBe(4);
    expect(s.coins).toBe(cash);
    expect(liquidValue(s) - initial + capital).toBe(first.profit);
    openShop(s); updatePetCare(s, 90);
    const second = finishDay(s);
    expect(first.petCost + second.petCost).toBe(16);
    expect(careValue(s)).toBe(0);
    expect(s.coins).toBe(cash);
  });

  it.each([NaN, Infinity, -Infinity, -1, 0, 0.5, 1.5])('rejects invalid ingredient quantity %s without mutating cash or inventory', (count) => {
    const s = emptyShop(); const before = structuredClone(s);
    expect(buyIngredient(s, 'beans', count)).toBe(false);
    expect(s).toEqual(before);
  });

  it('cannot shelve an unpaid batch or credit the same batch twice', () => {
    const s = emptyShop(); s.kitchen = true; s.items.roll = 1; s.onMenu = ['roll']; s.bakePlan.roll = 0;
    buyIngredient(s, 'flour', 2); buyIngredient(s, 'butter', 2); openShop(s);
    shelveBatch(s, 'roll', 2);
    expect(s.shelf.roll ?? 0).toBe(0);
    startBatch(s, 'roll', 2); shelveBatch(s, 'roll', 2); shelveBatch(s, 'roll', 2);
    expect(s.shelf.roll).toBe(2);
    expect(s.today.baked.roll).toBe(2);
    expect(s.today.ingredientCost).toBe(8);
  });

  it('rejects shelving more than the quantity paid into production', () => {
    const s = emptyShop(); s.kitchen = true; s.items.roll = 1; s.onMenu = ['roll']; s.bakePlan.roll = 0;
    buyIngredient(s, 'flour', 2); buyIngredient(s, 'butter', 2); openShop(s);
    startBatch(s, 'roll', 2); shelveBatch(s, 'roll', 3);
    expect(s.shelf.roll ?? 0).toBe(0);
    expect(s.inProduction.roll).toBe(2);
    expect(s.today.ingredientCost).toBe(8);
  });

  it('uses a tiny available budget to complete an affordable menu recipe', () => {
    const s = emptyShop(); s.coins = 1; s.items.latte = 1; s.onMenu = ['espresso', 'latte'];
    expect(restockQuote(s).cost).toBeGreaterThan(s.coins);
    expect(restock(s)).toBe(true);
    expect(servingsLeft(s, 'espresso')).toBeGreaterThanOrEqual(1);
    expect(s.coins).toBeGreaterThanOrEqual(0);
  });

  it('does not spend a scarce budget on unusable fragments of several recipes', () => {
    const s = emptyShop(); s.coins = 9; s.items.latte = 1; s.items.hotchoc = 1; s.onMenu = ['latte', 'hotchoc'];
    expect(restockQuote(s).cost).toBeGreaterThan(s.coins);
    expect(restock(s)).toBe(true);
    expect(s.coins).toBe(6);
    expect(s.pantry.beans).toBe(1);
    expect(s.pantry.milk).toBe(1);
    expect(servingsLeft(s, 'latte')).toBe(1);
  });

  it('preserves scarce cash when no selected recipe can be completed', () => {
    const s = emptyShop(); s.coins = 2; s.items.latte = 1; s.onMenu = ['latte'];
    const before = structuredClone(s);
    expect(restock(s)).toBe(false);
    expect(s).toEqual(before);
  });


  it.each(['shelf', 'inProduction'] as const)('keeps proportional ordering when paid %s supply is already available', (source) => {
    const s = emptyShop(); s.kitchen = true; s.coins = 9;
    s.items.latte = 1; s.items.hotchoc = 1; s.items.roll = 1;
    s.onMenu = ['latte', 'hotchoc', 'roll']; s.phase = 'open'; s[source].roll = 100;
    const quote = restockQuote(s);
    const share = Math.min(1, s.coins / quote.cost);
    const expected = { ...s.pantry };
    let spent = 0;
    for (const ing of INGREDIENTS) {
      const n = Math.floor((quote.buy[ing.id] ?? 0) * share);
      expected[ing.id] += n;
      spent += n * ing.cost;
    }
    expect(restock(s)).toBe(spent > 0);
    expect(s.pantry).toEqual(expected);
    expect(s.coins).toBe(9 - spent);
    expect(s[source].roll).toBe(100);
  });

});
