// Checks that `godot/core/game_session.gd` runs a café as `src/main.ts` does: whole careers played through main.ts's
// own functions (taken out of it by godot-parity/main-source.mjs) and repeated in Godot, comparing the state, the
// simulation, the save file's text and everything the screen is told.
// npm run godot:session              10 seeds x 3 strategies x 30 days
// npm run godot:session -- --quick   one seed x 3 strategies x 4 days
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundle, PARITY_DIR, ROOT } from './godot-parity/bundle.mjs';
import { writeMainSession } from './godot-parity/main-source.mjs';
import { branchGate } from './godot-parity/gate.mjs';
import { partsOf, record, repeat } from './godot-parity/replay.mjs';
import { importProject } from './godot-parity/run.mjs';
import { SESSION_TRAPS, traps } from './godot-parity/traps.mjs';

const t0 = Date.now(), quick = process.argv.includes('--quick'), [seeds, days] = quick ? [1, 4] : [10, 30], since = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
const fail = (reason) => { console.error(reason); process.exit(1); };
/** What the full careers must include at least this often, or they prove less than they say. */
const MUST = {
  'ui.report': 300, 'toast.manager.dayDone': 30, 'toast.manager.opened': 30, 'toast.manager.restocked': 1, 'toast.manager.noSupply': 1, 'ui.soldOut': 5, 'toast.toast.hoursClosing': 100, '$HIDE.undefined': 100, '$RESTART.close': 30, '$RESTART.crash': 30,
  'toast.orders.readyToast': 1, 'toast.gift.arrived': 1, 'toast.gift.collected': 5, 'toast.milestone.toast.reached': 10, 'toast.chain.opened': 5, 'ui.recommend': 20, 'toast.toast.evicted': 1, '$G.resetGame': 1, '$G.press': 20, '$G.startBranch': 5,
  'toast.flow.helpBrewToast': 10, 'toast.flow.helpComfortToast': 10, 'toast.flow.helpQueueToast': 10, 'toast.flow.helpTrialToast': 1, 'toast.moment.greet.toast': 5, 'toast.moment.photo.toast': 10, 'toast.moment.delivery.toast': 10, 'toast.moment.cat.toast': 10,
  '$STORE.failReads': 5, '$STORE.failWrites': 5, '$STORE.edit': 2,
};

importProject();
await writeMainSession();
const gates = await record(await bundle('session-entry', PARITY_DIR), 'session', [String(seeds), String(days)]);
const sum = (key) => gates.reduce((n, g) => n + g[key], 0), counts = {};
for (const g of gates) for (const [k, v] of Object.entries(g.counts)) counts[k] = (counts[k] ?? 0) + v;
console.log(`${sum('runs')} careers recorded, ${sum('days')} days, ${sum('frames')} frames (${since()})`);
const short = gates.filter((g) => g.runs > 0 && g.fewest < days);
if (short.length) fail(`A career ended after ${short[0].fewest} of ${days} days`);
{
  const allow = JSON.parse(readFileSync(join(ROOT, 'scripts/godot-parity/allow.json'), 'utf8')), dirs = partsOf('session');
  const problems = branchGate(gates.map((g, i) => ({ branches: g.branches, map: readFileSync(join(dirs[i], 'reached.bin')) })), { branches: allow.sessionBranches }, ['main-session', 'save-session', 'storage']);
  if (problems.length) fail(`Coverage gate:\n  ${problems.join('\n  ')}`);
}
if (!quick) {
  const missing = Object.entries(MUST).filter(([k, n]) => (counts[k] ?? 0) < n);
  console.log(Object.entries(counts).filter(([k]) => /^(ui|toast|\$)/.test(k)).sort().map(([k, v]) => `${k}:${v}`).join(' '));
  if (missing.length) fail(`The careers include too little of:\n  ${missing.map(([k, n]) => `${k}: ${counts[k] ?? 0} of ${n}`).join('\n  ')}`);
}
const problem = await repeat(partsOf('session'), gates, 'run_session.gd', 'Session', (g) => g.lines);
if (problem) fail(problem);
console.log(`All ${sum('lines')} checkpoints equal (${since()}).`);
if (!quick) {
  const missed = await traps(SESSION_TRAPS, 'run_session.gd', partsOf('session'));
  if (missed) fail(missed);
  console.log(`Every trap was caught (${since()}).`);
}
