import { describe, it, expect } from 'vitest';
import { INGREDIENTS, MENU } from './data';
import { availableSignatureIngredients, compatibleSignatureAddons, deleteSignature, emptySignatureDrinks, makeSignatureId, parseSignatureDrinks, renameSignature, replaceSignature, saveSignature, setSignatureOnMenu, signatureDefinition, trialSignature, validateSignatureRecipe, type SignatureBase, type SignatureGameState, type SignatureRecipe } from './signature-drinks';

function shop(all = true): SignatureGameState {
  return { phase: 'prep', kitchen: all, items: Object.fromEntries(MENU.map((m) => [m.id, all || m.id === 'espresso' ? 1 : 0])), pantry: Object.fromEntries(INGREDIENTS.map((i) => [i.id, 100])) as SignatureGameState['pantry'], signatureDrinks: emptySignatureDrinks() };
}
const examples: [SignatureBase, SignatureRecipe][] = [
  ['coffee', { beans: 1, milk: 1 }], ['coffee', { beans: 2, sugar: 1 }], ['coffee', { beans: 1, cocoa: 1, cream: 1 }],
  ['tea', { tea: 1, fruit: 1 }], ['tea', { tea: 2, milk: 1 }], ['tea', { tea: 1, spice: 1, sugar: 1 }],
  ['milk', { milk: 1, cocoa: 1 }], ['milk', { milk: 2, matcha: 1 }], ['milk', { milk: 1, fruit: 1, sugar: 1 }],
  ['fruit', { fruit: 1, sugar: 1 }], ['fruit', { fruit: 2, milk: 1 }], ['fruit', { fruit: 1, cream: 1, spice: 1 }],
];
const idOf = (index = 0) => makeSignatureId(...examples[index])!;
function saveExample(s: SignatureGameState, i = 0) {
  expect(trialSignature(s, ...examples[i]).ok).toBe(true);
  expect(saveSignature(s, idOf(i), `Drink ${i}`)).toBe(true);
}

