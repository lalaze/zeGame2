#!/usr/bin/env node
// Contact sheets of every staff kit as the game paints it, for looking over a whole batch.
//
//   node scripts/art-gen/team-review.mjs --out=<dir> [--ids=0,12,chef]
//
// One row per kit: the 21 walking poses and the 3 seated ones, painted by the real pipeline in a
// look that changes skin, hair, apron and trousers, so anything that fails to recolour shows up
// as a patch of the source's peach, chestnut or sage. Writes <dir>/staff-N.png, eleven kits each.
import fs from 'node:fs';
import path from 'node:path';
import { encodePng } from '../pixel-conform.mjs';
import { hexRgb, paintTeamPose, segmentTeamPose, shadeRamp, voteTeamPose } from '../../src/render/team-pixel-art.ts';
import { blank, blit, scaled } from './lib.mjs';
import { teamKit } from './team-kit.mjs';

const ROOT = 'assets/generated/cozy-team-v9';
const opt = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = opt('out'); if (!out) { console.error('Usage: team-review.mjs --out=<dir> [--ids=...]'); process.exit(2); }
const styles = JSON.parse(fs.readFileSync(`${ROOT}/hairstyles.json`, 'utf8'));
const selected = fs.existsSync(`${ROOT}/selected.json`) ? JSON.parse(fs.readFileSync(`${ROOT}/selected.json`, 'utf8')) : {};
const ids = (opt('ids')?.split(',') ?? Object.keys(styles)).filter(id => fs.existsSync(`${ROOT}/kits/${id}`));
const ramp = colour => shadeRamp(hexRgb(colour));
// Deliberately unlike the source colours (peach, chestnut, sage, cream).
const LOOKS = [{ skin: '#80533f', hair: '#cc8c9f', cloth: '#799ba7', pants: '#53637b' }, { skin: '#b67c55', hair: '#626782', cloth: '#bb6b58', pants: '#585464' }, { skin: '#dfaa7d', hair: '#dfb96f', cloth: '#9b87af', pants: '#53637b' }]
  .map(look => Object.fromEntries(Object.entries(look).map(([key, colour]) => [key, ramp(colour)])));
const D = 2, W = 32 * D, H = 44 * D, SW = 44 * D, PER_SHEET = 11;
fs.mkdirSync(out, { recursive: true });
const rows = [];
for (const [index, id] of ids.entries()) {
  const base = `${ROOT}/kits/${id}`, takes = fs.readdirSync(base).filter(name => fs.existsSync(`${base}/${name}/sheet.png`)).sort((a, b) => a.slice(5) - b.slice(5));
  const take = selected[id] ? `take-${selected[id]}` : takes.at(-1); if (!take) continue;
  const role = id === 'chef' ? 'cook' : 'owner', { walk, seated, report } = teamKit(`${base}/${take}`, id === 'chef' ? 'chef' : 'staff');
  const standing = walk.flat(), scale = Math.min(40 / Math.max(...standing.map(f => f.height)), 28 / Math.max(...standing.map(f => f.width)));
  const seatScale = Math.min(37 / Math.max(...seated.map(f => f.height)), 31 / Math.max(...seated.map(f => f.width)));
  const row = blank(W * 21 + SW * 3, H), colours = LOOKS[index % LOOKS.length];
  for (let n = 0; n < row.pixels.length; n += 4) row.pixels.set([233, 217, 184, 255], n);
  standing.forEach((f, n) => {
    const seg = segmentTeamPose({ data: f.pixels, width: f.width, height: f.height, anchors: {} }, { role, sit: false, back: Math.floor(n / 7) === 1 });
    const grid = voteTeamPose(seg, { x: (16 - f.width * scale / 2) * D, y: (42 - f.height * scale) * D, scale: scale * D }, W, H);
    blit(row, { width: W, height: H, pixels: paintTeamPose(grid, colours) }, 0, 0, W, H, n * W, 0);
  });
  seated.forEach((f, n) => {
    const seg = segmentTeamPose({ data: f.pixels, width: f.width, height: f.height, anchors: f.anchors }, { role, sit: true, back: false });
    const grid = voteTeamPose(seg, { x: (13 - f.anchors.floor.x * seatScale) * D, y: (41 - f.anchors.floor.y * seatScale) * D, scale: seatScale * D }, SW, H);
    blit(row, { width: SW, height: H, pixels: paintTeamPose(grid, colours) }, 0, 0, SW, H, 21 * W + n * SW, 0);
  });
  rows.push({ id, row, warnings: report.warnings.length });
}
for (let sheet = 0; sheet * PER_SHEET < rows.length; sheet++) {
  const part = rows.slice(sheet * PER_SHEET, (sheet + 1) * PER_SHEET), image = blank(part[0].row.width, H * part.length);
  part.forEach(({ row }, n) => blit(image, row, 0, 0, row.width, H, 0, n * H));
  encodePng(path.join(out, `staff-${sheet}.png`), image);
  console.log(`staff-${sheet}.png: ${part.map(({ id, warnings }) => `${id} ${styles[id].name}${warnings ? ` (${warnings}!)` : ''}`).join(', ')}`);
}
