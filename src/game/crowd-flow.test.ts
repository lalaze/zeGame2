import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, INGREDIENTS, MAX_ARRIVAL_RATE, MAX_QUEUE, MENU } from './data';
import { openShop } from './day';
import { arrivalCap, arrivalRate, expectedCustomers, isTrafficCapped, serviceCapacity, trafficDemand } from './economy';
import { MIN_SCENE_H, queueSpot, setKitchenLevel, setSceneHeight } from './layout';
import { Sim } from './sim';
import { validSnapshot } from './sim-snapshot';
import { createInitialState, type GameState } from './state';

/**
 * Unmodified baseline metrics (HEAD before Scheme B arrival cap / MAX_QUEUE=4 / balking / longer dine-in dwell),
 * measured with the exact same `buildStage` four stages, 20 deterministic seeds (1..20), dt=0.05,
 * running a full day until closing and all guests leave:
 *
 * | stage | served |    revenue | arrived |
 * | early |   62.5 |      7,880 |   67.65 |
 * | mid   |  160.2 |    201,627 |  165.45 |
 * | late  |  184.4 |  3,786,742 |   190.4 |
 * | max   | 266.05 | 47,133,681 |  271.35 |
 */
const BASELINE = {
  early: { served: 62.5, revenue: 7_880, arrived: 67.65 },
  mid: { served: 160.2, revenue: 201_627, arrived: 165.45 },
  late: { served: 184.4, revenue: 3_786_742, arrived: 190.4 },
  max: { served: 266.05, revenue: 47_133_681, arrived: 271.35 },
} as const;

type Stage = keyof typeof BASELINE;

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const SIM_DT = 0.05;

const STAGES: Record<Stage, { mk: number; tb: number; bar: number; srv: number; mach: number; reg: number; day: number; items: number }> = {
  early: { mk: 2, tb: 0, bar: 0, srv: 0, mach: 1, reg: 0, day: 3, items: 3 },
  mid: { mk: 10, tb: 3, bar: 1, srv: 1, mach: 6, reg: 2, day: 12, items: 6 },
  late: { mk: 20, tb: 6, bar: 3, srv: 3, mach: 14, reg: 5, day: 30, items: 10 },
  max: { mk: 25, tb: 6, bar: 3, srv: 5, mach: 20, reg: 5, day: 40, items: 14 },
};

function makeRng(seed: number): () => number {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 2 ** 32;
  };
}

function buildStage(stage: Stage): GameState {
  setSceneHeight(MIN_SCENE_H);
  setKitchenLevel(0);
  const s = createInitialState(0);
  const L = STAGES[stage];
  s.day = L.day;
  s.upgrades.marketing = L.mk;
  s.upgrades.tables = L.tb;
  s.upgrades.barista = L.bar;
  s.upgrades.server = L.srv;
  s.upgrades.machine = L.mach;
  s.regions = (['reading', 'greenhouse', 'terrace', 'workshop', 'observatory'] as const).slice(0, L.reg);
  const drinks = MENU.filter((m) => !['bread', 'pastry'].includes(m.category)).slice(0, L.items);
  for (const m of drinks) s.items[m.id] = 10;
  s.onMenu = drinks.map((m) => m.id);
  for (const i of INGREDIENTS) s.pantry[i.id] = 1e6;
  s.reputation = { recent: Array.from({ length: 50 }, () => ({ stars: 5, reason: 'prompt', day: L.day })) };
  return s;
}

interface DayMetrics {
  stage: Stage;
  demand: number;
  arrivalRate: number;
  serviceCapacity: number;
  expectedCustomers: number;
  arrived: number;
  served: number;
  revenue: number;
  doorLost: number;
  avgQueueOpen: number;
  maxQueue: number;
  peakNotSeated: number;
  avgSeatedOpen: number;
}

interface StageSummary {
  stage: Stage;
  arrivalRate: number;
  expectedCustomers: number;
  avgArrived: number;
  avgServed: number;
  avgRevenue: number;
  avgQueueOpen: number;
  maxQueue: number;
  avgPeakNotSeated: number;
  avgSeatedOpen: number;
  totalDoorLost: number;
  totalArrived: number;
}

