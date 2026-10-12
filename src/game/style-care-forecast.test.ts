import { describe, expect, it } from 'vitest';
import { createInitialState, serialize } from './state';
import { adoptCat, forecastPetTraffic, petTraffic, updatePetCare } from './pets';
import { baseArrivalRate, expectedCustomers, restock, dayNeeds } from './economy';
import { openShop } from './day';

describe('affordable automatic care in the stocking forecast',()=>{
  it('anticipates an empty auto-refill pack without spending or activating care before opening',()=>{
    const s=createInitialState(0);s.coins=1000;adoptCat(s,'ginger');s.pets[0].careSeconds=0;
    const before=serialize(s);expect(petTraffic(s)).toBe(1);expect(forecastPetTraffic(s)).toBe(1.08);expect(expectedCustomers(s)).toBe(39);expect(serialize(s)).toBe(before);
    s.pantry.beans=0;restock(s);expect(s.pantry.beans).toBe(45);expect(s.pets[0].careSeconds).toBe(0);
    const cash=s.coins;openShop(s);updatePetCare(s,.05);expect(s.coins).toBe(cash-8);expect(petTraffic(s)).toBe(1.08);expect(s.today.petCost).toBeGreaterThan(0);
  });
  it('respects disabled refills, exhausted cash, and one shared cash reserve',()=>{
    const s=createInitialState(0);s.coins=5000;adoptCat(s,'ginger');adoptCat(s,'tuxedo');for(const p of s.pets)p.careSeconds=0;
    s.coins=7;expect(forecastPetTraffic(s)).toBe(1);s.coins=8;expect(forecastPetTraffic(s)).toBe(1.08);
    s.coins=19;expect(forecastPetTraffic(s)).toBe(1.08);s.coins=20;expect(forecastPetTraffic(s)).toBe(1.2);
    s.pets[0].autoRefill=false;expect(forecastPetTraffic(s)).toBe(1.12);s.pets[1].autoRefill=false;expect(forecastPetTraffic(s)).toBe(1);
  });
  it('leaves actual live arrivals untouched and preserves already cared cats',()=>{
    const s=createInitialState(0);s.coins=1000;adoptCat(s,'ginger');const live=baseArrivalRate(s);const needs=dayNeeds(s);s.pets[0].careSeconds=0;
    expect(baseArrivalRate(s)).toBeCloseTo(live/1.08);expect(dayNeeds(s)).toEqual(needs);
    s.pets[0].careSeconds=1;s.coins=0;expect(forecastPetTraffic(s)).toBe(1.08);
  });
});
