#!/usr/bin/env node
// Cut a generated character sheet into game frames on the café art grid.
//
//   node scripts/art-gen/slice-figures.mjs <sheet.png> --cols=6 --rows=3 --out=<dir/prefix>
//        [--seated=5] [--frame=80x88] [--fit=78x72] [--foot=40,84] [--no-palette]
//
// Finds the transparent gutters (generated cells are never an exact grid), keeps each cell's
// largest connected figure, scales every row by one factor so the standing poses are --fit
// tall, resamples with the game's dominant-colour resampler and snaps to the master palette
// with binary alpha. Writes <prefix>-row<N>.png (cols × frame) and <prefix>.json with
// the scale, colour count and palette drift of each row.
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng, oklab } from '../pixel-conform.mjs';
import { resampleRgba } from '../../src/render/pixel-resample.ts';

const args = process.argv.slice(2), sheetFile = args.find(a => !a.startsWith('--'));
const opt = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const pair = (value, sep) => value.split(sep).map(Number);
const cols = Number(opt('cols', 6)), rows = Number(opt('rows', 3)), prefix = opt('out');
const seatedFrom = Number(opt('seated', cols)), [FW, FH] = pair(opt('frame', '80x88'), 'x');
const [fitH, fitW] = pair(opt('fit', '78x72'), 'x'), [footX, footY] = pair(opt('foot', '40,84'), ',');
if (!sheetFile || !prefix) { console.error('Usage: slice-figures.mjs <sheet.png> --cols=N --rows=N --out=<dir/prefix>'); process.exit(2); }

const usePalette = !args.includes('--no-palette');
const palette = JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.filter(c => !c.ramp.startsWith('team-'))
  .map(c => [1, 3, 5].map(i => parseInt(c.hex.slice(i, i + 2), 16)));
const labs = palette.map(c => oklab(...c)), cache = new Map();
let snapDistance = 0, snapped = 0;
const snap = (r, g, b) => {
  const key = r * 65536 + g * 256 + b;
  if (!cache.has(key)) {
    const lab = oklab(r, g, b); let best = 0, distance = Infinity;
    labs.forEach((p, i) => { const d = p.reduce((n, v, k) => n + (v - lab[k]) ** 2, 0); if (d < distance) { distance = d; best = i; } });
    cache.set(key, [palette[best], Math.sqrt(distance)]);
  }
  const [colour, distance] = cache.get(key); snapDistance += distance; snapped++;
  return colour;
};

const sheet = decodePng(sheetFile), { width, height, pixels } = sheet;
// A sheet that came back on a flat backdrop instead of transparency: key out the corner colour.
let clear = 0; for (let n = 3; n < pixels.length; n += 4) if (pixels[n] < 128) clear++;
const keyed = clear < pixels.length / 4 * 0.05;
if (keyed) {
  const [kr, kg, kb] = pixels;
  for (let n = 0; n < pixels.length; n += 4) if (Math.abs(pixels[n] - kr) + Math.abs(pixels[n + 1] - kg) + Math.abs(pixels[n + 2] - kb) < 48) pixels[n + 3] = 0;
}
const solid = n => pixels[n * 4 + 3] >= 128;
const seams = (histogram, parts) => {
  const edges = [0];
  for (let n = 1; n < parts; n++) {
    const start = Math.round(histogram.length * (n - .3) / parts), end = Math.round(histogram.length * (n + .3) / parts);
    let at = start; for (let i = start; i < end; i++) if (histogram[i] < histogram[at]) at = i;
    edges.push(at);
  }
  return [...edges, histogram.length];
};
const rowHistogram = new Uint32Array(height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (solid(y * width + x)) rowHistogram[y]++;
const ys = seams(rowHistogram, rows);

function figure(x0, x1, y0, y1) {
  const w = x1 - x0, h = y1 - y0, seen = new Uint8Array(w * h); let person = [];
  const at = (x, y) => (y + y0) * width + x + x0;
  for (let n = 0; n < seen.length; n++) {
    if (seen[n] || !solid(at(n % w, Math.floor(n / w)))) continue;
    const island = [n]; seen[n] = 1;
    for (let k = 0; k < island.length; k++) {
      const p = island[k], x = p % w, y = Math.floor(p / w);
      // 8-connected, so a one-pixel gap at a diagonal never drops a hand or a hair tuft.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, v = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[v] || !solid(at(nx, ny))) continue;
        seen[v] = 1; island.push(v);
      }
    }
    if (island.length > person.length) person = island;
  }
  if (person.length < 300) return null;
  let l = w, t = h, r = 0, b = 0;
  for (const p of person) { const x = p % w, y = Math.floor(p / w); l = Math.min(l, x); r = Math.max(r, x + 1); t = Math.min(t, y); b = Math.max(b, y + 1); }
  const clean = new Uint8ClampedArray((r - l) * (b - t) * 4);
  for (const p of person) { const x = p % w, y = Math.floor(p / w), source = at(x, y) * 4; clean.set(pixels.subarray(source, source + 4), ((y - t) * (r - l) + x - l) * 4); }
  return { width: r - l, height: b - t, pixels: clean, box: [x0 + l, y0 + t, x0 + r, y0 + b] };
}