function runFullDay(stage: Stage, seed: number, dt = SIM_DT): DayMetrics {
  const s = buildStage(stage);
  const expected = expectedCustomers(s);
  const demand = trafficDemand(s);
  const rate = arrivalRate(s);
  const cap = serviceCapacity(s);
  const sim = new Sim(makeRng(seed));
  openShop(s);

  const seen = new Set<number>();
  let openSteps = 0;
  let fullSteps = 0;
  let sumQueueOpen = 0;
  let maxQueue = 0;
  let peakNotSeated = 0;
  let sumSeatedOpen = 0;

  while ((s.phase === 'open' || sim.customers.length > 0) && fullSteps < 40000) {
    const wasOpen = s.phase === 'open';
    sim.update(s, dt);
    fullSteps++;
    const customers = sim.customers;
    let seated = 0;
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      seen.add(c.id);
      if (c.phase === 'waiting' || c.phase === 'sitting') seated++;
    }
    const q = sim.queue.length;
    const notSeated = customers.length - seated;
    if (q > maxQueue) maxQueue = q;
    if (notSeated > peakNotSeated) peakNotSeated = notSeated;
    if (wasOpen && s.phase === 'open') {
      openSteps++;
      sumQueueOpen += q;
      sumSeatedOpen += seated;
    }
  }

  return {
    stage,
    demand,
    arrivalRate: rate,
    serviceCapacity: cap,
    expectedCustomers: expected,
    arrived: seen.size,
    served: s.today.served,
    revenue: s.today.revenue,
    doorLost: s.today.doorLost,
    avgQueueOpen: sumQueueOpen / Math.max(1, openSteps),
    maxQueue,
    peakNotSeated,
    avgSeatedOpen: sumSeatedOpen / Math.max(1, openSteps),
  };
}

const stageCache = new Map<Stage, StageSummary>();

function measureStage(stage: Stage): StageSummary {
  const cached = stageCache.get(stage);
  if (cached) return cached;
  const runs = SEEDS.map((seed) => runFullDay(stage, seed, SIM_DT));
  const n = runs.length;
  const totalArrived = runs.reduce((sum, r) => sum + r.arrived, 0);
  const totalDoorLost = runs.reduce((sum, r) => sum + r.doorLost, 0);
  const summary: StageSummary = {
    stage,
    arrivalRate: runs[0].arrivalRate,
    expectedCustomers: runs[0].expectedCustomers,
    avgArrived: totalArrived / n,
    avgServed: runs.reduce((sum, r) => sum + r.served, 0) / n,
    avgRevenue: runs.reduce((sum, r) => sum + r.revenue, 0) / n,
    avgQueueOpen: runs.reduce((sum, r) => sum + r.avgQueueOpen, 0) / n,
    maxQueue: Math.max(...runs.map((r) => r.maxQueue)),
    avgPeakNotSeated: runs.reduce((sum, r) => sum + r.peakNotSeated, 0) / n,
    avgSeatedOpen: runs.reduce((sum, r) => sum + r.avgSeatedOpen, 0) / n,
    totalDoorLost,
    totalArrived,
  };
  stageCache.set(stage, summary);
  return summary;
}

