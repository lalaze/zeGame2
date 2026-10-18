import { describe, expect, it } from 'vitest';
import { finishDay, openShop } from '../game/day';
import { createInitialState, deserialize, serialize } from '../game/state';
import { businessLightDate } from './business-light';

describe('saved business daylight', () => {
  it('preserves the same daylight when a running or closing café is reloaded', () => {
    const state = createInitialState(0);
    openShop(state);
    state.dayTime = 150;
    for (const phase of ['open', 'closing'] as const) {
      state.phase = phase;
      const before = businessLightDate(state);
      const restored = deserialize(serialize(state), 99999999);
      expect(businessLightDate(restored)).toEqual(before);
    }
  });

  it('starts each new business day in the morning, including after a long night', () => {
    const state = createInitialState(0);
    const morning = businessLightDate(state);
    openShop(state);
    state.dayTime = 3600;
    expect(businessLightDate(state).getHours()).toBe(20);
    finishDay(state);
    expect(businessLightDate(state)).toEqual(morning);
    openShop(state);
    expect(businessLightDate(state)).toEqual(morning);
  });
});
