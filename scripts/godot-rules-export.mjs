// Writes godot/data/rules.json from the TypeScript rules (part of `npm run godot:sync`).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, bundle } from './godot-parity/bundle.mjs';

export async function exportRulesJson(root = ROOT) {
  const out = join(root, 'godot/data/rules.json');
  const run = spawnSync('node', [await bundle('rules-cli'), out], { stdio: 'inherit' });
  if (run.status !== 0) throw new Error('Exporting godot/data/rules.json failed');
  return out;
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(await exportRulesJson());
