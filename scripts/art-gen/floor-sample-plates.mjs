#!/usr/bin/env node
// Cut the empty high-angle plates of assets/generated/floor-sample-v1 into the floors the floors view stacks (src/render/floors).
// Every plate shows one floor with its ceiling slab at the top and its floor slab at the bottom;
// cutting through the middle of both lets any floors stack without a doubled slab. The cuts match
// the slabs found in kits/angle-plate-*/take-N/plate.png. Also writes the layer drawn in front of
// people, the size of its whole plate: counter-front.webp (the ground floor's counter, cake display
// and what stands on the counter, in front of the staff). The basement and its table are put together
// from build/upgrades (floor-upgrades-build.py).
import fs from 'node:fs';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';
import { librarySource } from '../art-files.mjs';

const P = 'assets/generated/floor-sample-v1', OUT = `${P}/build`;
// The takes live in the art library (assets/ART-LIBRARY.md).
const plate = (name, take = 1) => librarySource(`${P}/kits/angle-plate-${name}/take-${take}/plate.png`);
/** [plate, take, first row, end row] of each floor as the page stacks it. */
const FLOORS = { roof: ['roof', 1, 0, 905], 'floor-2': ['2f', 1, 24, 901], 'floor-1': ['1f', 1, 24, 907] };
/** Layers in front of people: [file, plate, take, rectangles in plate pixels [left, top, right, bottom]]. */
const FRONTS = [
  ['counter-front', '1f', 1, [[468, 354, 1082, 520], [1074, 300, 1339, 538], [572, 284, 680, 360], [925, 322, 990, 377]]],
];

fs.mkdirSync(OUT, { recursive: true });
const floors = {};
for (const [name, [source, take, top, bottom]] of Object.entries(FLOORS)) {
  const file = plate(source, take), { width, height } = await sharp(file).metadata();
  const end = Math.min(bottom, height);
  await sharp(file).extract({ left: 0, top, width, height: end - top }).webp({ quality: 88, effort: 6 }).toFile(`${OUT}/${name}.webp`);
  floors[name] = { width, height: end - top, top };
}
for (const [name, source, take, rects] of FRONTS) {
  const { data, info } = await sharp(plate(source, take)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (!rects.some(([l, t, r, b]) => x >= l && x < r && y >= t && y < b)) data.fill(0, (y * info.width + x) * 4, (y * info.width + x) * 4 + 4);
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(`${OUT}/${name}.webp`);
}
fs.writeFileSync(`${OUT}/floors.json`, JSON.stringify({ floors, fronts: FRONTS }, null, 2) + '\n');
console.log(floors);
