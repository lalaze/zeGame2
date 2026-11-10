// Small raster helpers shared by the art-gen review builders. Images are { width, height, pixels }
// with RGBA bytes, the shape scripts/pixel-conform.mjs decodes and encodes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { decodePng, encodePng, oklab } from '../pixel-conform.mjs';

export const FW = 80, FH = 88;   // one character frame, in art pixels (40x44 room pixels)
export const blank = (width, height) => ({ width, height, pixels: new Uint8ClampedArray(width * height * 4) });
/** Copy opaque pixels; `mirror` flips the copied rectangle left to right. */
export function blit(target, source, sx, sy, w, h, dx, dy, mirror = false) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((sy + y) * source.width + sx + (mirror ? w - 1 - x : x)) * 4, tx = dx + x, ty = dy + y;
    if (source.pixels[s + 3] < 128 || tx < 0 || ty < 0 || tx >= target.width || ty >= target.height) continue;
    target.pixels.set(source.pixels.subarray(s, s + 4), (ty * target.width + tx) * 4);
  }
}
export function scaled(image, factor) {
  const result = blank(image.width * factor, image.height * factor);
  for (let y = 0; y < result.height; y++) for (let x = 0; x < result.width; x++) {
    const s = (Math.floor(y / factor) * image.width + Math.floor(x / factor)) * 4;
    result.pixels.set(image.pixels.subarray(s, s + 4), (y * result.width + x) * 4);
  }
  return result;
}
/** The main room at art density. The fixture screenshot is 4 device px per room px; art is 2. */
export function roomArt() {
  const shot = decodePng('artifacts/art-grid/review-3b/day/main-full.png'), room = blank(shot.width / 2, shot.height / 2);
  for (let y = 0; y < room.height; y++) for (let x = 0; x < room.width; x++)
    room.pixels.set(shot.pixels.subarray((y * 2 * shot.width + x * 2) * 4, (y * 2 * shot.width + x * 2) * 4 + 4), (y * room.width + x) * 4);
  return room;
}
/** Shipped PNG master of a customer's walking sheet (12 frames) or seated sheet (3 frames). */
export const castMaster = id => decodePng(`assets/art-masters/art/generated/cozy-cast-v${id >= 30 ? 8 : 7}/customer-${id}.png`);
export const diningMaster = id => decodePng(`assets/art-masters/art/generated/cozy-dining-v${id >= 30 ? 4 : 3}/customer-${id}.png`);
/** Encode frames as a looping GIF without dithering, so pixel art stays exact. */
export function writeGif(file, frames, tickMs) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'art-gen-frames-'));
  frames.forEach((frame, index) => encodePng(path.join(tmp, `t-${String(index).padStart(3, '0')}.png`), frame));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', `1000/${tickMs}`, '-i', path.join(tmp, 't-%03d.png'),
    '-filter_complex', 'split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=none', '-loop', '0', file]);
  fs.rmSync(tmp, { recursive: true, force: true });
}

/**
 * The alpha level that separates figures from backdrop. "Transparent" generations are not
 * always clear: some come back on a veil at alpha 130-190 with the figures at 240+. Otsu's
 * threshold on the alpha histogram finds the gap either way (about 128 for a truly clear one).
 */
export function alphaCut(pixels) {
  const histogram = new Float64Array(256); let total = 0, sum = 0;
  for (let n = 3; n < pixels.length; n += 4) { histogram[pixels[n]]++; total++; sum += pixels[n]; }
  let below = 0, belowSum = 0, best = 128, spread = -1;
  for (let level = 0; level < 255; level++) {
    below += histogram[level]; belowSum += level * histogram[level];
    if (!below || below === total) continue;
    const gap = belowSum / below - (sum - belowSum) / (total - below), between = below * (total - below) * gap * gap;
    if (between > spread) { spread = between; best = level + 1; }
  }
  // Figures sit in a tight band near full opacity. Cutting just under that band also removes
  // the pale rim a veiled backdrop leaves around the outline.
  const figure = []; let count = 0;
  for (let level = best; level < 256; level++) count += histogram[level];
  let seen = 0, typical = 255;
  for (let level = best; level < 256; level++) { seen += histogram[level]; if (seen >= count * .4) { typical = level; break; } }
  return Math.max(48, Math.min(248, Math.max(best, typical - 14)));
}

/**
 * Cut a generated sheet into its figures. Generated cells are never an exact grid, so rows and
 * columns are split at the emptiest line near each expected boundary, and each cell keeps its
 * substantial 8-connected opaque shapes (stray specks and a neighbour's shoe tip are dropped).
 * Returns figures[row][col] = { width, height, pixels, box } or null where a cell is empty.
 * `counts[row]` says a row holds fewer figures than `cols`; they are then found by their gaps.
 */
