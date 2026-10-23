import { describe, expect, it } from 'vitest';
import { setCafeStyle } from '../src/game/styles';
import { styleSample } from './cafe-style-lab';
import { buildFlowSetup, customFlowSample, FLOW_SEEDS, flowScenarios, observedFlowSample, PILOT_SEEDS, pilotScenarios, runFlowLab } from './play-flow-balance-lab';

describe('play-flow paired economic contract', () => {
  it('freezes six focused route purchases at all three stages and both pressures plus sanity panels', () => {
    const scenarios = flowScenarios();
    expect(scenarios).toHaveLength(39); expect(scenarios.filter(s => s.kind === 'route')).toHaveLength(36);
    expect(new Set(FLOW_SEEDS).size).toBe(30); expect(FLOW_SEEDS.some(seed => PILOT_SEEDS.includes(seed))).toBe(false);
    expect(pilotScenarios()).toHaveLength(9);
  });
  it('copies the original fixed-clock contract exactly for route portfolios', () => {
    const scenario = flowScenarios()[0];
    expect(customFlowSample(scenario, FLOW_SEEDS[0], 180)).toEqual(styleSample(scenario.route, FLOW_SEEDS[0], setCafeStyle, 180));
    expect(customFlowSample(scenario, FLOW_SEEDS[0], 240)).toEqual(styleSample(scenario.route, FLOW_SEEDS[0], setCafeStyle, 240));
  });
  it('read-only observations do not alter the primary sample', () => {
    const scenario = flowScenarios()[0], raw = styleSample(scenario.route, FLOW_SEEDS[0], setCafeStyle, 180);
    const observed = observedFlowSample(scenario, FLOW_SEEDS[0], 180);
    for (const key of Object.keys(raw) as (keyof typeof raw)[]) expect(observed[key]).toEqual(raw[key]);
    expect(observed.seconds).toBe(180); expect(observed.openSeconds).toBe(180); expect(observed.closingSeconds).toBe(0);
    // The trading day ends at 180 s (dcacd65): the cafe has just begun closing, but nothing settles or drains.
    expect(observed.completedDays).toBe(0); expect(observed.terminalPhase).toBe('closing');
    expect(observedFlowSample(scenario, FLOW_SEEDS[0], 180)).toEqual(observed);
  });
  it('accounts for initial fresh beans and paid signature trials without creating cash', () => {
    for (const scenario of flowScenarios().filter(s => s.kind !== 'route')) {
      const setup = buildFlowSetup(scenario), row = observedFlowSample(scenario, FLOW_SEEDS[0], 180);
      expect(row.cashLedgerError).toBeCloseTo(0, 5); expect(row.reconciliationError).toBeCloseTo(0, 5);
      if (scenario.kind === 'fresh') { expect(setup.initialCash).toBe(0); expect(setup.initialPantryValue).toBeGreaterThan(0); }
      else { expect(setup.state.signatureDrinks.recipes.filter(r => r.onMenu)).toHaveLength(3); expect(setup.state.onMenu).toEqual([]); expect(setup.trialSetupExpense).toBeGreaterThan(0); }
    }
  });
});
it.skipIf(process.env.PLAY_FLOW_LAB !== '1')('writes stable-source paired traffic economic evidence', async () => {
  expect((await runFlowLab()).complete).toBe(true);
}, 86_400_000);
