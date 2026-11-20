#!/usr/bin/env node
// Check the compiled customer packs against the seating contracts the game relies on, per
// customer, so a failing kit can be re-taken instead of discovered one test failure at a time.
//
//   node scripts/art-gen/cast-check.mjs
//
// Mirrors src/render/cozy-cast-art.test.mjs: seated figures stand on row 83, the palm of the
// first seated pose rests on the tabletop ellipse, and both petting hands are painted pixels.
import fs from 'node:fs';
import { decodePng } from '../pixel-conform.mjs';
import { artMaster } from '../art-files.mjs';

const DINING = 'public/art/generated/cozy-dining-v5', W = 80, H = 88;
// The tabletop in seated-frame coordinates (art pixels), from SEATING_LAYOUT and the dining table manifest.
export const TABLETOP = { x: 75.5, y: 51.2, rx: 30.9, ry: 7.86 };
export const onTable = (x, y) => ((x - TABLETOP.x) / TABLETOP.rx) ** 2 + ((y - TABLETOP.y) / TABLETOP.ry) ** 2;
const manifest = JSON.parse(fs.readFileSync(`${DINING}/manifest.json`, 'utf8'));
const problems = [];
for (const sheet of manifest.characters) {
  if (!/^customer-\d+\.png$/.test(sheet.file)) continue;
  const image = decodePng(artMaster(`${DINING}/${sheet.file}`)), solid = (frame, x, y) => x >= 0 && y >= 0 && x < W && y < H && image.pixels[(y * image.width + frame * W + x) * 4 + 3] > 0;
  const notes = [];
  sheet.frames.forEach((meta, frame) => {
    let floor = 0, top = H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(frame, x, y)) { floor = Math.max(floor, y); top = Math.min(top, y); }
    if (floor !== 83) notes.push(`pose ${frame}: lowest pixel on row ${floor}, expected 83`);
    if (top < 1) notes.push(`pose ${frame}: touches the top edge`);
    if (frame === 0) {
      let right = 0;
      for (let y = meta.neck[1] + 3; y < meta.hip[1] - 2; y++) for (let x = meta.neck[0]; x < W; x++) if (solid(0, x, y)) right = Math.max(right, x);
      const x = right - 2, rows = [];
      for (let y = meta.neck[1] + 3; y < meta.hip[1] - 2; y++) if (solid(0, x, y)) rows.push(y);
      const y = Math.max(...rows), value = onTable(x, y);
      if (!(value < 1)) notes.push(`palm at ${x},${y} is off the tabletop (${value.toFixed(2)}, must be under 1)`);
    } else if (!solid(frame, meta.hand[0], meta.hand[1])) notes.push(`pose ${frame}: petting contact ${meta.hand} is not on a painted pixel`);
  });
  if (notes.length) problems.push(`customer ${sheet.id}: ${notes.join('; ')}`);
}
console.log(problems.length ? problems.join('\n') : 'all seated contracts hold');
process.exit(problems.length ? 1 : 0);
