#!/usr/bin/env node
// Turn one customer's generated kit sheet into game frames on the café art grid.
//
//   node scripts/art-gen/kit-frames.mjs <kit dir> --out=<dir> [--no-palette]
//
// Reads <kit dir>/sheet.png: 4 rows by 7 columns (front, back, right profile: standing then a
// six-frame walk; seated on the chair: at the table, petting twice, four coffee frames).
// One scale for the whole character, taken from the walking rows, so sitting down does not
// change the head size (unless the seated figure would not fit its frame). Writes:
//   walk.png    3 rows x 7 frames of 80x88, feet on y=84, head centred on x=40
//   seated.png  7 frames of 80x88, chair legs on y=84, chair's rear leg on x=18
//   frames.json placement, anchors and any warnings
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from '../pixel-conform.mjs';
import { resampleRgba } from '../../src/render/pixel-resample.ts';
import { FW, FH, blank, sliceSheet, guestPalette } from './lib.mjs';

const COLS = 7, FOOT_Y = 84, CENTRE_X = 40, CHAIR_LEG_X = 18, STANDING = 78, MAX_WIDTH = 72, SEATED_MAX = 82;
const NAMES = ['front', 'back', 'right'];
const opaque = (frame, w, x, y) => frame[(y * w + x) * 4 + 3] > 0;
const binaryAlpha = frame => { for (let n = 3; n < frame.length; n += 4) { if (frame[n] < 128) frame.fill(0, n - 3, n + 1); else frame[n] = 255; } return frame; };

