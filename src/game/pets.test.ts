import { describe, expect, it } from 'vitest';
import { createInitialState, deserialize, serialize } from './state';
import { CATS, CARE_SECONDS, MAX_CARE_SECONDS, MAX_PETS, adoptCat, parsePets, petPreferences, petTraffic, refillPet, updatePetCare } from './pets';
import { arrivalRate, tipMultiplier } from './economy';
import { finishDay, openShop } from './day';
import { Sim } from './sim';

function setup() {
  const s = createInitialState(0);
  s.coins = 10000;
  adoptCat(s, 'ginger');
  return s;
}

describe('café cats', () => {
  it('offers every catalog choice with its own price and saves the chosen kind', () => {
    expect(CATS).toHaveLength(12);
    expect(new Set(CATS.map((cat) => cat.id)).size).toBe(CATS.length);
    for (const cat of CATS) {
      const s = createInitialState(0); s.coins = cat.adoption;
      expect(adoptCat(s, cat.id)).toBe(true);
      expect(s.coins).toBe(0);
      expect(petTraffic(s)).toBeCloseTo(1 + cat.traffic);
      const restored = deserialize(serialize(s), 1000);
      expect(restored.pets[0].id).toBe(cat.id);
      restored.phase = 'open'; updatePetCare(restored, CARE_SECONDS);
      expect(restored.today.petCost).toBeCloseTo(cat.careCost);
    }
  });

  it('limits any selection to three residents without charging for a fourth', () => {
    const s = createInitialState(0); s.coins = 10000;
    for (const id of ['siamese', 'tabby', 'ragdoll']) expect(adoptCat(s, id)).toBe(true);
    expect(s.pets).toHaveLength(MAX_PETS);
    const coins = s.coins;
    expect(adoptCat(s, 'black')).toBe(false);
    expect(s.coins).toBe(coins);
    const oversized = { ...s, pets: CATS.map((cat) => ({ id: cat.id, careSeconds: 180, autoRefill: false })) };
    expect(deserialize(serialize(oversized), 0).pets.map((pet) => pet.id)).toEqual(['ginger', 'tuxedo', 'calico']);
  });

  it('adopts each cat once, only when closed and affordable, with its first care pack', () => {
    const s = createInitialState(0);
    expect(adoptCat(s, 'ginger')).toBe(false);
    s.coins = 300;
    expect(adoptCat(s, 'unknown')).toBe(false);
    expect(adoptCat(s, 'ginger')).toBe(true);
    expect(s.coins).toBe(0);
    expect(s.pets).toEqual([{ id: 'ginger', careSeconds: CARE_SECONDS, autoRefill: true, ...petPreferences({ id: 'ginger' }) }]);
    s.coins = 10000;
    expect(adoptCat(s, 'ginger')).toBe(false);
    for (const phase of ['open', 'closing'] as const) {
      s.phase = phase;
      expect(adoptCat(s, 'tuxedo')).toBe(false);
    }
    s.phase = 'prep';
    expect(adoptCat(s, 'tuxedo')).toBe(true);
    expect(adoptCat(s, 'calico')).toBe(true);
    expect(s.pets).toHaveLength(3);
  });

  it('combines only cared-for cats and affects arrivals without changing tips', () => {
    const s = createInitialState(0);
    s.coins = 10000;
    s.reputation.recent = Array.from({ length: 20 }, () => ({ stars: 5, reason: 'prompt', day: 1 }));
    const arrivals = arrivalRate(s), tips = tipMultiplier(s);
    CATS.slice(0, 3).forEach((cat) => adoptCat(s, cat.id));
    expect(petTraffic(s)).toBeCloseTo(1.36);
    expect(arrivalRate(s)).toBeCloseTo(arrivals * 1.36);
    expect(tipMultiplier(s)).toBe(tips);
    s.pets[1].careSeconds = 0;
    expect(petTraffic(s)).toBeCloseTo(1.24);
  });

  it('consumes care only during open game time and expenses only the portion used', () => {
    const s = setup();
    updatePetCare(s, 90);
    s.phase = 'closing'; updatePetCare(s, 90);
    expect(s.pets[0].careSeconds).toBe(180);
    s.phase = 'open'; updatePetCare(s, 90);
    expect(s.pets[0].careSeconds).toBe(90);
    expect(s.today.petCost).toBe(4);
    expect(s.coins).toBe(9700);
    updatePetCare(s, NaN); updatePetCare(s, Infinity); updatePetCare(s, -1);
    expect(s.today.petCost).toBe(4);
  });

  it('refills when more care is needed, including updates spanning multiple packs', () => {
    const s = setup(); s.phase = 'open';
    updatePetCare(s, 180);
    expect(s.coins).toBe(9700);
    updatePetCare(s, 361);
    expect(s.coins).toBe(9700 - 24);
    expect(s.pets[0].careSeconds).toBe(179);
    expect(s.today.petCost).toBeCloseTo(541 / 180 * 8);
  });

  it('rests without money, never incurs debt, and resumes when funds become available', () => {
    const s = setup(); s.phase = 'open'; s.coins = 7;
    updatePetCare(s, 500);
    expect(s.coins).toBe(7);
    expect(s.today.petCost).toBe(8);
    expect(petTraffic(s)).toBe(1);
    s.coins = 8; updatePetCare(s, 1);
    expect(s.coins).toBe(0);
    expect(petTraffic(s)).toBeCloseTo(1.08);
    expect(s.pets[0].careSeconds).toBe(179);
  });

  it('honors disabled auto-refill and permits manual replenishment with a storage cap', () => {
    const s = setup(); s.phase = 'open'; s.pets[0].autoRefill = false;
    updatePetCare(s, 500);
    expect(s.coins).toBe(9700);
    expect(petTraffic(s)).toBe(1);
    expect(refillPet(s, 'ginger')).toBe(true);
    expect(refillPet(s, 'calico')).toBe(false);
    expect(s.today.petCost).toBe(8);
    for (let i = 1; i < 10; i++) expect(refillPet(s, 'ginger')).toBe(true);
    expect(s.pets[0].careSeconds).toBe(MAX_CARE_SECONDS);
    expect(refillPet(s, 'ginger')).toBe(false);
    expect(s.coins).toBe(9700 - 80);
  });

  it('carries unused supplies across days and deducts care in profit without charging twice', () => {
    const s = setup(); openShop(s);
    s.today.revenue = 100; s.today.ingredientCost = 20;
    updatePetCare(s, 90);
    const report = finishDay(s)!;
    expect(report.petCost).toBe(4);
    expect(report.profit).toBe(76);
    expect(s.coins).toBe(9700);
    expect(s.pets[0].careSeconds).toBe(90);
    expect(s.today.petCost).toBe(0);
    openShop(s); updatePetCare(s, 30);
    expect(s.today.petCost).toBeCloseTo(4 / 3);
  });

  it('integrates care into the simulation', () => {
    const s = setup(); openShop(s);
    const sim = new Sim(() => 0.5);
    sim.update(s, 2);
    expect(s.pets[0].careSeconds).toBe(178);
    expect(s.today.petCost).toBeCloseTo(8 / 90);
  });

  it('persists remaining supplies, auto-refill and expenses without offline deductions', () => {
    const s = setup(); s.phase = 'open'; s.pets[0].autoRefill = false;
    updatePetCare(s, 50);
    const restored = deserialize(serialize(s), 86400000)!;
    expect(restored.pets).toEqual(s.pets);
    expect(restored.today.petCost).toBe(s.today.petCost);
    expect(restored.coins).toBe(s.coins);
    const legacy = JSON.parse(serialize(s)); delete legacy.pets; delete legacy.today.petCost; legacy.version = 10;
    const migrated = deserialize(JSON.stringify(legacy), 86400000)!;
    expect(migrated.pets).toEqual([]);
    expect(migrated.today.petCost).toBe(0);
  });

  it('validates save entries, duplicate cats, supplies and automatic spending opt-in', () => {
    expect(parsePets({})).toEqual([]);
    expect(parsePets([null, { id: 'dog' }, { id: 'ginger', careSeconds: 99999, autoRefill: 'yes' }, { id: 'ginger' }, { id: 'tuxedo', careSeconds: -1 }, { id: 'calico', careSeconds: Infinity, autoRefill: true }])).toEqual([
      { id: 'ginger', careSeconds: MAX_CARE_SECONDS, autoRefill: false, ...petPreferences({ id: 'ginger' }) },
      { id: 'tuxedo', careSeconds: 0, autoRefill: false, ...petPreferences({ id: 'tuxedo' }) },
      { id: 'calico', careSeconds: 0, autoRefill: true, ...petPreferences({ id: 'calico' }) },
    ]);
  });
});
