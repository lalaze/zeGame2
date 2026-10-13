import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize } from './state';
import { restock, restockQuote, servingsLeft } from './economy';
import { canEmergencyRestock, emergencyRestock } from './recovery';
import { GOALS } from './goals';
import { makeSignatureId, saveSignature, setSignatureOnMenu, trialSignature } from './signature-drinks';

describe('whole-unit purchases after fractional signature tastings', () => {
  it.each([.25, .5, .75])('recovers a stranded %s-bean balance rather than treating unavailable fractions as purchasable', (beans) => {
    const s = createInitialState(0);
    s.goal = GOALS.length;
    s.pantry.beans = beans;
    s.coins = 1 - beans;
    expect(restock(s)).toBe(false);
    expect(canEmergencyRestock(s)).toBe(true);
    expect(emergencyRestock(s)).toBe(true);
    expect(servingsLeft(s, 'espresso')).toBe(1);
    expect(canEmergencyRestock(s)).toBe(false);
    expect(deserialize(serialize(s), 0).pantry.beans).toBe(beans + 1);
  });
  it('quotes and buys whole units until a fractional pantry fully meets forecast', () => {
    const s = createInitialState(0);
    s.pantry.beans = .75;
    s.coins = 1000;
    const q = restockQuote(s);
    expect(Number.isInteger(q.buy.beans)).toBe(true);
    const before = s.coins;
    expect(restock(s)).toBe(true);
    expect(s.coins).toBe(before - q.cost);
    expect(s.pantry.beans).toBe(.75 + q.buy.beans!);
    expect(restockQuote(s).cost).toBe(0);
    expect(restock(s)).toBe(false);
  });
  it('scarce-cash fallback buys every whole unit needed for a complete custom recipe', () => {
    const s = createInitialState(0);
    s.items.latte = 1;
    s.pantry.beans = 1;
    s.pantry.milk = 1;
    const formula = { beans: 1, milk: 1 };
    trialSignature(s, 'coffee', formula);
    const id = makeSignatureId('coffee', formula)!;
    saveSignature(s, id, 'Quarter remainder');
    setSignatureOnMenu(s, id, true);
    s.onMenu = [];
    s.coins = 3; // one bean ($1) and one milk ($2)
    expect(restock(s)).toBe(true);
    expect(servingsLeft(s, id)).toBe(1);
    expect(s.pantry.beans).toBe(1.75);
    expect(s.pantry.milk).toBe(1.75);
    expect(s.coins).toBe(0);
  });
});
