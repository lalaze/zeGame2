import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createInitialState } from '../../../src/game/state';
import { makeSignatureId, trialSignature, saveSignature, setSignatureOnMenu } from '../../../src/game/signature-drinks';
import { salePrice, prepTime, servingCost, menuItem } from '../../../src/game/economy';
import { tasteScore } from '../../../src/game/taste';
import { GUEST_KINDS, guestAffinity } from '../../../src/game/customer-demand';
import { openShop } from '../../../src/game/day';
import { Sim } from '../../../src/game/sim';
import { GOALS, currentGoal, goalDone } from '../../../src/game/goals';
import { milestonesStarted } from '../../../src/game/milestones';
import { adoptCat } from '../../../src/game/pets';
import { partnerSlots } from '../../../src/game/partners';
import { serverCount } from '../../../src/game/economy';

const output = new URL('./evidence.json', import.meta.url);
const ids = { coffee: makeSignatureId('coffee', { beans: 1 })!, tea: makeSignatureId('tea', { tea: 1 })! };

function service(custom: boolean, marketing: number, seed: number) {
  const s = createInitialState(0);
  s.day = 3;
  s.items.blacktea = 1;
  s.upgrades.marketing = marketing;
  s.pantry.tea = 1000;
  s.onMenu = custom ? [] : ['blacktea'];
  if (custom) {
    expect(trialSignature(s, 'tea', { tea: 1 }).ok).toBe(true);
    expect(saveSignature(s, ids.tea, 'Pure tea')).toBe(true);
    expect(setSignatureOnMenu(s, ids.tea, true)).toBe(true);
  }
  const sim = new Sim(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; });
  openShop(s);
  for (let i = 0; i < 3600; i++) sim.update(s, .05);
  sim.beginClosing(s);
  for (let i = 0; i < 10000 && !sim.finishedService; i++) sim.update(s, .05);
  expect(sim.finishedService).toBe(true);
  const report = sim.closeShop(s)!;
  return { custom, marketing, served: report.served, missed: report.missed, profit: report.profit, rating: report.rating };
}

it.skipIf(process.env.GAMEPLAY_REVIEW !== '1')('records isolated current mechanics and paired pure-tea service samples', () => {
  const economics = [];
  for (const [base, stock] of [['coffee', 'espresso'], ['tea', 'blacktea']] as const) {
    for (const level of [1, 5, 10]) {
      const s = createInitialState(0);
      s.items[stock] = level;
      const custom = ids[base];
      const metrics = (id: typeof stock | typeof custom) => ({ price: salePrice(s, id), cost: servingCost(id), prep: prepTime(s, id), taste: tasteScore(s, id), affinity: Object.fromEntries(GUEST_KINDS.map(kind => [kind, guestAffinity(kind, menuItem(id))])) });
      const a = metrics(stock), b = metrics(custom);
      expect(b.cost).toBe(a.cost);
      expect(b.price).toBeCloseTo(a.price * 1.25);
      expect(b.prep).toBeLessThanOrEqual(a.prep);
      expect(b.taste).toBe(a.taste);
      economics.push({ base, level, stock: a, custom: b });
    }
  }
  const runs = [];
  for (const marketing of [0, 4, 12]) for (const seed of [12, 98, 143, 731, 1091]) {
    runs.push({ seed, ...service(false, marketing, seed) }, { seed, ...service(true, marketing, seed) });
  }
  const summary = [];
  for (const marketing of [0, 4, 12]) for (const custom of [false, true]) {
    const rows = runs.filter(row => row.marketing === marketing && row.custom === custom);
    const mean = (key: 'served' | 'profit' | 'missed' | 'rating') => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
    summary.push({ marketing, custom, served: mean('served'), missed: mean('missed'), profit: mean('profit'), rating: mean('rating') });
  }

  const route = createInitialState(0);
  route.day = 12; route.coins = 100000; route.served = 1500;
  route.cafeStyle.focus = 'garden'; route.regions = ['reading', 'greenhouse']; route.kitchen = true;
  route.items.blacktea = 10; route.goal = GOALS.findIndex(g => g.id === 'latte');
  const goalGate = { day: route.day, served: route.served, focus: route.cafeStyle.focus, current: currentGoal(route)!.id, complete: goalDone(route), milestonesStarted: milestonesStarted(route) };
  expect(goalGate.complete).toBe(false); expect(goalGate.milestonesStarted).toBe(false);

  const cats = createInitialState(0); cats.coins = 100000;
  for (const id of ['ginger', 'tabby', 'black']) expect(adoptCat(cats, id)).toBe(true);
  const catGate = { owned: cats.pets.map(cat => cat.id), cash: cats.coins, fourthAdoption: adoptCat(cats, 'ragdoll') };
  expect(catGate.fourthAdoption).toBe(false);

  const servers = createInitialState(0); servers.upgrades.server = 5; servers.regions = ['reading', 'greenhouse', 'terrace'];
  const staffing = { actualServers: serverCount(servers), namedPartnerSlots: partnerSlots(servers, 'server') };
  expect(staffing).toEqual({ actualServers: 6, namedPartnerSlots: 3 });
  writeFileSync(output, JSON.stringify({ scope: 'Current-source isolated mechanics; 5 seeded paired single-menu day-3 simulations at each marketing level, 180s arrivals plus accepted-service drain. Endowed stocks and upgrades; not fresh-save progression or proof of global dominance. Custom trial costs 0.25 tea and is excluded from operating-profit field.', economics, summary, runs, goalGate, catGate, staffing }, null, 2) + '\n');
  console.log(JSON.stringify({ summary, goalGate, catGate, staffing }));
}, 60000);
