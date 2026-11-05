// Packs the image_gen sources in assets/generated/cozy-idle-v1 into production PNGs.
// Each source sheet holds objects side by side on transparency: split at fully empty
// columns, trim the transparent exterior, and shrink every object of a sheet by the same
// nearest-neighbor factor so they keep their relative sizes (no redraw, recolor or alpha
// cleanup). Crop boxes and scales are recorded in crop.json.
import fs from 'node:fs/promises';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

const root = 'assets/generated/cozy-idle-v1';
const out = 'public/art/generated/cozy-idle-v1';
const SHEETS = {
  'source-construction.png': ['build-sawhorse', 'build-ladder', 'build-sign'],
  'source-jar.png': ['till-jar-0', 'till-jar-1', 'till-jar-2'],
  'source-takeaway.png': ['order-takeaway'],
  'source-gifts.png': ['gift-leaf', 'gift-yarn', 'gift-feather', 'gift-ribbon', 'gift-acorn', 'gift-coin'],
  'source-shops.png': ['shop-town', 'shop-forest', 'shop-city', 'shop-seaside', 'shop-flowers'],
  'source-perks.png': ['perk-till', 'perk-kitchen', 'perk-builders', 'perk-catering', 'perk-manager', 'perk-cats'],
  'source-keepsakes.png': ['furniture-chain_map', 'furniture-chain_plaque'],
};
/** Alpha at or below this counts as empty when looking for the gaps between objects. */
const EMPTY = 8;
/** Narrower runs of content are stray specks, not objects. */
const MIN_OBJECT = 24;
/**
 * Sheets whose objects share one crop size. The till jar's states align on the jar's left
 * edge, so swapping states never moves or rescales the jar itself; storefronts and perk
 * icons are centred, so they line up as a set.
 */
const UNIFORM = { 'source-jar.png': 'left', 'source-shops.png': 'center', 'source-perks.png': 'center' };
/** Longest side of a sheet's largest object after packing, in line with the other cozy props. */
const MAX_SIDE = {
  'source-construction.png': 360, 'source-jar.png': 240, 'source-takeaway.png': 360, 'source-gifts.png': 160,
  'source-shops.png': 160, 'source-perks.png': 128, 'source-keepsakes.png': 256,
};

await fs.mkdir(out, { recursive: true });
const crops = {};
for (const [file, ids] of Object.entries(SHEETS)) {
  const { data, info } = await sharp(`${root}/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alpha = (x, y) => data[(y * width + x) * channels + 3];
  const filled = Array.from({ length: width }, (_, x) => { for (let y = 0; y < height; y++) if (alpha(x, y) > EMPTY) return true; return false; });
  const runs = [];
  for (let x = 0; x < width;) {
    if (!filled[x]) { x++; continue; }
    const start = x;
    while (x < width && filled[x]) x++;
    if (x - start >= MIN_OBJECT) runs.push([start, x]);
  }
  // Objects that touch (a ladder beside its buckets) stay together; merge the closest
  // runs until there is one run per expected object.
  while (runs.length > ids.length) {
    let best = 0;
    for (let i = 1; i < runs.length - 1; i++) if (runs[i + 1][0] - runs[i][1] < runs[best + 1][0] - runs[best][1]) best = i;
    runs.splice(best, 2, [runs[best][0], runs[best + 1][1]]);
  }
  if (runs.length !== ids.length) throw new Error(`${file}: found ${runs.length} objects, expected ${ids.length}`);
  const rows = runs.map(([left, right]) => {
    let top = height, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = left; x < right; x++) if (alpha(x, y) > EMPTY) { top = Math.min(top, y); bottom = Math.max(bottom, y + 1); break; }
    return [top, bottom];
  });
  const uniform = UNIFORM[file];
  const sharedWidth = Math.max(...runs.map(([l, r]) => r - l));
  const sharedTop = Math.min(...rows.map(([t]) => t)), sharedBottom = Math.max(...rows.map(([, b]) => b));
  const boxes = runs.map(([left, right], i) => {
    const [top, bottom] = uniform ? [sharedTop, sharedBottom] : rows[i];
    if (!uniform) return { left, top, width: right - left, height: bottom - top };
    const start = uniform === 'center' ? Math.max(0, Math.min(width - sharedWidth, Math.round((left + right - sharedWidth) / 2))) : left;
    return { left: start, top, width: Math.min(sharedWidth, width - start), height: bottom - top };
  });
  const scale = Math.min(1, MAX_SIDE[file] / Math.max(...boxes.flatMap((b) => [b.width, b.height])));
  for (const [i, box] of boxes.entries()) {
    const size = [Math.max(1, Math.round(box.width * scale)), Math.max(1, Math.round(box.height * scale))];
    await sharp(`${root}/${file}`).extract(box).resize(size[0], size[1], { kernel: 'nearest', fit: 'fill' }).png().toFile(`${out}/${ids[i]}.png`);
    crops[ids[i]] = { source: `${root}/${file}`, file: `${out}/${ids[i]}.png`, sourceBox: [box.left, box.top, box.width, box.height], scale, size };
  }
}
await fs.writeFile(`${root}/crop.json`, JSON.stringify({ generator: 'built-in image_gen (Codex)', processing: 'split at empty columns, trim transparent exterior, uniform nearest-neighbor resize per sheet; no redraw, recolor or alpha cleanup', crops }, null, 2) + '\n');
console.log(JSON.stringify(crops, null, 2));
