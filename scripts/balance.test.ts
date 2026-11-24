// Run with: npm run balance. Same assets, stock value and seeds for each menu.
import { expect, it } from 'vitest';
import { MENU, type ItemId } from '../src/game/data';
import { openShop } from '../src/game/day';
import { bakeForForecast } from '../src/game/economy';
import { Sim } from '../src/game/sim';
import { createInitialState } from '../src/game/state';

const menus: Record<string, ItemId[]> = {
  fast: ['espresso'], high: ['latte'], mixed: ['espresso', 'roll'],
  all: ['espresso','americano','latte','blacktea','roll','bagel','donut'],
};
function sample(menu: ItemId[], marketing: number, click = 0) {
  const results = [];
  for (let seed = 1; seed <= 12; seed++) {
    let n = seed;
    const s = createInitialState(0);
    // All alternatives are owned: only today's selection changes.
    for (const id of menus.all) s.items[id] = 1;
    s.coins = 10000;
    // Every compared menu owns the same kitchen; bakery is unavailable without it.
    s.kitchen = true;
    for (const key of Object.keys(s.pantry) as (keyof typeof s.pantry)[]) s.pantry[key] = 1000;
    s.onMenu = menu; s.upgrades.marketing = marketing;
    bakeForForecast(s); openShop(s);
    const sim = new Sim(() => { n = (n * 1664525 + 1013904223) >>> 0; return n / 2 ** 32; });
    // Include sustained service, not just the new floor plan's initial walk-in period.
    for (let i = 0; i < 7200; i++) { sim.update(s, 0.05); if (click && i % click === 0) sim.boost(); }
    const report = sim.closeShop(s)!;
    results.push({ profit: report.profit, lost: report.missed, stale: Object.values(report.stale).reduce((a,b) => a+b,0), served: report.served });
  }
  return Object.fromEntries(['profit','lost','stale','served'].map((key) => [key, Math.round(results.reduce((sum, r) => sum + r[key as keyof typeof r], 0) / results.length)]));
}
it('offers a different profitable menu when production, rather than arrivals, limits service', () => {
  const current = MENU.map((m) => ({ ...m }));
  const rows: ({ version: string; marketing: number; menu: string } & Record<string, number | string>)[] = [];
  // Historical values are a benchmark, not a second production ruleset.
  const legacy: Partial<Record<ItemId, [number, number]>> = { espresso: [3,2], americano:[5,2.2], latte:[10,3], blacktea:[9,2.5], roll:[5,1], bagel:[12,1.5], donut:[20,1] };
  for (const version of ['before','after']) {
    try {
      if (version === 'before') for (const m of MENU) { const v = legacy[m.id]; if (v) { m.basePrice = v[0]; m.prepTime = v[1]; } }
      for (const marketing of [0,25]) for (const [name, menu] of Object.entries(menus)) rows.push({ version, marketing, menu: name, ...sample(menu, marketing) });
    } finally { MENU.forEach((m, i) => Object.assign(m, current[i])); }
  }
  console.table(rows);
  // With few guests the dearer drink and the wider menu earn the most. Once the barista is the limit, a
  // short menu that is quick to make (with something from the kitchen beside it) serves far more and earns more.
  const now = (menu: string, marketing: number, what: 'profit' | 'served' = 'profit') =>
    rows.find(row => row.version === 'after' && row.menu === menu && row.marketing === marketing)![what] as number;
  const best = (marketing: number) => Object.keys(menus).reduce((a, b) => (now(b, marketing) > now(a, marketing) ? b : a));
  expect(now('high', 0)).toBeGreaterThan(now('fast', 0));
  expect(best(0)).toBe('all');
  expect(best(25)).toBe('mixed');
  expect(now('mixed', 25, 'served')).toBeGreaterThan(2 * now('all', 25, 'served'));
  console.table([0,20,2].map((click) => ({ clicks: click === 0 ? 'none' : click === 20 ? '1/sec' : '10/sec', ...sample(menus.all,25,click) })));
}, 120_000);