export function sliceSheet(sheet, cols, rows, { counts } = {}) {
  const { width, height, pixels } = sheet, cut = alphaCut(pixels);
  // Make the cut final here, so every later step sees plain on/off transparency.
  for (let n = 3; n < pixels.length; n += 4) pixels[n] = pixels[n] >= cut ? 255 : 0;
  const solid = n => pixels[n * 4 + 3] >= 128;
  const seams = (histogram, parts) => {
    const edges = [0];
    for (let n = 1; n < parts; n++) {
      const start = Math.round(histogram.length * (n - .3) / parts), end = Math.round(histogram.length * (n + .3) / parts);
      // Middle of the longest emptiest run, so a cut never grazes a figure.
      let min = Infinity; for (let i = start; i < end; i++) min = Math.min(min, histogram[i]);
      let best = [start, start], run = null;
      for (let i = start; i <= end; i++) {
        if (i < end && histogram[i] === min) run = run ? [run[0], i] : [i, i];
        else if (run) { if (run[1] - run[0] > best[1] - best[0]) best = run; run = null; }
      }
      edges.push(Math.round((best[0] + best[1]) / 2));
    }
    return [...edges, histogram.length];
  };
  const rowHistogram = new Uint32Array(height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (solid(y * width + x)) rowHistogram[y]++;
  const ys = seams(rowHistogram, rows);
  const figure = (x0, x1, y0, y1) => {
    const w = x1 - x0, h = y1 - y0, seen = new Uint8Array(w * h), at = (x, y) => (y + y0) * width + x + x0, islands = [];
    for (let n = 0; n < seen.length; n++) {
      if (seen[n] || !solid(at(n % w, Math.floor(n / w)))) continue;
      const island = [n]; seen[n] = 1;
      for (let k = 0; k < island.length; k++) {
        const x = island[k] % w, y = Math.floor(island[k] / w);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, v = ny * w + nx;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[v] || !solid(at(nx, ny))) continue;
          seen[v] = 1; island.push(v);
        }
      }
      islands.push(island);
    }
    // A hairline gap in the outline can leave the head and body as two shapes: keep every
    // shape that is a real part of the figure, drop specks and a neighbour's stray shoe tip.
    const largest = Math.max(0, ...islands.map(island => island.length));
    if (largest < 300) return null;
    const person = islands.filter(island => island.length >= largest * .06).flat();
    let l = w, t = h, r = 0, b = 0;
    for (const p of person) { const x = p % w, y = Math.floor(p / w); l = Math.min(l, x); r = Math.max(r, x + 1); t = Math.min(t, y); b = Math.max(b, y + 1); }
    const clean = new Uint8ClampedArray((r - l) * (b - t) * 4);
    for (const p of person) { const x = p % w, y = Math.floor(p / w), source = at(x, y) * 4; clean.set(pixels.subarray(source, source + 4), ((y - t) * (r - l) + x - l) * 4); }
    return { width: r - l, height: b - t, pixels: clean, box: [x0 + l, y0 + t, x0 + r, y0 + b] };
  };
  return Array.from({ length: rows }, (_, row) => {
    const columnHistogram = new Uint32Array(width);
    for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = 0; x < width; x++) if (solid(y * width + x)) columnHistogram[x]++;
    const count = counts?.[row] ?? cols;
    if (count === cols) {
      const xs = seams(columnHistogram, cols);
      return Array.from({ length: cols }, (_, column) => figure(xs[column], xs[column + 1], ys[row], ys[row + 1]));
    }
    // A row with fewer figures than the grid has columns: wherever the painter put them, they
    // are the `count` widest runs of occupied columns (narrow gaps inside a figure are closed).
    const found = [];
    for (let x = 0; x < width;) {
      if (!columnHistogram[x]) { x++; continue; }
      const start = x; while (x < width && columnHistogram[x]) x++;
      if (x - start >= 6) found.push([start, x]);
    }
    while (found.length > count) {
      let best = 0;
      for (let i = 1; i < found.length - 1; i++) if (found[i + 1][0] - found[i][1] < found[best + 1][0] - found[best][1]) best = i;
      found.splice(best, 2, [found[best][0], found[best + 1][1]]);
    }
    return Array.from({ length: count }, (_, column) => found[column] ? figure(Math.max(0, found[column][0] - 2), Math.min(width, found[column][1] + 2), ys[row], ys[row + 1]) : null);
  });
}