describe('crowd flow limits (Scheme B)', () => {
  it('keeps late and max stages uncrowded, keeps upstairs tables lively, and matches forecasts across 20 seeds (A1, A2, A4)', () => {
    const early = measureStage('early');
    const mid = measureStage('mid');
    const late = measureStage('late');
    const max = measureStage('max');

    // Every stage respects the queue cap (on every seed and tick) and arrival cap.
    for (const m of [early, mid, late, max]) {
      expect(m.maxQueue).toBeLessThanOrEqual(MAX_QUEUE);
      expect(m.arrivalRate).toBeLessThanOrEqual(MAX_ARRIVAL_RATE);
    }

    // A1: late & max avg queue <= 2.0, max queue <= 4 on any seed, mean peak non-seated <= 20,
    // total doorLost <= 10% of total arrived.
    for (const m of [late, max]) {
      expect(m.avgQueueOpen).toBeLessThanOrEqual(2.0);
      expect(m.maxQueue).toBeLessThanOrEqual(4);
      expect(m.avgPeakNotSeated).toBeLessThanOrEqual(20);
      expect(m.totalDoorLost).toBeLessThanOrEqual(m.totalArrived * 0.1);
      // A2: mean open-hours seated guests >= 10.
      expect(m.avgSeatedOpen).toBeGreaterThanOrEqual(10);
      // A4: expectedCustomers within +-20% of 20-seed mean arrivals.
      expect(Math.abs(m.expectedCustomers - m.avgArrived) / m.avgArrived).toBeLessThanOrEqual(0.2);
    }
  }, 60_000);

  it('keeps 20-seed mean revenue within accepted bounds across early, mid, late and max stages (A3)', () => {
    const early = measureStage('early');
    const mid = measureStage('mid');
    const late = measureStage('late');
    const max = measureStage('max');

    // Early revenue stays within +-5% of the 20-seed unmodified baseline.
    expect(Math.abs(early.avgRevenue - BASELINE.early.revenue) / BASELINE.early.revenue).toBeLessThanOrEqual(0.05);
    // Mid revenue drop <= 15%.
    expect(mid.avgRevenue).toBeGreaterThanOrEqual(BASELINE.mid.revenue * 0.85);
    // Late revenue drop <= 50%.
    expect(late.avgRevenue).toBeGreaterThanOrEqual(BASELINE.late.revenue * 0.5);
    // Max revenue drop <= 50%.
    expect(max.avgRevenue).toBeGreaterThanOrEqual(BASELINE.max.revenue * 0.5);
  }, 60_000);

  it('distinguishes uncapped trafficDemand from capped arrivalRate and flags when capped', () => {
    const starter = createInitialState(0);
    expect(isTrafficCapped(starter)).toBe(false);
    expect(arrivalRate(starter)).toBeCloseTo(trafficDemand(starter));

    const max = buildStage('max');
    expect(trafficDemand(max)).toBeGreaterThan(arrivalCap(max));
    expect(isTrafficCapped(max)).toBe(true);
    expect(arrivalRate(max)).toBeCloseTo(arrivalCap(max));
    expect(arrivalRate(max)).toBeCloseTo(MAX_ARRIVAL_RATE);
    expect(expectedCustomers(max)).toBe(Math.ceil(MAX_ARRIVAL_RATE * DAY_SECONDS));

    // Empty menu is never flagged as traffic capped.
    max.onMenu = [];
    expect(isTrafficCapped(max)).toBe(false);
  });

  it('loads legacy snapshots with a 6-person queue without errors and drains them naturally (A7)', () => {
    setSceneHeight(MIN_SCENE_H);
    setKitchenLevel(0);
    const state = createInitialState(0);
    state.pantry.beans = 1000;
    openShop(state);

    const sim = new Sim(makeRng(11));
    sim.update(state, 0.05);
    const snap = sim.snapshot(state);
    // Construct a legacy 6-person queue snapshot (from before MAX_QUEUE changed from 6 to 4).
    snap.customers = Array.from({ length: 6 }, (_, i) => {
      const spot = queueSpot(i);
      return {
        id: i + 1,
        x: spot.x,
        y: spot.y,
        tx: spot.x,
        ty: spot.y,
        via: [],
        journey: [],
        pathBlocked: false,
        stride: 0,
        look: { skin: 0, hair: 0, hairStyle: 0, shirt: 0, pants: 0 },
        order: 'espresso' as const,
        extra: null,
        phase: 'queue' as const,
        patience: 40,
        timer: 0,
        spot: -1,
        seat: -1,
        vip: false,
        mood: null,
        moodTimer: 0,
        hasCup: false,
        soldOut: false,
        dineIn: false,
        reviewed: false,
        waitSeconds: 0,
        missingExtra: false,
      };
    });
    snap.queue = [1, 2, 3, 4, 5, 6];
    snap.nextId = 7;

    expect(validSnapshot(snap, state)).toBe(true);
    const restored = new Sim(makeRng(11));
    expect(restored.restore(snap, state)).toBe(true);
    // All 6 queued guests remain in the queue on restore (none evicted).
    expect(restored.queue).toEqual([1, 2, 3, 4, 5, 6]);
    expect(restored.customers).toHaveLength(6);

    // Stepping drains the legacy queue naturally and serves the guests.
    for (let i = 0; i < 600 && restored.queue.length > 0; i++) restored.update(state, 0.05);
    expect(restored.queue.length).toBe(0);
    expect(state.today.served).toBeGreaterThanOrEqual(4);
  });
});
