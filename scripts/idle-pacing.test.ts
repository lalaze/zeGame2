import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PROFILES, runAll, runProfile, table, tuning } from './idle-pacing';

it('walks a casual player through the first two days with the real game functions', () => {
  const r = runProfile(PROFILES.find((p) => p.id === 'casual')!, { days: 2 });
  expect(r.reached.manager).toBeDefined();
  expect(r.final.totalEarned).toBeGreaterThan(0);
});

it.skipIf(process.env.IDLE_PACING !== '1')('reports real-time pacing for every check-in profile', () => {
  const label = process.env.IDLE_PACING_LABEL ?? 'current';
  const results = runAll({ days: 14 });
  const report = [`## ${label}`, '', table(results), '', '```json', JSON.stringify(tuning(), null, 2), '```', ''].join('\n');
  console.log(report);
  mkdirSync('docs/idle-pacing/results', { recursive: true });
  writeFileSync(`docs/idle-pacing/results/${label}.json`, JSON.stringify({ label, tuning: tuning(), results }, null, 2) + '\n');
  writeFileSync(`docs/idle-pacing/results/${label}.md`, report);
}, 600_000);