/** Build { walk, seated, report } from <kit>/sheet.png. Throws when a figure is missing. */
export function kitFrames(kit, { palette = true } = {}) {
  const snap = palette ? guestPalette() : binaryAlpha, warnings = [];
  const figures = sliceSheet(decodePng(path.join(kit, 'sheet.png')), COLS, 4);
  const missing = figures.flatMap((row, r) => row.map((f, c) => f ? null : `row ${r + 1} column ${c + 1}`)).filter(Boolean);
  if (missing.length) throw Error(`${kit}: no figure in ${missing.join(', ')}`);
  const walking = figures.slice(0, 3).flat();
  const scale = Math.min(STANDING / Math.max(...walking.map(f => f.height)), MAX_WIDTH / Math.max(...walking.map(f => f.width)));

  // A tall hairdo can make the seated unit taller than the frame allows: only then is the
  // seated row drawn slightly smaller than the walking rows.
  const seatedScale = Math.min(scale, SEATED_MAX / Math.max(...figures[3].map(f => f.height)));
  function render(figure, by = scale) {
    const w = Math.max(1, Math.round(figure.width * by)), h = Math.max(1, Math.round(figure.height * by));
    return { w, h, pixels: snap(resampleRgba(figure.pixels, figure.width, figure.height, w, h)) };
  }
  /** Centre of the head: the opaque span of the top 40% of the figure. */
  function headCentre({ w, h, pixels }) {
    let l = w, r = 0;
    for (let y = 0; y < Math.round(h * .4); y++) for (let x = 0; x < w; x++) if (opaque(pixels, w, x, y)) { l = Math.min(l, x); r = Math.max(r, x + 1); }
    return (l + r) / 2;
  }
  /** Where the head ends: the narrowest row between 35% and 62% of a standing figure. */
  function headHeight({ w, h, pixels }) {
    let best = Math.round(h * .47), narrow = Infinity;
    for (let y = Math.round(h * .35); y < Math.round(h * .62); y++) {
      let l = w, r = -1; for (let x = 0; x < w; x++) if (opaque(pixels, w, x, y)) { l = Math.min(l, x); r = x; }
      if (r - l < narrow) { narrow = r - l; best = y; }
    }
    return best;
  }
  /** The outer palm of a seated figure: two pixels in from the rightmost arm pixel. */
  function palm({ w, h, pixels }, pet) {
    const top = Math.floor(h * (pet ? .60 : .42)), bottom = Math.floor(h * (pet ? .92 : .70)); let right = 0;
    for (let y = top; y <= bottom; y++) for (let x = Math.floor(w * .55); x < w; x++) if (opaque(pixels, w, x, y)) right = Math.max(right, x);
    const x = Math.max(0, right - 2), rows = [];
    for (let y = top; y <= bottom; y++) if (opaque(pixels, w, x, y)) rows.push(y);
    return rows.length ? [x, rows[Math.floor(rows.length / 2)]] : null;
  }
  function place(atlas, frame, column, row, x, y, label) {
    if (x < 1 || y < 1 || x + frame.w > FW - 1 || y + frame.h > FH - 1) {
      warnings.push(`${label}: ${frame.w}x${frame.h} at ${x},${y} touches the frame edge`);
      x = Math.max(1, Math.min(FW - 1 - frame.w, x)); y = Math.max(1, Math.min(FH - 1 - frame.h, y));
    }
    for (let dy = 0; dy < frame.h; dy++) for (let dx = 0; dx < frame.w; dx++) {
      const tx = x + dx, ty = y + dy;   // an oversized figure is clipped to its own cell, never spilled into the next
      if (tx < 0 || ty < 0 || tx >= FW || ty >= FH || !frame.pixels[(dy * frame.w + dx) * 4 + 3]) continue;
      atlas.pixels.set(frame.pixels.subarray((dy * frame.w + dx) * 4, (dy * frame.w + dx) * 4 + 4), ((row * FH + ty) * atlas.width + column * FW + tx) * 4);
    }
    return { x, y, w: frame.w, h: frame.h };
  }

  const walk = blank(FW * COLS, FH * 3), seated = blank(FW * COLS, FH), report = { kit, scale: +scale.toFixed(4), seatedScale: +seatedScale.toFixed(4), walk: [], seated: [], warnings };
  let neckDrop = 0;
  for (let row = 0; row < 3; row++) {
    const frames = figures[row].map(figure => render(figure));
    // The front view shows the chin line cleanly; in profile a ponytail or bun widens those rows.
    if (row === 0) neckDrop = Math.round(headHeight(frames[0]) * seatedScale / scale);
    report.walk.push(frames.map((frame, column) => {
      const box = place(walk, frame, column, row, Math.round(CENTRE_X - headCentre(frame)), FOOT_Y - frame.h, `${NAMES[row]} ${column}`);
      const profile = row === 2;
      return { ...box, top: box.y, neck: [Math.round(box.x + box.w * (profile ? .56 : .5)), box.y + headHeight(frame)],
        foot: [CENTRE_X, FOOT_Y], hip: [CENTRE_X, 64], hand: [Math.round(box.x + box.w * (profile ? .94 : .86)), Math.round(box.y + box.h * .72)] };
    }));
  }
  {
    const frames = figures[3].map(figure => render(figure, seatedScale));
    // The chair is the same in every frame; its rear leg is the leftmost pixel near the floor.
    const legX = frame => { for (let x = 0; x < frame.w; x++) for (let y = frame.h - 8; y < frame.h; y++) if (opaque(frame.pixels, frame.w, x, y)) return x; return 0; };
    report.seated = frames.map((frame, column) => {
      const box = place(seated, frame, column, 0, CHAIR_LEG_X - legX(frame), FOOT_Y - frame.h, `seated ${column}`);
      const pet = column === 1 || column === 2, hand = palm(frame, pet);
      if (!hand) warnings.push(`seated ${column}: no palm found`);
      return { ...box, top: box.y, neck: [Math.round(box.x + box.w * .55), box.y + neckDrop], foot: [36, FOOT_Y], hip: [36, 64],
        hand: hand ? [box.x + hand[0], box.y + hand[1]] : [box.x + box.w - 3, box.y + Math.round(box.h * .6)] };
    });
  }
  // Same-row frames are the same person: flag a frame whose height wanders (a crouch or a rescale).
  for (const [row, frames] of report.walk.entries()) {
    const heights = frames.map(f => f.h), idle = heights[0];
    heights.forEach((h, column) => { if (Math.abs(h - idle) > 4) warnings.push(`${NAMES[row]} ${column}: ${h}px tall against ${idle}px standing`); });
  }
  return { walk, seated, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2), [kit] = args.filter(a => !a.startsWith('--'));
  const out = args.find(a => a.startsWith('--out='))?.slice(6);
  if (!kit || !out) { console.error('Usage: kit-frames.mjs <kit dir> --out=<dir> [--no-palette]'); process.exit(2); }
  const { walk, seated, report } = kitFrames(kit, { palette: !args.includes('--no-palette') }), { warnings } = report;
  fs.mkdirSync(out, { recursive: true });
  encodePng(path.join(out, 'walk.png'), walk); encodePng(path.join(out, 'seated.png'), seated);
  fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(`${out}: scale ${report.scale}, standing ${report.walk[0][0].h}px, seated unit ${report.seated[0].w}x${report.seated[0].h}, palm ${report.seated[0].hand}${warnings.length ? `, ${warnings.length} warning(s): ${warnings.join('; ')}` : ''}`);
}
