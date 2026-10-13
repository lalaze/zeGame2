import { afterEach, describe, expect, it, vi } from 'vitest';
import { openShop } from './day';
import { arrivalRate, dayDemand, patienceSeconds, salePrice } from './economy';
import { MIN_SCENE_H, setKitchenLevel, setSceneHeight } from './layout';
import { Sim } from './sim';
import { createInitialState, deserialize, serialize, type Phase } from './state';
import {
  TRAFFIC_CYCLE_SECONDS,
  TRAFFIC_MAX_MULTIPLIER,
  TRAFFIC_MIN_MULTIPLIER,
  integratedTrafficSeconds,
  trafficAt,
} from './traffic';

afterEach(() => { setSceneHeight(MIN_SCENE_H); setKitchenLevel(0); });

describe('bounded, predictable traffic envelope', () => {
  it.each([
    [0, 'calm', 0.9, 'rising', 30],
    [30, 'rising', 0.9, 'busy', 15],
    [37.5, 'rising', 1, 'busy', 7.5],
    [45, 'busy', 1.1, 'easing', 30],
    [75, 'easing', 1.1, 'calm', 15],
    [82.5, 'easing', 1, 'calm', 7.5],
    [90, 'calm', 0.9, 'rising', 30],
    [210, 'rising', 0.9, 'busy', 15],
  ])('describes the active phase at %s seconds', (time, phase, multiplier, nextPhase, secondsToNextPhase) => {
    expect(trafficAt(time as number)).toEqual({ phase, multiplier, nextPhase, secondsToNextPhase });
  });

  it('is continuous at every phase and cycle boundary', () => {
    for (const boundary of [30, 45, 75, 90, 120, 135, 165, 180]) {
      expect(trafficAt(boundary - 1e-7).multiplier).toBeCloseTo(trafficAt(boundary).multiplier, 7);
      expect(trafficAt(boundary + 1e-7).multiplier).toBeCloseTo(trafficAt(boundary).multiplier, 7);
    }
  });

  it('never leaves its declared bounds, including integrated frame averages', () => {
    for (let t = 0; t < 3 * TRAFFIC_CYCLE_SECONDS; t += 0.37) {
      const status = trafficAt(t);
      expect(status.multiplier).toBeGreaterThanOrEqual(TRAFFIC_MIN_MULTIPLIER);
      expect(status.multiplier).toBeLessThanOrEqual(TRAFFIC_MAX_MULTIPLIER);
      expect(status.secondsToNextPhase).toBeGreaterThan(0);
      expect(status.secondsToNextPhase).toBeLessThanOrEqual(30);
      for (const dt of [0.001, 0.05, 0.5, 17, 180]) {
        const average = integratedTrafficSeconds(t, dt) / dt;
        expect(average).toBeGreaterThanOrEqual(TRAFFIC_MIN_MULTIPLIER - 1e-9);
        expect(average).toBeLessThanOrEqual(TRAFFIC_MAX_MULTIPLIER + 1e-9);
      }
    }
  });

  it('integrates each plateau and ramp exactly and has unit mean over whole cycles', () => {
    expect(integratedTrafficSeconds(0, 30)).toBe(27);
    expect(integratedTrafficSeconds(30, 15)).toBe(15);
    expect(integratedTrafficSeconds(45, 30)).toBe(33);
    expect(integratedTrafficSeconds(75, 15)).toBe(15);
    for (const start of [0, 13.17, 30, 37.5, 45, 75, 89.99, 1e12]) {
      for (const cycles of [1, 2, 4, 10000]) {
        const duration = cycles * TRAFFIC_CYCLE_SECONDS;
        expect(integratedTrafficSeconds(start, duration)).toBe(duration);
      }
    }
  });

  it('is additive across phase boundaries for small, large and mixed steps', () => {
    for (const start of [0, 29.97, 44.98, 74.99, 89.97, 170.11]) {
      const duration = 211.37;
      const expected = integratedTrafficSeconds(start, duration);
      for (const step of [0.05, 0.5, 7.3, 91]) {
        let elapsed = 0, integrated = 0;
        while (elapsed < duration) {
          const dt = Math.min(step, duration - elapsed);
          integrated += integratedTrafficSeconds(start + elapsed, dt);
          elapsed += dt;
        }
        expect(integrated).toBeCloseTo(expected, 8);
      }
    }
  });

  it('uses local cycle time so a long-running save does not lose short-frame precision', () => {
    const time = 1e12;
    expect(trafficAt(time)).toEqual(trafficAt(time % TRAFFIC_CYCLE_SECONDS));
    expect(integratedTrafficSeconds(time, 0.05)).toBe(integratedTrafficSeconds(time % TRAFFIC_CYCLE_SECONDS, 0.05));
  });

  it('treats invalid clocks as the start and nonpositive or invalid durations as no advance', () => {
    for (const time of [-1, Number.NaN, Infinity, -Infinity]) expect(trafficAt(time)).toEqual(trafficAt(0));
    for (const dt of [0, -1, Number.NaN, Infinity, -Infinity]) expect(integratedTrafficSeconds(35, dt)).toBe(0);
  });
});

function restoredClock(dayTime: number, spawnTimer: number, phase: Phase = 'open', version = 2) {
  const state = createInitialState(0);
  openShop(state);
  state.phase = phase;
  state.dayTime = dayTime;
  const snapshot = new Sim(() => 0.5).snapshot(state);
  snapshot.spawnTimer = spawnTimer;
  snapshot.version = version;
  const rng = vi.fn(() => 0.5);
  const sim = new Sim(rng);
  expect(sim.restore(snapshot, state)).toBe(true);
  return { state, sim, rng };
}

