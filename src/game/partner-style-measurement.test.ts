/** Measurement fixture; copy beside sim.ts. Drafting does not execute this file.
 * Identical endowed shop in every case. Measures operating effects, not an
 * optimal route build, fresh-save affordability, or proof of economic balance.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MENU } from './data';
import { openShop } from './day';
import { comfort, useDecor } from './decor';
import { adoptCat } from './pets';
import { isBakery } from './economy';
import { PARTNER_TRAIN_COST, syncPartners, trainPartner, type PartnerRole } from './partners';
import { Sim } from './sim';
import { createInitialState, type GameState } from './state';
import { STYLE_IDS, setCafeStyle, activeStyleCats, gardenReady, styleSaleMultiplier,
  styleStationMultiplier, styleSeatChance, styleServerMultiplier, type CafeStyleId } from './styles';

const SEED = 731;
const SECONDS = 300;
const DT = 0.1;
const seeded = () => {
  let seed = SEED;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
};
type Training = 'none' | 'all-a' | 'all-b' | 'barista-a' | 'barista-b' | 'server-a' | 'server-b' | 'cook-a' | 'cook-b';
const TRAININGS: Training[] = ['none', 'all-a', 'all-b', 'barista-a', 'barista-b', 'server-a', 'server-b', 'cook-a', 'cook-b'];
const ROLE_IDS: Record<PartnerRole, string> = { barista: 'lin', server: 'yue', cook: 'mei' };
function qualifyAllRoutes(s: GameState) {
  // Use real purchase APIs from the copied source, with identical endowed funds.
  expect(useDecor(s, 'sill_cactus')).toBe(true);
  expect(useDecor(s, 'ceiling_lights')).toBe(true);
  for (const id of ['ginger', 'tuxedo', 'calico']) expect(adoptCat(s, id)).toBe(true);
  expect(comfort(s)).toBeGreaterThanOrEqual(7);
  expect(activeStyleCats(s)).toBe(3);
  expect(gardenReady(s)).toBe(true);
}
function measure(style: CafeStyleId, training: Training) {
  const s = createInitialState(1);
  s.coins = 100_000;
  s.kitchen = true;
  s.upgrades.barista = 1;
  const pastry = MENU.find(m => m.category === 'pastry') ?? MENU.find(m => isBakery(m.id));
  if (!pastry) throw new Error('Missing bakery fixture item');
  s.onMenu = ['espresso', 'blacktea', pastry.id];
  for (const id of s.onMenu) s.items[id] = 1;
  s.bakePlan[pastry.id] = 12;
  for (const id of Object.keys(s.pantry) as (keyof GameState['pantry'])[]) s.pantry[id] = 10_000;
  qualifyAllRoutes(s);
  syncPartners(s);
  expect(setCafeStyle(s, style)).toBe(true);
  expect(activeStyleCats(s)).toBeGreaterThan(0);
  expect(gardenReady(s)).toBe(true);
  // Confirm the selected route's conditional operating effect is actually active.
  if (style === 'coffee') expect(styleSaleMultiplier(s, 'espresso')).toBeGreaterThan(1);
  if (style === 'bakery') expect(styleStationMultiplier(s)).toBeLessThan(1);
  if (style === 'cats') expect(styleSaleMultiplier(s, 'espresso', true)).toBeGreaterThan(1);
  if (style === 'takeaway') expect(styleSeatChance(s, ['espresso'])).toBe(0);
  if (style === 'garden') expect(styleSaleMultiplier(s, 'blacktea', true, ['blacktea', pastry.id])).toBeGreaterThan(1);
  if (style === 'community') expect(styleServerMultiplier(s)).toBeGreaterThan(1);
  // Equal fixture progress is endowed, NOT represented as naturally earned XP.
  for (const p of Object.values(s.partners.roster)) p.xp = 20;
  const capitalBefore = s.coins;
  if (training !== 'none') {
    const [target, choice] = training.split('-') as [PartnerRole | 'all', 'a' | 'b'];
    for (const role of Object.keys(ROLE_IDS) as PartnerRole[]) if (target === 'all' || target === role) {
      expect(trainPartner(s, ROLE_IDS[role], choice)).toBe(true);
    }
  }
  const trainingCapitalCost = capitalBefore - s.coins;
  expect(trainingCapitalCost).toBe(training === 'none' ? 0 : PARTNER_TRAIN_COST * (training.startsWith('all-') ? 3 : 1));
  const sim = new Sim(seeded());
  const waits = new Map<number, number>();
  const charged = new Set<number>();
  const paidWaits: number[] = [];
  openShop(s);
  for (let i = 0; i < SECONDS / DT; i++) {
    // Discrete pre-tick wait measurement: arrival-to-payment among paid guests.
    // Unpaid cancelled/walkout visits are excluded, then reported separately.
    for (const c of sim.customers) if (!c.hasCup && c.phase !== 'exiting' && c.phase !== 'sitting') {
      waits.set(c.id, (waits.get(c.id) ?? 0) + DT);
    }
    sim.update(s, DT);
    for (const c of sim.customers) if (c.hasCup && !charged.has(c.id)) {
      charged.add(c.id);
      paidWaits.push(waits.get(c.id) ?? 0);
    }
  }
  const unfinishedAtClose = sim.customers.filter(c => !c.hasCup && !c.soldOut && c.phase !== 'exiting').length;
  // Same exact closing time in every case: no variable service-drain window.
  const report = sim.closeShop(s)!;
  expect(paidWaits.length).toBe(report.served);
  return {
    style, training, seed: SEED, seconds: SECONDS,
    served: report.served,
    throughputPerMinute: report.served / (SECONDS / 60),
    meanPaidWaitSeconds: paidWaits.length ? paidWaits.reduce((a, b) => a + b, 0) / paidWaits.length : null,
    paidWaitSamples: paidWaits.length,
    revenue: report.revenue,
    ingredientCost: report.ingredientCost,
    petCost: report.petCost,
    profit: report.profit,
    trainingCapitalCost,
    profitAfterTrainingCapital: report.profit - trainingCapitalCost,
    averageTicket: report.served ? report.revenue / report.served : 0,
    missed: report.missed,
    queueLost: report.queueLost,
    tableLost: report.tableLost,
    doorLost: report.doorLost,
    soldOut: report.soldOut,
    unfinishedAtClose,
    staleCost: report.staleCost,
    routeHandoffs: { ...s.cafeStyle.handoffs },
    jobs: Object.fromEntries(Object.entries(s.partners.roster).map(([id, p]) => [id, p.xp - 20])),
  };
}
describe('fixed-seed qualified six-focus partner operating measurements', () => {
  it('compares baseline, both all-role specialties, and each isolated role choice', () => {
    const rows = STYLE_IDS.flatMap(style => TRAININGS.map(training => measure(style, training)));
    expect(rows).toHaveLength(54);
    for (const row of rows) {
      expect(row.served).toBeGreaterThan(0);
      expect(Number.isFinite(row.profit)).toBe(true);
      expect(row.meanPaidWaitSeconds).not.toBeNull();
      expect(Object.values(row.jobs).every(n => n >= 0)).toBe(true);
    }
    expect(measure('coffee', 'none')).toEqual(rows.find(r => r.style === 'coffee' && r.training === 'none'));
    const measurement = {
      fixture: { menu: ['espresso', 'blacktea', 'first pastry in catalog'], hiredBaristas: 1, servers: 1, cooks: 1, cats: ['ginger', 'tuxedo', 'calico'], decor: ['sill_cactus', 'ceiling_lights'], minimumComfort: 7, startingPartnerXP: 20 },
      scope: 'Identical endowed shops with route prerequisites; one seed and 300 seconds per run. Not optimized route builds, affordability analysis, or proof of economic balance.',
      waitDefinition: 'Discrete pre-tick arrival-to-payment wait for successful customers only, resolution 0.1 seconds; unfinished/lost guests reported separately.',
      capitalAccounting: 'Operating profit includes ingredient, pet and promotion costs. Separate training cost is 80 per trained partner; both all-role choices cost 240. Existing shop asset capital and endowed XP are not included.',
      rows,
    };
    mkdirSync('artifacts/partner-growth', { recursive: true });
    writeFileSync('artifacts/partner-growth/measurements.json', JSON.stringify(measurement, null, 2) + '\n', 'utf8');
    console.log('PARTNER_STYLE_MEASUREMENTS=' + JSON.stringify(measurement));
  }, 120_000);
});
