import { expect, it } from 'vitest';
import { compareFlowRows, flowStats, mergeFlowShards, verifyFlowEvidence } from './play-flow-balance-verify';
import { FLOW_SEEDS, type FlowRow } from './play-flow-balance-lab';
it('uses registered sample-size uncertainty and rejects unregistered sample counts', () => {
  expect(flowStats([0, 2]).ci95High).toBeCloseTo(13.706204736); expect(() => flowStats([1, 2, 3])).toThrow();
});
it('records all three regression gates per cell and refuses nonidentical startup states', () => {
  const fixture = FLOW_SEEDS.map(seed => ({ seed, initialStateHash: 'same', operatingProfit: 100, lossRate: .1, rating: 4, phases: {}, liveFood: { acceptedCost: 0, kitchenCost: 0, shelfCost: 0, total: 0, activeOrders: 0 } } as FlowRow));
  // Fill every supporting field without a simulation; these samples only test the gate computation.
  for (const r of fixture) for (const key of ['served', 'revenue', 'ingredientExpense', 'careExpense', 'promotionExpense', 'unmetDemand', 'missed', 'doorLost', 'queueRemovedAtClosing', 'terminalLiveCustomers', 'arrivalAttempts', 'resolvedLossRate', 'pendingLostRate', 'peakQueue', 'meanQueue', 'servedWaitMean', 'servedWaitP95', 'servedWaitMax', 'openSeconds', 'closingSeconds', 'completedDays', 'wasteCost', 'cashProfit', 'netLiquidProfit', 'cashConstrainedRestocks', 'promotionBookingFailures']) (r as any)[key] = 0;
  const treated = fixture.map(r => ({ ...r, operatingProfit: 94, lossRate: .121, rating: 3.89 }));
  expect(compareFlowRows(fixture, treated).flags).toEqual(['profit', 'lossRate', 'rating']);
  treated[0].initialStateHash = 'different'; expect(() => compareFlowRows(fixture, treated)).toThrow();
});
it.skipIf(!process.env.PLAY_FLOW_MERGE)('merges complete source-matched shards', () => {
  expect(mergeFlowShards(process.env.PLAY_FLOW_MERGE!).cells).toBe(78);
});
it.skipIf(!process.env.PLAY_FLOW_VERIFY)('validates paired evidence and records every threshold crossing', () => {
  expect(verifyFlowEvidence(process.env.PLAY_FLOW_BASELINE!, process.env.PLAY_FLOW_VERIFY!).complete).toBe(true);
});

it('independently rejects tampered cash, assets, demand and exposure identities', async () => {
  const { flowScenarios, observedFlowSample, setupEvidence } = await import('./play-flow-balance-lab');
  const { validateFlowRow } = await import('./play-flow-balance-verify');
  const scenario = flowScenarios()[0], setup = setupEvidence(scenario), good = observedFlowSample(scenario, FLOW_SEEDS[0], 180);
  expect(() => validateFlowRow(good, setup)).not.toThrow();
  for (const mutate of [
    (r: FlowRow) => { r.assets.cash++; }, (r: FlowRow) => { r.lossRate += .01; },
    (r: FlowRow) => { r.spending.totalCashOut++; }, (r: FlowRow) => { r.queueRemovedAtClosing++; },
    (r: FlowRow) => { r.phases.calm.arrivalAttempts++; }, (r: FlowRow) => { r.phases.busy.openSeconds++; },
  ]) { const row = structuredClone(good); mutate(row); expect(() => validateFlowRow(row, setup)).toThrow(); }
});
it.skipIf(!process.env.PLAY_FLOW_DIAGNOSE)('writes paired short/long mechanism diagnostics without altering flagged outcomes', async () => {
  const { diagnoseFlowFlags } = await import('./play-flow-balance-diagnose');
  const report = diagnoseFlowFlags(process.env.PLAY_FLOW_BASELINE!, process.env.PLAY_FLOW_DIAGNOSE!);
  expect(report.independentOfAcceptance).toBe(true);
});
