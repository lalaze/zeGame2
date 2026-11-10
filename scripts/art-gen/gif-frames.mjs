#!/usr/bin/env node
// Turn a generated animated GIF into game frames on the café art grid.
//
//   node scripts/art-gen/gif-frames.mjs <in.gif> --out=<dir/prefix>
//        [--frame=80x88] [--fit=78x72] [--foot=40,84] [--no-palette] [--keep-fringe]
//
// Keeps the largest connected figure of every frame, scales all frames by ONE factor taken
// from their shared bounding box (so the motion Codex aligned is preserved, nothing jitters),
// resamples with the game's dominant-colour resampler, snaps to the master palette with
// binary alpha. Writes <prefix>-strip.png (frames side by side) and <prefix>.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { decodePng, encodePng, oklab } from '../pixel-conform.mjs';
import { resampleRgba } from '../../src/render/pixel-resample.ts';

const args = process.argv.slice(2), input = args.find(a => !a.startsWith('--'));
const opt = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const pair = (value, sep) => value.split(sep).map(Number);
const prefix = opt('out'), [FW, FH] = pair(opt('frame', '80x88'), 'x');
const [fitH, fitW] = pair(opt('fit', '78x72'), 'x'), [footX, footY] = pair(opt('foot', '40,84'), ',');
if (!input || !prefix) { console.error('Usage: gif-frames.mjs <in.gif> --out=<dir/prefix>'); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gif-frames-'));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', input, '-fps_mode', 'passthrough', '-pix_fmt', 'rgba', path.join(tmp, 'f-%03d.png')]);
const sources = fs.readdirSync(tmp).sort().map(file => decodePng(path.join(tmp, file)));
fs.rmSync(tmp, { recursive: true, force: true });
if (!sources.length) { console.error('No frames decoded'); process.exit(1); }

const usePalette = !args.includes('--no-palette');
const palette = JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.filter(c => !c.ramp.startsWith('team-'))
  .map(c => [1, 3, 5].map(i => parseInt(c.hex.slice(i, i + 2), 16)));
const labs = palette.map(c => oklab(...c)), cache = new Map();
const snap = (r, g, b) => {
  const key = r * 65536 + g * 256 + b;
  if (!cache.has(key)) {
    const lab = oklab(r, g, b); let best = 0, distance = Infinity;
    labs.forEach((p, i) => { const d = p.reduce((n, v, k) => n + (v - lab[k]) ** 2, 0); if (d < distance) { distance = d; best = i; } });
    cache.set(key, palette[best]);
  }
  return cache.get(key);
};

// Largest 8-connected opaque island per frame; stray specks from the split are dropped.
const people = sources.map(({ width, height, pixels }) => {
  const seen = new Uint8Array(width * height); let person = [];
  for (let n = 0; n < seen.length; n++) {
    if (seen[n] || pixels[n * 4 + 3] < 128) continue;
    const island = [n]; seen[n] = 1;
    for (let k = 0; k < island.length; k++) {
      const x = island[k] % width, y = Math.floor(island[k] / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, v = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[v] || pixels[v * 4 + 3] < 128) continue;
        seen[v] = 1; island.push(v);
      }
    }
    if (island.length > person.length) person = island;
  }
  return person;
});
const { width, height } = sources[0];
// GIF alpha is on/off, so the soft edge Codex painted survives as a pale rim outside the dark
// outline. Peel it: an edge pixel that is not outline-dark but touches the outline is rim.
// Real fill never sits outside its own outline, so nothing painted is lost.
let peeled = 0;
if (!args.includes('--keep-fringe')) people.forEach((person, index) => {
  const source = sources[index].pixels, inside = new Uint8Array(width * height);
  for (const p of person) inside[p] = 1;
  const luma = p => source[p * 4] * .299 + source[p * 4 + 1] * .587 + source[p * 4 + 2] * .114;
  const around = p => { const x = p % width, y = Math.floor(p / width); return [x ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y ? p - width : -1, y < height - 1 ? p + width : -1]; };
  for (let pass = 0; pass < 4; pass++) {
    const rim = [];
    for (let p = 0; p < inside.length; p++) {
      if (!inside[p] || luma(p) < 96) continue;
      const near = around(p);
      if (near.some(v => v < 0 || !inside[v]) && near.some(v => v >= 0 && inside[v] && luma(v) < 72)) rim.push(p);
    }
    if (!rim.length) break;
    for (const p of rim) inside[p] = 0;
    peeled += rim.length;
  }
  people[index] = person.filter(p => inside[p]);
});
let l = width, t = height, r = 0, b = 0;
for (const person of people) for (const p of person) { const x = p % width, y = Math.floor(p / width); l = Math.min(l, x); r = Math.max(r, x + 1); t = Math.min(t, y); b = Math.max(b, y + 1); }
const uw = r - l, uh = b - t, scale = Math.min(fitH / uh, fitW / uw), w = Math.round(uw * scale), h = Math.round(uh * scale);
const dx = Math.max(0, Math.min(FW - w, footX - Math.round(w / 2))), dy = Math.max(0, Math.min(FH - h, footY - h));

const strip = { width: FW * sources.length, height: FH, pixels: new Uint8ClampedArray(FW * sources.length * FH * 4) }, colours = new Set();
people.forEach((person, index) => {
  const crop = new Uint8ClampedArray(uw * uh * 4), source = sources[index].pixels;
  for (const p of person) { const x = p % width, y = Math.floor(p / width); crop.set(source.subarray(p * 4, p * 4 + 4), ((y - t) * uw + x - l) * 4); }
  const frame = resampleRgba(crop, uw, uh, w, h);
  for (let n = 0; n < frame.length; n += 4) {
    if (frame[n + 3] < 128) { frame.fill(0, n, n + 4); continue; }
    frame[n + 3] = 255;
    if (usePalette) frame.set(snap(frame[n], frame[n + 1], frame[n + 2]), n);
    colours.add(frame[n] * 65536 + frame[n + 1] * 256 + frame[n + 2]);
  }
  for (let y = 0; y < h; y++) strip.pixels.set(frame.subarray(y * w * 4, (y + 1) * w * 4), ((y + dy) * strip.width + index * FW + dx) * 4);
});
fs.mkdirSync(path.dirname(prefix), { recursive: true });
encodePng(`${prefix}-strip.png`, strip);
const report = { gif: input, frames: sources.length, sourceFrame: [width, height], sourceFigure: [uw, uh], frame: [FW, FH], figure: [w, h], scale: +scale.toFixed(4), colours: colours.size, rimPixelsPeeled: peeled };
fs.writeFileSync(`${prefix}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`${prefix}-strip.png  ${report.frames} frames, figure ${uw}x${uh} -> ${w}x${h} (scale ${report.scale}), ${report.colours} colours, ${peeled} rim px peeled`);
