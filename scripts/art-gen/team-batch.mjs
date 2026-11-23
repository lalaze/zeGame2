#!/usr/bin/env node
// Generate café staff kits with Codex: one sheet per hairstyle (and one for the chef) holding
// the standing poses, six-frame walk cycles in three directions and the three seated poses.
//
//   node scripts/art-gen/team-batch.mjs [--ids=0,12,chef | --all] [--parallel=4] [--take=1] [--force]
//
// For each look it builds refs/<id>-seated.png (that look's row of the shipped seated sheet),
// fills prompts/kit-template.txt from hairstyles.json and prompts/outfits.json, and runs
// codex-image.mjs into kits/<id>/take-<n>/sheet.png. Looks whose take exists are skipped.
// Staff frames are recoloured per saved look at runtime, so the deliverable is the sheet itself.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { decodePng, encodePng } from '../pixel-conform.mjs';
import { blank, blit } from './lib.mjs';

const ROOT = 'assets/generated/cozy-team-v9', V7 = 'assets/legacy-packs/cozy-team-v7', V8 = 'assets/generated/cozy-team-v8';
const opt = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const styles = JSON.parse(fs.readFileSync(`${ROOT}/hairstyles.json`, 'utf8')), outfits = JSON.parse(fs.readFileSync(`${ROOT}/prompts/outfits.json`, 'utf8'));
const ids = process.argv.includes('--all') ? Object.keys(styles) : (opt('ids', '') || '').split(',').filter(Boolean);
const parallel = Number(opt('parallel', 4)), take = Number(opt('take', 1)), force = process.argv.includes('--force');
if (!ids.length || ids.some(id => !styles[id])) { console.error('Usage: team-batch.mjs --ids=0,12,chef | --all  [--parallel=4] [--take=1] [--force]'); process.exit(2); }
const template = fs.readFileSync(`${ROOT}/prompts/kit-template.txt`, 'utf8');
fs.mkdirSync(`${ROOT}/refs`, { recursive: true });

/** The shipped family sheet and the seated row that show this look. */
function references(id) {
  if (id === 'chef') return [`${V7}/chef-walk.png`, `${V7}/chef-seated.png`];
  const n = Number(id), name = styles[id].name, family = n < 8 ? `${V7}/hair-${n}-${name}-v1.png` : `${V8}/hair-${n}-${name}-v1.png`;
  const letter = 'abcdefgh'[Math.floor(n / 4)], sheet = decodePng(n < 8 ? `${V7}/seated-${letter}.png` : `${V8}/seated-${letter}.png`);
  const band = Math.round(sheet.height / 4), row = blank(sheet.width, band);
  // Seated sheets hold four looks, one per row.
  for (let y = 0; y < band; y++) row.pixels.set(sheet.pixels.subarray(((n % 4) * band + y) * sheet.width * 4, ((n % 4) * band + y + 1) * sheet.width * 4), y * sheet.width * 4);
  const seated = `${ROOT}/refs/${id}-seated.png`;
  encodePng(seated, row);
  return [family, seated];
}
function prepare(id) {
  const outfit = outfits[id === 'chef' ? 'chef' : 'staff'], prompt = `${ROOT}/prompts/${id}.txt`;
  fs.writeFileSync(prompt, template.replace('{outfit}', outfit.outfit).replace('{outfitColours}', outfit.outfitColours).replace('{backDetail}', outfit.backDetail).replace('{hair}', styles[id].hair));
  return { prompt, refs: [`${ROOT}/style-b-staff.png`, ...references(id)] };
}
const dirOf = id => `${ROOT}/kits/${id}/take-${take}`;
const done = id => fs.existsSync(path.join(dirOf(id), 'sheet.png'));
const busy = id => { const log = path.join(dirOf(id), 'run.log'); return fs.existsSync(log) && !done(id) && Date.now() - fs.statSync(log).mtimeMs < 15 * 60_000; };
const queue = ids.filter(id => force || !done(id)), failed = [];
console.log(`${queue.length} to generate, ${ids.length - queue.length} already done, ${parallel} at a time`);
let finished = 0;
async function worker() {
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (!force && (done(id) || busy(id))) { console.log(`${id}: already done or in progress elsewhere, skipped`); continue; }
    const { prompt, refs } = prepare(id), out = dirOf(id);
    fs.mkdirSync(out, { recursive: true });
    const log = fs.openSync(path.join(out, 'run.log'), 'w');
    const code = await new Promise(resolve => spawn('node', ['scripts/art-gen/codex-image.mjs', `--out=${out}/sheet.png`, `--prompt=${prompt}`, ...refs.map(ref => `--ref=${ref}`)],
      { stdio: ['ignore', log, log] }).on('close', resolve));
    fs.closeSync(log);
    if (code) failed.push(id);
    console.log(`[${++finished}] ${id} ${styles[id].name}: ${code ? 'FAILED' : 'ok'}`);
  }
}
await Promise.all(Array.from({ length: parallel }, worker));
console.log(failed.length ? `FAILED: ${failed.join(',')}` : 'all ok');
process.exit(failed.length ? 1 : 0);
