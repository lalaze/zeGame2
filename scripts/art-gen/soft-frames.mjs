#!/usr/bin/env node
// Cut a soft-shaded (non-pixel) character sheet into equal frames for the cross-section style
// (assets/generated/art-direction-v1). Unlike slice-figures.mjs it keeps the painted soft edges:
// figures are found with sliceSheet() from lib.mjs, then copied from the untouched sheet.
//
//   node scripts/art-gen/soft-frames.mjs <sheet.png> --out=<dir/name> [--cols=4] [--rows=2] [--height=250] [--ref=4,5] [--scale=<factor>]
//
// Every figure is scaled by one factor, so the reference cells (by default the front-facing
// standing poses: row 2, first two cells) are --height pixels tall on average. --scale sets the
// factor directly instead, to match a sheet already cut (its .json records its scale). Frames share one size; each figure stands on the bottom edge,
// centred on its head (the head stays still while the legs swing). Writes <name>.png (one row of
// frames, left to right, top row of the sheet first) and <name>.json with the frame size.
import fs from 'node:fs';
import path from 'node:path';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';
import { decodePng } from '../pixel-conform.mjs';
import { sliceSheet } from './lib.mjs';
import { librarySource } from '../art-files.mjs';

const args = process.argv.slice(2), sheetFile = args.find(a => !a.startsWith('--'));
const opt = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const cols = Number(opt('cols', 4)), rows = Number(opt('rows', 2)), height = Number(opt('height', 250)), out = opt('out');
const refCells = opt('ref', `${cols},${cols + 1}`).split(',').map(Number);
if (!sheetFile || !out) { console.error('Usage: soft-frames.mjs <sheet.png> --out=<dir/name> [--cols=4] [--rows=2] [--height=250]'); process.exit(2); }

// Sheets kept in the art library are read from there (assets/ART-LIBRARY.md).
const sheet = decodePng(librarySource(sheetFile));
const original = Uint8ClampedArray.from(sheet.pixels);
const figures = sliceSheet(sheet, cols, rows).flat();
if (figures.some(f => !f)) throw new Error(`${sheetFile}: expected ${cols * rows} figures, found ${figures.filter(Boolean).length}`);

/** The figure's own pixels with their painted alpha: anything within 2 px of its cut shape. */
function soft({ box: [x0, y0, x1, y1], pixels: mask }) {
  const pad = 2, w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad, data = new Uint8ClampedArray(w * h * 4);
  const inside = (x, y) => x >= 0 && y >= 0 && x < x1 - x0 && y < y1 - y0 && mask[(y * (x1 - x0) + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let near = false;
    for (let dy = -pad; dy <= pad && !near; dy++) for (let dx = -pad; dx <= pad && !near; dx++) near = inside(x - pad + dx, y - pad + dy);
    const sx = x0 + x - pad, sy = y0 + y - pad;
    if (!near || sx < 0 || sy < 0 || sx >= sheet.width || sy >= sheet.height) continue;
    data.set(original.subarray((sy * sheet.width + sx) * 4, (sy * sheet.width + sx) * 4 + 4), (y * w + x) * 4);
  }
  return { width: w, height: h, data };
}

/** Horizontal centre of the head: mean x of opaque pixels in the top 35% of the figure. */
function headX({ width, height: h, data }) {
  let sum = 0, count = 0;
  for (let y = 0; y < h * .35; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 128) { sum += x; count++; }
  return count ? sum / count : width / 2;
}

const cut = figures.map(soft);
const standing = refCells.map(i => cut[i].height - 4);
const scale = opt('scale') ? Number(opt('scale')) : height / (standing.reduce((a, b) => a + b, 0) / standing.length);
const scaled = await Promise.all(cut.map(async f => {
  const w = Math.max(1, Math.round(f.width * scale)), h = Math.max(1, Math.round(f.height * scale));
  const data = await sharp(Buffer.from(f.data.buffer), { raw: { width: f.width, height: f.height, channels: 4 } })
    .resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer();
  return { width: w, height: h, data };
}));
const anchors = scaled.map(headX);
const half = Math.ceil(Math.max(...scaled.map((f, i) => Math.max(anchors[i], f.width - anchors[i])))) + 2;
const frameWidth = 2 * half, frameHeight = Math.max(...scaled.map(f => f.height)) + 2;
const strip = Buffer.alloc(frameWidth * cols * rows * frameHeight * 4);
scaled.forEach((f, i) => {
  const left = i * frameWidth + Math.round(half - anchors[i]), top = frameHeight - f.height;
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
    const source = (y * f.width + x) * 4, target = ((top + y) * frameWidth * cols * rows + left + x) * 4;
    for (let k = 0; k < 4; k++) strip[target + k] = f.data[source + k];
  }
});
fs.mkdirSync(path.dirname(out), { recursive: true });
await sharp(strip, { raw: { width: frameWidth * cols * rows, height: frameHeight, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${out}.png`);
fs.writeFileSync(`${out}.json`, JSON.stringify({ sheet: sheetFile, frameWidth, frameHeight, frames: cols * rows, scale: +scale.toFixed(4), footY: frameHeight }, null, 2) + '\n');
console.log(`${out}.png: ${cols * rows} frames of ${frameWidth}x${frameHeight} (scale ${scale.toFixed(3)})`);
