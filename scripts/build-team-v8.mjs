// Builds public/art/generated/cozy-team-v8 from the Codex image_gen sheets in
// assets/generated/cozy-team-v8: packs each sheet at half size in a palette (a pose is still
// over twice its final size, and each sheet drops from about 1.2 MB to about 110 KB), finds
// every pose's bounds from its transparent gaps (falling back to the even grid), adds the
// seated anchors the v7 sheets use, and writes one manifest listing the v7 families (by
// relative path) and the new ones in TEAM_HAIRSTYLES order.
import fs from 'node:fs/promises';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

const SRC = 'assets/generated/cozy-team-v8', OUT = 'public/art/generated/cozy-team-v8', V7 = 'public/art/generated/cozy-team-v7';
const NEW_STYLES = ['crop', 'curls', 'undercut', 'slick', 'beard', 'buzz', 'pixie', 'buns', 'afro', 'bangs', 'twintails', 'curtain',
  // Second batch.
  'fauxhawk', 'manbun', 'shaggy', 'centerpart', 'mustache', 'locs', 'halfup', 'sidebraid', 'braidcrown', 'curlybob', 'asymbob', 'ringlets'];
const SEATED = ['seated-c.png', 'seated-d.png', 'seated-e.png', 'seated-f.png', 'seated-g.png', 'seated-h.png'];
/** The game drops alpha below this when decoding, so bounds follow the same pixels. */
const SOLID = 100;
const PACK_SCALE = 0.5;
/** Where a seated figure's shoes end above its bounds, as on the full-size v7 sheets (4 px). */
const FLOOR_MARGIN = 4 * PACK_SCALE;

async function pack(file) {
  const { width, height } = await sharp(`${SRC}/${file}`).metadata();
  await sharp(`${SRC}/${file}`).ensureAlpha()
    .resize(Math.round(width * PACK_SCALE), Math.round(height * PACK_SCALE), { kernel: 'cubic' })
    .png({ palette: true, colours: 256, dither: 0, effort: 10, compressionLevel: 9 })
    .toFile(`${OUT}/${file}`);
}
/** Seated anchors as shares of each pose's bounds, exactly as in the v7 manifest (by column). */
const SEAT_ANCHORS = [
  { hip: [0.4, 0.74], neck: [0.55, 0.44], hand: [0.7, 0.64] },
  { hip: [0.4, 0.74], neck: [0.55, 0.44], hand: [0.9, 0.7] },
  { hip: [0.4, 0.74], neck: [0.55, 0.44], hand: [0.78, 0.77] },
];

async function pixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { solid: (x, y) => data[(y * info.width + x) * info.channels + 3] >= SOLID, width: info.width, height: info.height };
}

/** Runs of lines that hold any solid pixel, merged down to `count` by closing the narrowest gaps. */
function runs(length, filled, count) {
  const found = [];
  for (let i = 0; i < length;) {
    if (!filled(i)) { i++; continue; }
    const start = i;
    while (i < length && filled(i)) i++;
    if (i - start >= 8) found.push([start, i]);
  }
  while (found.length > count) {
    let best = 0;
    for (let i = 1; i < found.length - 1; i++) if (found[i + 1][0] - found[i][1] < found[best + 1][0] - found[best][1]) best = i;
    found.splice(best, 2, [found[best][0], found[best + 1][1]]);
  }
  return found.length === count ? found : null;
}

/** Bounds [x, y, right, bottom] of each pose on a rows × cols sheet, row by row. */
async function poseBounds(file, rows, cols) {
  const { solid, width, height } = await pixels(file);
  const box = (x0, x1, y0, y1) => {
    let l = x1, r = x0, t = y1, b = y0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (solid(x, y)) { l = Math.min(l, x); r = Math.max(r, x + 1); t = Math.min(t, y); b = Math.max(b, y + 1); }
    if (r <= l) throw new Error(`${file}: empty cell at ${x0},${y0}`);
    return [l, t, r, b];
  };
  const bounds = [];
  const rowBands = runs(height, (y) => { for (let x = 0; x < width; x++) if (solid(x, y)) return true; return false; }, rows)
    ?? Array.from({ length: rows }, (_, i) => [Math.round(i * height / rows), Math.round((i + 1) * height / rows)]);
  for (const [top, bottom] of rowBands) {
    const columns = runs(width, (x) => { for (let y = top; y < bottom; y++) if (solid(x, y)) return true; return false; }, cols)
      ?? Array.from({ length: cols }, (_, i) => [Math.round(i * width / cols), Math.round((i + 1) * width / cols)]);
    for (const [left, right] of columns) bounds.push(box(left, right, top, bottom));
  }
  return bounds;
}

const v7 = JSON.parse(await fs.readFile(`${V7}/manifest.json`, 'utf8'));
const fromV7 = (sheet) => ({ ...sheet, file: `../cozy-team-v7/${sheet.file}` });
await fs.mkdir(OUT, { recursive: true });

const families = v7.families.map(fromV7);
for (const [i, style] of NEW_STYLES.entries()) {
  const file = `hair-${8 + i}-${style}-v1.png`;
  await pack(file);
  families.push({ file, bounds: await poseBounds(`${OUT}/${file}`, 3, 3) });
}
const seated = v7.seated.map(fromV7);
for (const file of SEATED) {
  await pack(file);
  const bounds = await poseBounds(`${OUT}/${file}`, 4, 3);
  const anchors = bounds.map(([x, y, r, b], i) => {
    const w = r - x, h = b - y, a = SEAT_ANCHORS[i % 3], at = ([sx, sy]) => ({ x: +(w * sx).toFixed(2), y: +(h * sy).toFixed(2) });
    return { floor: { x: +(w * 0.4).toFixed(2), y: h - FLOOR_MARGIN }, hip: at(a.hip), neck: at(a.neck), hand: at(a.hand) };
  });
  seated.push({ file, bounds, anchors });
}
const manifest = { families, chef: fromV7(v7.chef), seated, chefSeated: fromV7(v7.chefSeated) };
await fs.writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest) + '\n');
console.log(`${OUT}/manifest.json: ${families.length} families, ${seated.length} seated sheets`);
