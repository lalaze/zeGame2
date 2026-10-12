import { describe, expect, it } from 'vitest';
import { CARE_SECONDS, adoptCat, updatePetCare } from '../src/game/pets';
import { setSceneHeight, setKitchenLevel } from '../src/game/layout';
import { menuItems } from '../src/game/economy';
import { DAYS, MENUS, SEEDS, fixture, liquidAssets, pairPayback, runLab, sample, scenarios } from './economy-lab';

describe('economy lab design and accounting', () => {
  it('has at least 30 unique reproducible seeds and kitchen-safe stage menus', () => {
    expect(new Set(SEEDS).size).toBeGreaterThanOrEqual(30);
    expect(DAYS).toBeGreaterThanOrEqual(6);
    for (const scenario of scenarios()) { const s = fixture(scenario.stage); s.onMenu = scenario.menu; expect(menuItems(s).length).toBe(scenario.menu.length); }
    expect(MENUS.mid.all).toHaveLength(7);
    expect(scenarios().filter((s) => s.stage === 'early' && s.promotion)).toHaveLength(8);
  });
  it('resets global layout before expanded forecasts regardless of previous sample', () => {
    const scenario = scenarios().find((s) => s.id === 'expanded/all/none')!;
    setSceneHeight(240); setKitchenLevel(0);
    const first = sample(scenario, SEEDS[0], 1);
    setSceneHeight(360); setKitchenLevel(2);
    expect(sample(scenario, SEEDS[0], 1)).toEqual(first);
  });
  it('splits included cat care from capital exactly once', () => {
    const s = fixture('early'); const start = liquidAssets(s).total;
    expect(adoptCat(s, 'ginger')).toBe(true);
    expect(start - liquidAssets(s).total).toBeCloseTo(292);
    s.phase = 'open'; updatePetCare(s, CARE_SECONDS);
    expect(s.today.petCost).toBeCloseTo(8);
    expect(start - liquidAssets(s).total).toBeCloseTo(300);
  });
  it('is deterministic, reconciles cash/inventory and censors unrecovered capital', () => {
    const none = scenarios().find((s) => s.id === 'early/initial/none')!;
    const cat = scenarios().find((s) => s.id === 'early/initial/cat')!;
    const control = sample(none, SEEDS[0], 1);
    expect(sample(none, SEEDS[0], 1)).toEqual(control);
    const treated = sample(cat, SEEDS[0], 1);
    expect(treated.daily[0].reconciliationError).toBeCloseTo(0, 6);
    expect(pairPayback(treated, control)).toMatchObject({ capital: 292, paybackDay: null, censored: true });
  });
});
// Opt-in so ordinary npm test remains fast. Each completed 30-seed batch is atomic
// and resumable. Full command: ECONOMY_LAB=1 ECONOMY_LABEL=baseline npx vitest run
// scripts/economy-lab.test.ts --silent=false --disableConsoleIntercept
it.skipIf(process.env.ECONOMY_LAB !== '1')('writes complete reproducible economy experiment batches', () => {
  const result = runLab();
  if (!process.env.ECONOMY_FILTER) expect(result.completed).toBe(result.expected);
}, 7_200_000);
