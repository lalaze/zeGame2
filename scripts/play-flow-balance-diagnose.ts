/** Descriptive mechanism reader. It never reruns or changes any sample. */
import { readFileSync, writeFileSync } from 'node:fs';
import { flowStats } from './play-flow-balance-verify';
import type { FlowRow } from './play-flow-balance-lab';
import { VIP_MULTIPLIER } from '../src/game/data';
import { salePrice } from '../src/game/economy';
export function diagnoseFlowFlags(baselineLabel: string, treatmentLabel: string, dir = 'docs/play-flow/evidence') {
  const baseline = JSON.parse(readFileSync(`${dir}/${baselineLabel}.json`, 'utf8'));
  const treatment = JSON.parse(readFileSync(`${dir}/${treatmentLabel}.json`, 'utf8'));
  const comparison = JSON.parse(readFileSync(`${dir}/${treatmentLabel}-comparison.json`, 'utf8'));
  const selectors: Record<string, (r: FlowRow) => number> = {
    served: r => r.served, unmetDemand: r => r.unmetDemand, arrivalAttempts: r => r.arrivalAttempts,
    pending: r => r.terminalLiveCustomers, acceptedFoodCost: r => r.liveFood.acceptedCost,
    kitchenFoodCost: r => r.liveFood.kitchenCost, shelfFoodCost: r => r.liveFood.shelfCost,
    soldOut: r => r.soldOut, queueLost: r => r.queueLost, tableLost: r => r.tableLost,
    doorLost: r => r.doorLost, closingRemovals: r => r.queueRemovedAtClosing,
    peakQueue: r => r.peakQueue, servedWait: r => r.servedWaitMean, cash: r => r.assets.cash, pantryCost: r => r.assets.pantry,
  };
  const flaggedScenarios = [...new Set(comparison.flags.map((r: any) => r.id.split('@')[0]))] as string[];
  const cases = flaggedScenarios.map(scenario => ({ scenario, horizons: [180, 1800].map(seconds => {
    const id = `${scenario}@${seconds}`, b: FlowRow[] = baseline.batches[id], t: FlowRow[] = treatment.batches[id];
    if (b.length !== 30 || t.length !== 30 || b.some((r, i) => r.seed !== t[i].seed)) throw new Error('Incomplete/unpaired diagnosis');
    const extra = Object.fromEntries(Object.entries(selectors).map(([name, get]) => {
      const bs = b.map(get), ts = t.map(get);
      return [name, { baseline: flowStats(bs), treatment: flowStats(ts), delta: flowStats(ts.map((x, i) => x - bs[i])) }];
    }));
    let reconstructedVip: unknown = null;
    if (['route-purchases/early/rush/bakery/focus', 'route-purchases/early/rush/community/focus'].includes(scenario)) {
      const setup = treatment.metadata.setups.find((r: any) => r.scenario === scenario);
      const unitPrice = salePrice(setup.initialState, setup.initialState.onMenu[0]);
      const countVip = (row: FlowRow) => {
        const n = (row.revenue / unitPrice - row.served) / (VIP_MULTIPLIER - 1);
        if (Math.abs(n - Math.round(n)) > 1e-6) throw new Error('VIP reconstruction is not exact for this fixed-price one-item menu');
        return Math.round(n);
      };
      const bv = b.map(countVip), tv = t.map(countVip);
      reconstructedVip = { unitPrice, vipMultiplier: VIP_MULTIPLIER,
        baseline: flowStats(bv), treatment: flowStats(tv), delta: flowStats(tv.map((n, i) => n - bv[i])),
        meaning: 'Exact revenue identity for these fixed-price single-item menus, not event-aligned VIP cohorts.' };
    }
    return { ...comparison.results.find((r: any) => r.id === id), diagnostics: extra, reconstructedVip };
  }) }));
  const report = { baselineLabel, treatmentLabel, independentOfAcceptance: true,
    caveats: ['Accepted food is consumed ingredient cost, not recoverable cash or predicted future profit.', 'Waits condition on served guests; terminal reputation is the latest 50 reviews and need not equal lifetime average.', 'Phase attribution is descriptive; correlated changes do not isolate a causal mechanism.', 'No terminal drain, future-sale credit, extra inventory or modified prices is introduced.'], cases };
  writeFileSync(`${dir}/${treatmentLabel}-flag-diagnostics.json`, JSON.stringify(report, null, 2) + '\n');
  return report;
}
