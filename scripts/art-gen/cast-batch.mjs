#!/usr/bin/env node
// Generate action kits for café customers with Codex, a few at a time.
//
//   node scripts/art-gen/cast-batch.mjs [--ids=0,6,19 | --all] [--parallel=3] [--take=1] [--force]
//
// For each customer: builds refs/customer-<id>.png (the shipped front, back, profile and seated
// frames, enlarged, so Codex knows who this is), fills prompts/kit-template.txt with the
// identity from identities.json, and runs codex-kit.mjs into kits/customer-<id>/take-<n>/.
// Customers whose take already has all four GIFs are skipped unless --force.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { encodePng } from '../pixel-conform.mjs';
import { FW, FH, blank, blit, scaled, castMaster, diningMaster } from './lib.mjs';

const ROOT = 'assets/generated/cozy-cast-v9', ROWS = ['walk-front', 'walk-back', 'walk-right', 'seated'];
const opt = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const identities = JSON.parse(fs.readFileSync(`${ROOT}/identities.json`, 'utf8'));
const ids = process.argv.includes('--all') ? Object.keys(identities).map(Number) : (opt('ids', '') || '').split(',').filter(Boolean).map(Number);
const parallel = Number(opt('parallel', 3)), take = Number(opt('take', 1)), force = process.argv.includes('--force');
if (!ids.length) { console.error('Usage: cast-batch.mjs --ids=0,6,19 | --all  [--parallel=3] [--take=1] [--force]'); process.exit(2); }
const template = fs.readFileSync(`${ROOT}/prompts/kit-template.txt`, 'utf8');
fs.mkdirSync(`${ROOT}/refs`, { recursive: true });

function prepare(id) {
  const walk = castMaster(id), seat = diningMaster(id), sheet = blank(FW * 4, FH);
  [0, 3, 6].forEach((frame, slot) => blit(sheet, walk, frame * FW, 0, FW, FH, slot * FW, 0));
  blit(sheet, seat, 0, 0, FW, FH, 3 * FW, 0);
  const ref = `${ROOT}/refs/customer-${id}.png`, prompt = `${ROOT}/prompts/customer-${id}.txt`;
  encodePng(ref, scaled(sheet, 4));
  fs.writeFileSync(prompt, template.replace('{identity}', identities[id].identity));
  return { ref, prompt };
}
const dirOf = id => `${ROOT}/kits/customer-${id}/take-${take}`;
const done = id => ROWS.every(row => fs.existsSync(path.join(dirOf(id), `${row}.gif`)));
const queue = ids.filter(id => force || !done(id)), failed = [];
console.log(`${queue.length} to generate, ${ids.length - queue.length} already done, ${parallel} at a time`);
let finished = 0;
/** Another batch process is on this customer: its log is fresh and it has not reported yet. */
const busy = id => { const log = path.join(dirOf(id), 'run.log'); return fs.existsSync(log) && !fs.existsSync(path.join(dirOf(id), 'kit.json')) && Date.now() - fs.statSync(log).mtimeMs < 20 * 60_000; };
async function worker() {
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (!force && (done(id) || busy(id))) { console.log(`customer ${id}: already done or in progress elsewhere, skipped`); continue; }
    const { ref, prompt } = prepare(id), out = dirOf(id);
    fs.mkdirSync(out, { recursive: true });
    const log = fs.openSync(path.join(out, 'run.log'), 'w');
    const code = await new Promise(resolve => spawn('node', ['scripts/art-gen/codex-kit.mjs', `--out=${out}`, `--prompt=${prompt}`,
      `--ref=${ROOT}/style-b.png`, `--ref=${ref}`, `--rows=${ROWS.join(',')}`], { stdio: ['ignore', log, log] }).on('close', resolve));
    fs.closeSync(log);
    if (code) failed.push(id);
    console.log(`[${++finished}] customer ${id} ${identities[id].name}: ${code ? 'FAILED' : 'ok'}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
console.log(failed.length ? `FAILED: ${failed.join(',')}` : 'all ok');
process.exit(failed.length ? 1 : 0);
