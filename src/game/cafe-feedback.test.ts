import { describe, expect, it } from 'vitest';
import { createInitialState, serialize, deserialize } from './state';
import { availableSignatureIngredients, makeSignatureId, signatureDefinition } from './signature-drinks';
import { restockPlan, restock, restockQuote, salePrice, prepTime, readyServings, menuItems, consumeServing, hasServiceSupply } from './economy';
import { tasteScore } from './taste';
import { setCafeStyle, startStyleWelcome, nextStyleGoal } from './styles';
import { adoptCat, updatePetCare } from './pets';
import { finishDay, openShop } from './day';
import { Sim } from './sim';
import { DAY_SECONDS } from './data';

describe('café feedback regressions', () => {
  it('gives new blends usable additions and a house premium while plain copies retain the base price', () => {
    const s = createInitialState(0); s.items.espresso = 2; s.taste.served.espresso = 30;
    expect(availableSignatureIngredients(s)).toEqual(expect.arrayContaining(['beans', 'milk', 'sugar']));
    const id = makeSignatureId('coffee', { beans: 1 })!;
    expect(salePrice(s, id)).toBeCloseTo(salePrice(s, 'espresso'));
    expect(prepTime(s, id)).toBe(prepTime(s, 'espresso'));
    expect(tasteScore(s, id)).toBeGreaterThanOrEqual(tasteScore(s, 'espresso'));
    const blend = makeSignatureId('coffee', { beans: 1, milk: 1 })!;
    expect(signatureDefinition(blend)!.prepTime).toBe(1.8);
    expect(salePrice(s, blend) - signatureDefinition(blend)!.cost).toBeGreaterThan(salePrice(s, 'espresso') - 1);
  });
  it('quotes precisely the affordable purchase, retained cash and remaining shortage', () => {
    const s = createInitialState(0); s.coins = 138.73; s.kitchen = true; s.items.roll = 1;
    s.onMenu = ['espresso', 'roll']; s.bakePlan.roll = 39;
    for (const ing of Object.keys(s.pantry)) s.pantry[ing as keyof typeof s.pantry] = 0;
    const before = structuredClone(s.pantry), full = restockQuote(s), plan = restockPlan(s);
    expect(plan.cost).toBeLessThanOrEqual(s.coins);
    expect(plan.missingCost).toBeGreaterThan(0);
    expect(plan.cost + plan.missingCost).toBe(full.cost);
    expect(restock(s)).toBe(true); expect(s.coins).toBeCloseTo(plan.balance);
    for (const ing of Object.keys(s.pantry) as (keyof typeof s.pantry)[]) expect(s.pantry[ing] - before[ing]).toBe(plan.buy[ing] ?? 0);
  });
  it('does not promise a purchase when the budget cannot buy a complete recipe', () => {
    const s = createInitialState(0); s.coins = .5; s.pantry.beans = 0;
    expect(restockPlan(s).cost).toBe(0); expect(restock(s)).toBe(false);
    expect(s.coins).toBe(.5);
  });
  it('offers distinct early actions, saves the foster visit and ends it at closing', () => {
    let s = createInitialState(0);
    expect(nextStyleGoal(s, 'cats')!.id).toBe('catWelcome');
    expect(nextStyleGoal(s, 'bakery')!.id).toBe('bakeryWelcome');
    setCafeStyle(s, 'cats'); expect(startStyleWelcome(s, 'cats')).toBe(true);
    const coins = s.coins; openShop(s); updatePetCare(s, 60);
    expect(s.coins).toBe(coins); expect(s.today.petCost).toBe(0);
    s = deserialize(serialize(s), 1);
    expect(s.pets[0].fosterUntilDay).toBe(1);
    finishDay(s); expect(s.pets).toHaveLength(0);
    setCafeStyle(s, 'coffee'); setCafeStyle(s, 'cats');
    expect(startStyleWelcome(s, 'cats')).toBe(false);
  });
  it('retains a foster cat only after paying for permanent adoption', () => {
    const s = createInitialState(0); s.coins = 300; setCafeStyle(s, 'cats'); startStyleWelcome(s, 'cats');
    expect(adoptCat(s, 'ginger')).toBe(true); expect(s.coins).toBe(0);
    openShop(s); finishDay(s); expect(s.pets).toHaveLength(1); expect(s.pets[0].fosterUntilDay).toBeUndefined();
  });
  it('lets the first batch sell without a kitchen, stops listing depleted samples and cannot repeat it', () => {
    let s = createInitialState(0); setCafeStyle(s, 'bakery');
    expect(startStyleWelcome(s, 'bakery')).toBe(true);
    s = deserialize(serialize(s), 1); expect(readyServings(s, 'roll')).toBe(6);
    openShop(s);
    for (let i = 0; i < 6; i++) expect(consumeServing(s, 'roll', s.today)).toBe(true);
    expect(menuItems(s).some(m => m.id === 'roll')).toBe(false);
    expect(consumeServing(s, 'roll', s.today)).toBe(false);
    finishDay(s); expect(s.shelf.roll).toBeUndefined(); expect(s.kitchen).toBe(false);
    expect(startStyleWelcome(s, 'bakery')).toBe(false);
  });
  it('resumes the same day after a restock and refuses to reopen after hours', () => {
    const s = createInitialState(0), sim = new Sim(); s.coins = 100; openShop(s);
    s.pantry.beans = 0; s.dayTime = 50; s.today.revenue = 25; sim.beginClosing(s);
    expect(sim.resumeAfterRestock(s)).toBe(false);
    restock(s); expect(hasServiceSupply(s)).toBe(true); expect(sim.resumeAfterRestock(s)).toBe(true);
    expect(s.day).toBe(1); expect(s.dayTime).toBe(50); expect(s.today.revenue).toBe(25);
    sim.beginClosing(s); s.dayTime = DAY_SECONDS;
    expect(sim.resumeAfterRestock(s)).toBe(false);
  });
});