describe('signature recipe rules', () => {
  it('offers at least twelve viable, distinct recipes across all four bases', () => {
    const s = shop();
    const ids = examples.map(([base, recipe]) => {
      const trial = trialSignature(s, base, recipe);
      expect(trial.ok).toBe(true);
      const def = signatureDefinition(trial.id!)!;
      expect(def.basePrice).toBeCloseTo(def.cost * 1.6 + 2);
      expect(def.prepTime).toBeGreaterThanOrEqual(3.65);
      expect(def.flavor.length).toBeGreaterThan(0);
      expect(def.feedback.length).toBeGreaterThan(0);
      return trial.id;
    });
    expect(new Set(ids).size).toBe(12);
  });
  it('canonicalizes ordering and zero controls but rejects alternate ID spellings', () => {
    expect(makeSignatureId('coffee', { milk: 1, beans: 1, sugar: 0 })).toBe(idOf());
    expect(signatureDefinition('sig:coffee:milk=1,beans=1')).toBeNull();
    expect(signatureDefinition('sig:coffee:beans=1,beans=1')).toBeNull();
    expect(signatureDefinition('sig:coffee:beans=01')).toBeNull();
    expect(signatureDefinition('sig:coffee:beans=1,flour=1')).toBeNull();
  });
  it('rejects invalid doses, bases, ingredients, addon caps and total units', () => {
    for (const recipe of [{ beans: 0 }, { beans: 3 }, { beans: 1.5 }, { beans: -1 }, { beans: NaN }, { beans: Infinity }, { beans: '1' }, { beans: 1, tea: 1 }, { beans: 1, flour: 1 }, { beans: 2, milk: 2, sugar: 2, cream: 2 }, { beans: 1, milk: 1, sugar: 1, cream: 1, spice: 1 }]) {
      expect(validateSignatureRecipe('coffee', recipe).ok).toBe(false);
    }
    expect(validateSignatureRecipe('juice', { fruit: 1 }).ok).toBe(false);
    expect(validateSignatureRecipe('coffee', null).ok).toBe(false);
    expect(validateSignatureRecipe('coffee', { beans: 2, milk: 2, sugar: 1, cream: 1 }).ok).toBe(true);
  });
  it('applies explicit compatibility both to validation and UI choices', () => {
    for (const [base, recipe] of [['coffee', { beans: 1, fruit: 1 }], ['coffee', { beans: 1, matcha: 1 }], ['tea', { tea: 1, cocoa: 1 }], ['milk', { milk: 1, cocoa: 1, fruit: 1 }]] as [SignatureBase, SignatureRecipe][]) expect(validateSignatureRecipe(base, recipe).error).toBe('incompatible');
    expect(compatibleSignatureAddons('coffee')).not.toContain('fruit');
    expect(compatibleSignatureAddons('milk', { fruit: 1 })).not.toContain('cocoa');
    expect(compatibleSignatureAddons('fruit')).not.toContain('fruit');
  });
  it('unlocks ingredients through usable purchased recipes, not pantry stock', () => {
    const s = shop(false);
    expect(availableSignatureIngredients(s)).toEqual(['beans']);
    expect(trialSignature(s, ...examples[0]).error).toBe('locked');
    s.items.latte = 1;
    expect(trialSignature(s, ...examples[0]).ok).toBe(true);
    s.items.roll = 1;
    expect(availableSignatureIngredients(s)).not.toContain('butter');
    s.kitchen = true;
    expect(availableSignatureIngredients(s)).toContain('butter');
  });
  it('charges exactly one quarter serving, never records a sale or debits a failed trial', () => {
    const s = shop();
    s.pantry.beans = 0.2;
    s.pantry.milk = 0;
    const before = JSON.stringify(s);
    expect(trialSignature(s, ...examples[0]).missing).toEqual({ beans: 0.25 - 0.2, milk: 0.25 });
    expect(JSON.stringify(s)).toBe(before);
    s.pantry.beans = s.pantry.milk = 1;
    expect(trialSignature(s, ...examples[0]).ok).toBe(true);
    expect(s.pantry.beans).toBe(0.75);
    expect(s.pantry.milk).toBe(0.75);
    expect(s.signatureDrinks!.served).toEqual({});
    expect(trialSignature(s, ...examples[0]).ok).toBe(true);
    expect(s.signatureDrinks!.tested).toEqual([idOf()]);
  });
  it('requires a matching tested canonical recipe and saves without ingredient debit', () => {
    const s = shop();
    expect(saveSignature(s, idOf(), 'Latte')).toBe(false);
    trialSignature(s, ...examples[0]);
    const pantry = { ...s.pantry };
    expect(saveSignature(s, idOf(1), 'Untested')).toBe(false);
    expect(saveSignature(s, idOf(), '  House milk  ')).toBe(true);
    expect(s.pantry).toEqual(pantry);
    expect(saveSignature(s, idOf(), 'Duplicate')).toBe(false);
    expect(s.signatureDrinks!.recipes[0]).toEqual({ id: idOf(), name: 'House milk', onMenu: false });
  });
  it('limits collection to six and daily listings to three', () => {
    const s = shop();
    for (let i = 0; i < 6; i++) saveExample(s, i);
    trialSignature(s, ...examples[6]);
    expect(saveSignature(s, idOf(6), 'Seventh')).toBe(false);
    for (let i = 0; i < 3; i++) expect(setSignatureOnMenu(s, idOf(i), true)).toBe(true);
    expect(setSignatureOnMenu(s, idOf(3), true)).toBe(false);
    expect(setSignatureOnMenu(s, idOf(0), false)).toBe(true);
    expect(setSignatureOnMenu(s, idOf(3), true)).toBe(true);
  });
  it('blocks every player mutation during open and closing', () => {
    const s = shop();
    saveExample(s);
    for (const phase of ['open', 'closing'] as const) {
      s.phase = phase;
      const before = JSON.stringify(s);
      expect(trialSignature(s, ...examples[1]).error).toBe('open');
      expect(saveSignature(s, idOf(1), 'New')).toBe(false);
      expect(renameSignature(s, idOf(), 'New')).toBe(false);
      expect(deleteSignature(s, idOf())).toBe(false);
      expect(setSignatureOnMenu(s, idOf(), true)).toBe(false);
      expect(JSON.stringify(s)).toBe(before);
    }
  });
  it('retains immutable definitions, trials and practice through rename/delete/resave', () => {
    const s = shop();
    saveExample(s);
    const def = signatureDefinition(idOf());
    s.signatureDrinks!.served[idOf()] = 83;
    expect(renameSignature(s, idOf(), 'New name')).toBe(true);
    expect(deleteSignature(s, idOf())).toBe(true);
    expect(signatureDefinition(idOf())).toEqual(def);
    s.signatureDrinks = parseSignatureDrinks(JSON.parse(JSON.stringify(s.signatureDrinks)));
    expect(s.signatureDrinks.served[idOf()]).toBe(83);
    expect(saveSignature(s, idOf(), 'Reborn')).toBe(true);
    expect(s.signatureDrinks.served[idOf()]).toBe(83);
  });
  it('normalizes malicious and duplicate saved state and caps listed recipes', () => {
    const tested = examples.map((_, i) => idOf(i));
    const parsed = parseSignatureDrinks({ tested: [...tested, idOf(), 'bad'], served: { [idOf()]: 2_000_000_000, [idOf(1)]: -2, [idOf(2)]: 0.5, bad: 500 }, recipes: [null, { id: idOf(), name: '' }, ...tested.map((id) => ({ id, name: ' Recipe ', onMenu: true }))] });
    expect(parsed.tested).toEqual(tested);
    expect(parsed.recipes).toHaveLength(6);
    expect(parsed.recipes.filter((r) => r.onMenu)).toHaveLength(3);
    expect(parsed.served).toEqual({ [idOf()]: 1_000_000_000 });
    expect(parseSignatureDrinks({ recipes: [{ id: idOf(), name: 'Untried' }] }).recipes).toEqual([]);
    expect(parseSignatureDrinks(null)).toEqual(emptySignatureDrinks());
  });
  it('atomically replaces a formula at capacity and preserves its menu slot', () => {
    const s = shop();
    for (let i = 0; i < 6; i++) saveExample(s, i);
    setSignatureOnMenu(s, idOf(), true);
    const before = JSON.stringify(s);
    expect(replaceSignature(s, idOf(), idOf(6), 'Untested')).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    trialSignature(s, ...examples[6]);
    expect(replaceSignature(s, idOf(), idOf(6), 'Updated')).toBe(true);
    expect(s.signatureDrinks!.recipes).toHaveLength(6);
    expect(s.signatureDrinks!.recipes[0]).toEqual({ id: idOf(6), name: 'Updated', onMenu: true });
    expect(signatureDefinition(idOf())).not.toBeNull();
    expect(s.signatureDrinks!.tested).toContain(idOf());
  });
  it('rejects duplicate replacements and every unsafe replacement atomically', () => {
    const s = shop();
    saveExample(s, 0);
    saveExample(s, 1);
    const before = JSON.stringify(s);
    expect(replaceSignature(s, idOf(), idOf(1), 'Duplicate')).toBe(false);
    expect(replaceSignature(s, 'bad', idOf(), 'Missing')).toBe(false);
    expect(replaceSignature(s, idOf(), 'bad', 'Invalid')).toBe(false);
    expect(replaceSignature(s, idOf(), idOf(), '   ')).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    for (const phase of ['open', 'closing'] as const) {
      s.phase = phase;
      const snapshot = JSON.stringify(s);
      expect(replaceSignature(s, idOf(), idOf(), 'Renamed')).toBe(false);
      expect(JSON.stringify(s)).toBe(snapshot);
    }
    s.phase = 'prep';
    expect(replaceSignature(s, idOf(), idOf(), 'Same formula')).toBe(true);
    s.items.latte = 0;
    // Lock every other milk-using menu before checking ingredient availability.
    for (const id of Object.keys(s.items)) s.items[id] = id === 'espresso' ? 1 : 0;
    const snapshot = JSON.stringify(s);
    expect(replaceSignature(s, idOf(), idOf(), 'Now locked')).toBe(false);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
  it('never transfers practice to a different formula and restores original practice on return', () => {
    const s = shop();
    saveExample(s, 0);
    trialSignature(s, ...examples[1]);
    s.signatureDrinks!.served[idOf()] = 99;
    expect(replaceSignature(s, idOf(), idOf(1), 'New')).toBe(true);
    expect(s.signatureDrinks!.served[idOf(1)] ?? 0).toBe(0);
    s.signatureDrinks!.served[idOf(1)] = 3;
    expect(replaceSignature(s, idOf(1), idOf(), 'Original')).toBe(true);
    expect(s.signatureDrinks!.served[idOf()]).toBe(99);
    expect(s.signatureDrinks!.served[idOf(1)]).toBe(3);
    s.signatureDrinks = parseSignatureDrinks(JSON.parse(JSON.stringify(s.signatureDrinks)));
    expect(s.signatureDrinks.served).toEqual({ [idOf()]: 99, [idOf(1)]: 3 });
  });

  it('assigns bounded deterministic sensory quality without changing economy', () => {
    const qualities: [SignatureRecipe, number][] = [
      [{ beans: 1 }, 4],
      [{ beans: 1, milk: 1 }, 4.1],
      [{ beans: 1, milk: 2 }, 4.3],
      [{ beans: 1, sugar: 2 }, 3.9],
      [{ beans: 1, sugar: 2, spice: 2, cocoa: 1 }, 3.7],
      [{ beans: 1, milk: 2, cream: 2 }, 4.2],
    ];
    const observed = new Set<number>();
    for (const [recipe, expected] of qualities) {
      const id = makeSignatureId('coffee', recipe)!;
      const def = signatureDefinition(id)!;
      expect(def.quality).toBe(expected);
      expect(signatureDefinition(id)!.quality).toBe(expected);
      expect(signatureDefinition(JSON.parse(JSON.stringify(id)))!.quality).toBe(expected);
      expect(def.basePrice).toBeCloseTo(def.cost * 1.6 + 2);
      expect(def.prepTime).toBeCloseTo(3 + 0.65 * Object.values(recipe).reduce((sum, n) => sum + n, 0) + 0.5 * (Object.keys(recipe).length - 1));
      observed.add(def.quality);
    }
    expect(observed.size).toBe(6);
    for (const [base, recipe] of examples) {
      const quality = signatureDefinition(makeSignatureId(base, recipe)!)!.quality;
      expect(quality).toBeGreaterThanOrEqual(3.7);
      expect(quality).toBeLessThanOrEqual(4.3);
    }
  });

});
