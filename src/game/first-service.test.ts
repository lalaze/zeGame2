import { describe, expect, it } from 'vitest';
import { createInitialState, serialize } from './state';
import { firstServiceStep, isFirstCafe } from './first-service';

describe('first service guide (no game mutation)', () => {
  it('introduces only genuinely new cafés; never advanced legacy saves without profiles', () => {
    const s = createInitialState(1);
    expect(isFirstCafe(s)).toBe(true);
    s.kitchen = true;
    expect(isFirstCafe(s)).toBe(false);
    s.kitchen = false; s.items.americano = 1;
    expect(isFirstCafe(s)).toBe(false);
    s.items.americano = 0; s.day = 2;
    expect(isFirstCafe(s)).toBe(false);
  });
  it('guides stock, menu, observation, voluntary close, settlement and reopening', () => {
    const s = createInitialState(1);
    expect(firstServiceStep(s, false)).toBe('stock');
    expect(firstServiceStep(s, true)).toBe('prepare');
    s.phase = 'open';
    expect(firstServiceStep(s, true)).toBe('observe');
    s.dayTime = 45;
    expect(firstServiceStep(s, true)).toBe('close');
    s.phase = 'closing';
    expect(firstServiceStep(s, true)).toBe('closing');
    s.phase = 'prep'; s.day++;
    expect(firstServiceStep(s, true)).toBe('reopen');
    s.phase = 'open';
    expect(firstServiceStep(s, true)).toBe('complete');
  });
  it('suggests closing sooner on sold out stock or a useful sample without opening or closing for the user', () => {
    const s = createInitialState(1); s.phase = 'open'; s.pantry.beans = 0;
    const before = serialize(s);
    expect(firstServiceStep(s, true)).toBe('close');
    expect(serialize(s)).toBe(before);
    s.pantry.beans = 50; s.today.served = 5;
    expect(firstServiceStep(s, true)).toBe('close');
  });
});