fs.mkdirSync(path.dirname(prefix), { recursive: true });
const report = { sheet: sheetFile, size: [width, height], keyedBackdrop: keyed, frame: [FW, FH], rows: [] };
for (let row = 0; row < rows; row++) {
  const columnHistogram = new Uint32Array(width);
  for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = 0; x < width; x++) if (solid(y * width + x)) columnHistogram[x]++;
  const xs = seams(columnHistogram, cols);
  const poses = Array.from({ length: cols }, (_, column) => figure(xs[column], xs[column + 1], ys[row], ys[row + 1]));
  if (poses.some(p => !p)) { report.rows.push({ row, error: `missing figure in column ${poses.findIndex(p => !p)}` }); continue; }
  const standing = poses.slice(0, seatedFrom);
  const scale = Math.min(fitH / Math.max(...standing.map(p => p.height)), fitW / Math.max(...poses.map(p => p.width)));
  const atlas = { width: FW * cols, height: FH, pixels: new Uint8ClampedArray(FW * cols * FH * 4) }, frames = [], colours = new Set();
  snapDistance = 0; snapped = 0;
  for (const [index, p] of poses.entries()) {
    const seated = index >= seatedFrom, w = Math.round(p.width * scale), h = Math.round(p.height * scale);
    // Same placement rule as the shipped cast: standing figures centre on the foot point,
    // seated ones hang from the hip point so the chair can be drawn under them.
    let x = seated ? Math.round(footX - 4 - w * .38) : footX - Math.round(w / 2), y = seated ? footY - 20 - Math.round(h * .76) : footY - h;
    x = Math.max(0, Math.min(FW - w, x)); y = Math.max(0, Math.min(FH - h, y));
    const frame = resampleRgba(p.pixels, p.width, p.height, w, h);
    for (let n = 0; n < frame.length; n += 4) {
      if (frame[n + 3] < 128) { frame.fill(0, n, n + 4); continue; }
      frame[n + 3] = 255;
      if (usePalette) frame.set(snap(frame[n], frame[n + 1], frame[n + 2]), n);
      colours.add(frame[n] * 65536 + frame[n + 1] * 256 + frame[n + 2]);
    }
    for (let dy = 0; dy < h; dy++) atlas.pixels.set(frame.subarray(dy * w * 4, (dy + 1) * w * 4), ((dy + y) * atlas.width + index * FW + x) * 4);
    frames.push({ box: [x, y, w, h], sourceBox: p.box });
  }
  const file = `${prefix}-row${row}.png`; encodePng(file, atlas);
  const headTall = standing[0].height * scale;
  report.rows.push({
    row, file, scale: +scale.toFixed(4), standingHeight: Math.round(headTall), colours: colours.size,
    // 1 means one painted pixel became one game pixel; larger means detail was thrown away.
    sourcePixelsPerGamePixel: +(1 / scale).toFixed(2),
    meanPaletteDistance: +(snapDistance / Math.max(1, snapped)).toFixed(4), frames,
  });
}
fs.writeFileSync(`${prefix}.json`, JSON.stringify(report, null, 2) + '\n');
for (const r of report.rows) console.log(r.error ? `row ${r.row}: ${r.error}` :
  `row ${r.row}: scale ${r.scale} (1 game px = ${r.sourcePixelsPerGamePixel} source px), ${r.colours} colours, palette drift ${r.meanPaletteDistance}`);
