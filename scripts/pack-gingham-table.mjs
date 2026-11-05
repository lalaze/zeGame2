// Packs the gingham table (assets/generated/cozy-dining-table-v1, built-in image_gen) into a
// placeable furniture sprite: trims the transparent exterior and shrinks it with nearest-neighbor
// sampling to the 384 px longest side of the other cozy furniture. Nothing is redrawn.
// Run scripts/convert-art-gif.mjs afterwards to ship it as a GIF.
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';

const source = 'assets/generated/cozy-dining-table-v1/table.png';
const out = 'public/art/generated/cozy-furniture-v2/furniture-gingham_table.png';
/** Alpha at or below this counts as empty when trimming. */
const EMPTY = 8, LONGEST_SIDE = 384;

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let [left, top, right, bottom] = [info.width, info.height, -1, -1];
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * 4 + 3] <= EMPTY) continue;
  left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
}
const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
const scale = LONGEST_SIDE / Math.max(crop.width, crop.height);
const width = Math.round(crop.width * scale), height = Math.round(crop.height * scale);
await sharp(source).extract(crop).resize(width, height, { kernel: 'nearest', fit: 'fill' }).png().toFile(out);
console.log(JSON.stringify({ crop, size: [width, height] }));