/** Snap opaque pixels to the guest palette (master palette without the staff-only midtones). */
export function guestPalette() {
  const palette = JSON.parse(fs.readFileSync('docs/art-grid/palette.json')).colors.filter(c => !c.ramp.startsWith('team-'))
    .map(c => [1, 3, 5].map(i => parseInt(c.hex.slice(i, i + 2), 16)));
  const labs = palette.map(c => oklab(...c)), cache = new Map();
  return frame => {
    for (let n = 0; n < frame.length; n += 4) {
      if (frame[n + 3] < 128) { frame.fill(0, n, n + 4); continue; }
      frame[n + 3] = 255;
      const key = frame[n] * 65536 + frame[n + 1] * 256 + frame[n + 2];
      if (!cache.has(key)) {
        const lab = oklab(frame[n], frame[n + 1], frame[n + 2]); let best = 0, distance = Infinity;
        labs.forEach((p, i) => { const d = p.reduce((sum, v, k) => sum + (v - lab[k]) ** 2, 0); if (d < distance) { distance = d; best = i; } });
        cache.set(key, palette[best]);
      }
      frame.set(cache.get(key), n);
    }
    return frame;
  };
}

/**
 * Cut a generated sheet into its figures without assuming clear gutters between rows.
 * Tightly packed sheets interleave: one row's shoes reach below the next row's hair tips, so no
 * horizontal line is empty and a gutter search cuts figures at the waist. Here every 8-connected
 * shape is found first, shapes are grouped into rows by how their vertical spans overlap and into
 * figures by how their horizontal spans overlap (a head and body split by a hairline gap rejoin).
 * `counts` lists the figures expected in each row, top to bottom; a mismatch throws, which is
 * the signal to take the sheet again. Returns figures[row][col] = { width, height, pixels, box }.
 */
export function sheetFigures(sheet, counts) {
  const { width, height, pixels } = sheet, cut = alphaCut(pixels);
  for (let n = 3; n < pixels.length; n += 4) pixels[n] = pixels[n] >= cut ? 255 : 0;
  const label = new Int32Array(width * height).fill(-1), shapes = [];
  for (let n = 0; n < label.length; n++) {
    if (label[n] >= 0 || !pixels[n * 4 + 3]) continue;
    const id = shapes.length, members = [n]; label[n] = id;
    let l = width, t = height, r = 0, b = 0;
    for (let k = 0; k < members.length; k++) {
      const p = members[k], x = p % width, y = (p - x) / width;
      l = Math.min(l, x); r = Math.max(r, x + 1); t = Math.min(t, y); b = Math.max(b, y + 1);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, v = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || label[v] >= 0 || !pixels[v * 4 + 3]) continue;
        label[v] = id; members.push(v);
      }
    }
    shapes.push({ members, l, t, r, b });
  }
  const expected = counts.reduce((a, b) => a + b, 0), sizes = shapes.map(s => s.members.length).sort((a, b) => b - a);
  const typical = sizes[Math.min(sizes.length - 1, Math.floor(expected / 2))] ?? 0, big = shapes.filter(s => s.members.length >= typical * .12);
  const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) / Math.max(1, Math.min(a1 - a0, b1 - b0));
  const rows = [];
  for (const shape of [...big].sort((a, b) => a.t - b.t)) {
    const row = rows.find(row => overlap(row.t, row.b, shape.t, shape.b) >= .5);
    if (row) { row.shapes.push(shape); row.t = Math.min(row.t, shape.t); row.b = Math.max(row.b, shape.b); } else rows.push({ t: shape.t, b: shape.b, shapes: [shape] });
  }
  if (rows.length !== counts.length) throw Error(`found ${rows.length} rows of figures, expected ${counts.length}`);
  return rows.map((row, r) => {
    const groups = [];
    for (const shape of row.shapes.sort((a, b) => a.l - b.l)) {
      const group = groups.find(g => overlap(g.l, g.r, shape.l, shape.r) >= .4);
      if (group) { group.shapes.push(shape); group.l = Math.min(group.l, shape.l); group.r = Math.max(group.r, shape.r); group.t = Math.min(group.t, shape.t); group.b = Math.max(group.b, shape.b); }
      else groups.push({ l: shape.l, r: shape.r, t: shape.t, b: shape.b, shapes: [shape] });
    }
    if (groups.length !== counts[r]) throw Error(`row ${r + 1} has ${groups.length} figures, expected ${counts[r]}`);
    return groups.map(g => {
      const w = g.r - g.l, h = g.b - g.t, out = new Uint8ClampedArray(w * h * 4);
      for (const shape of g.shapes) for (const p of shape.members) { const x = p % width, y = (p - x) / width; out.set(pixels.subarray(p * 4, p * 4 + 4), ((y - g.t) * w + x - g.l) * 4); }
      return { width: w, height: h, pixels: out, box: [g.l, g.t, g.r, g.b] };
    });
  });
}