describe('traffic waves in the existing service clock', () => {
  it.each([0, 29.8, 37.5, 44.8, 65, 74.8, 82.5, 89.8])('integrates from the start of the frame at %s seconds', (start) => {
    const { state, sim, rng } = restoredClock(start, 100);
    sim.update(state, 0.5);
    expect(state.dayTime).toBe(start + 0.5);
    expect(sim.snapshot(state).spawnTimer).toBeCloseTo(100 - integratedTrafficSeconds(start, 0.5), 10);
    expect(rng).not.toHaveBeenCalled();
    expect(sim.customers).toHaveLength(0);
  });

  it('consumes the same unexpired arrival budget with slow and fast simulation steps', () => {
    const start = 29.75;
    const duration = 180;
    const expected = 1000 - duration;
    for (const step of [0.05, 0.5, 5, 180]) {
      const { state, sim, rng } = restoredClock(start, 1000);
      for (let i = 0; i < duration / step; i++) sim.update(state, step);
      expect(state.dayTime).toBeCloseTo(start + duration, 8);
      expect(sim.snapshot(state).spawnTimer).toBeCloseTo(expected, 8);
      expect(rng).not.toHaveBeenCalled();
      expect(state.phase).toBe('open');
    }
  });

  it.each([1, 2])('accepts a legacy v%s timer unchanged and applies the current saved phase', (version) => {
    const { state, sim, rng } = restoredClock(45, 2, 'open', version);
    expect(sim.snapshot(state).spawnTimer).toBe(2);
    sim.update(state, 0.5);
    expect(sim.snapshot(state).spawnTimer).toBeCloseTo(1.45, 12);
    expect(rng).not.toHaveBeenCalled();
  });

  it('retains the existing jitter renewal and RNG draws when one guest arrives', () => {
    const { state, sim, rng } = restoredClock(45, 0.1);
    const rate = arrivalRate(state);
    sim.update(state, 0.1);
    expect(sim.snapshot(state).spawnTimer).toBeCloseTo(1 / rate, 12);
    expect(sim.customers).toHaveLength(1);
    // One interval, one menu choice, five appearance draws and one VIP roll.
    expect(rng).toHaveBeenCalledTimes(8);
    expect(state.today.doorLost).toBe(0);
  });

  it.each(['prep', 'closing'] as const)('retains the %s timer without admitting guests', (phase) => {
    const { state, sim, rng } = restoredClock(phase === 'prep' ? 0 : 45, 2, phase);
    const start = state.dayTime;
    sim.update(state, 0.5);
    expect(sim.snapshot(state).spawnTimer).toBe(1.5);
    expect(state.dayTime).toBe(start + (phase === 'closing' ? 0.5 : 0));
    expect(rng).not.toHaveBeenCalled();
    sim.update(state, 2);
    expect(rng).toHaveBeenCalledTimes(1);
    expect(sim.customers).toHaveLength(0);
    expect(state.today.doorLost).toBe(0);
    expect(state.phase).toBe(phase);
  });

  it.each([0, -0.25])('does not admit a pending arrival or consume RNG on a zero-time frame (timer %s)', (timer) => {
    const { state, sim, rng } = restoredClock(45, timer);
    sim.update(state, 0);
    expect(sim.snapshot(state).spawnTimer).toBe(timer);
    expect(state.dayTime).toBe(45);
    expect(sim.customers).toHaveLength(0);
    expect(rng).not.toHaveBeenCalled();
    sim.update(state, 0.01);
    expect(sim.customers).toHaveLength(1);
  });

  it.each([15, 37.5, 60, 82.5])('restores the phase and timer at %s seconds without offline progress', (time) => {
    const { state, sim } = restoredClock(time, 3);
    const saved = sim.snapshot(state);
    const loaded = deserialize(serialize(state), 24 * 60 * 60 * 1000);
    const resumed = new Sim(() => 0.5);
    expect(resumed.restore(saved, loaded)).toBe(true);
    expect(loaded.dayTime).toBe(time);
    expect(trafficAt(loaded.dayTime)).toEqual(trafficAt(time));
    expect(resumed.snapshot(loaded).spawnTimer).toBe(3);
    sim.update(state, 0.1);
    resumed.update(loaded, 0.1);
    expect(loaded.dayTime).toBe(state.dayTime);
    expect(resumed.snapshot(loaded).spawnTimer).toBe(sim.snapshot(state).spawnTimer);
  });

  it('starts the next manually opened day calmly without altering mean forecasts, prices or patience', () => {
    const { state, sim } = restoredClock(60, 3);
    const meanRate = arrivalRate(state);
    const demand = dayDemand(state);
    const price = salePrice(state, 'espresso');
    const patience = patienceSeconds(state);
    for (const time of [0, 37.5, 60, 82.5, 180]) {
      state.dayTime = time;
      expect(arrivalRate(state)).toBe(meanRate);
      expect(dayDemand(state)).toEqual(demand);
      expect(salePrice(state, 'espresso')).toBe(price);
      expect(patienceSeconds(state)).toBe(patience);
    }
    sim.beginClosing(state);
    expect(state.phase).toBe('closing');
    sim.closeShop(state);
    expect(state.phase).toBe('prep');
    openShop(state);
    expect(state.dayTime).toBe(0);
    expect(trafficAt(state.dayTime).phase).toBe('calm');
  });
});
