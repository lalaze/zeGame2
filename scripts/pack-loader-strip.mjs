// Packs the loading-screen walk cycle (assets/loading/source-walk.png, generated with
// Codex's built-in image_gen: two rows of four frames) into one strip for the loader.
// Frames are found by their transparent gaps, then placed so the head and torso stay at
// one x and the feet on one ground line: the walk reads in place, and any bob comes from
// the drawing itself. Nothing is redrawn; frames are only placed and resized together.
import fs from 'node:fs/promises';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

const source = 'assets/loading/source-walk.png';
const out = 'public/loading-carry-strip.png';
const ROWS = 2, PER_ROW = 4;
/** Each frame is shown in an 84 × 108 CSS box, packed at twice that. */
const [CELL_W, CELL_H] = [168, 216];
const EMPTY = 8, MIN_RUN = 12;

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const alpha = (x, y) => data[(y * width + x) * channels + 3];

/** Runs of non-empty lines along one axis, merged down to `count` by closing the smallest gaps. */
function runs(length, filled, count) {
  const found = [];
  for (let i = 0; i < length;) {
    if (!filled(i)) { i++; continue; }
    const start = i;
    while (i < length && filled(i)) i++;
    if (i - start >= MIN_RUN) found.push([start, i]);
  }
  while (found.length > count) {
    let best = 0;
    for (let i = 1; i < found.length - 1; i++) if (found[i + 1][0] - found[i][1] < found[best + 1][0] - found[best][1]) best = i;
    found.splice(best, 2, [found[best][0], found[best + 1][1]]);
  }
  if (found.length !== count) throw new Error(`expected ${count} runs, found ${found.length}`);
  return found;
}

const rowBands = runs(height, (y) => { for (let x = 0; x < width; x++) if (alpha(x, y) > EMPTY) return true; return false; }, ROWS);
const frames = [];
for (const [top, bottom] of rowBands) {
  const columns = runs(width, (x) => { for (let y = top; y < bottom; y++) if (alpha(x, y) > EMPTY) return true; return false; }, PER_ROW);
  for (const [left, right] of columns) {
    let fTop = bottom, fBottom = top;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (alpha(x, y) > EMPTY) { fTop = Math.min(fTop, y); fBottom = Math.max(fBottom, y + 1); break; }
    // Anchor on the head and torso: the opaque columns in the top 45% of the figure.
    let sum = 0, n = 0;
    const torsoBottom = fTop + Math.round((fBottom - fTop) * 0.45);
    for (let y = fTop; y < torsoBottom; y++) for (let x = left; x < right; x++) if (alpha(x, y) > EMPTY) { sum += x; n++; }
    frames.push({ left, right, top: fTop, bottom: fBottom, anchor: sum / n });
  }
}

// One cell size for all frames, in source pixels, at the loader's 84:108 aspect.
const half = Math.max(...frames.map((f) => Math.max(f.anchor - f.left, f.right - f.anchor)));
const tall = Math.max(...frames.map((f) => f.bottom - f.top));
let cellW = Math.ceil(half * 2 * 1.04), cellH = Math.ceil(tall * 1.03);
if (cellW / cellH > CELL_W / CELL_H) cellH = Math.ceil(cellW * CELL_H / CELL_W); else cellW = Math.ceil(cellH * CELL_W / CELL_H);
const scale = CELL_H / cellH;

const tiles = [];
for (const f of frames) {
  const cell = await sharp({ create: { width: cellW, height: cellH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{
      input: await sharp(source).extract({ left: f.left, top: f.top, width: f.right - f.left, height: f.bottom - f.top }).png().toBuffer(),
      left: Math.round(cellW / 2 - (f.anchor - f.left)), top: cellH - (f.bottom - f.top) - Math.round(cellH * 0.01),
    }]).png().toBuffer();
  tiles.push(await sharp(cell).resize(CELL_W, CELL_H, { kernel: 'lanczos3' }).png().toBuffer());
}
await sharp({ create: { width: CELL_W * frames.length, height: CELL_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles.map((input, i) => ({ input, left: i * CELL_W, top: 0 })))
  // A palette keeps the strip small; the pixel-art figure has few colours anyway.
  .png({ compressionLevel: 9, palette: true, quality: 95, dither: 0 })
  .toFile(out);
await fs.writeFile('assets/loading/walk-frames.json', JSON.stringify({ source, cell: [cellW, cellH], scale, frames }, null, 2) + '\n');
console.log(`${out}: ${frames.length} frames of ${CELL_W}×${CELL_H} (scale ${scale.toFixed(3)})`);
