#!/usr/bin/env node
// Packs the character strips of assets/generated/floor-sample-v1/build for the browser: each PNG
// strip cut by soft-frames.mjs gets a WebP copy (soft edges and all, a fraction of the size), and
// sheets.json lists every strip's frame size, so a page fetches one index instead of one file per sheet.
import fs from 'node:fs';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';
import { librarySource } from '../art-files.mjs';

const BUILD = 'assets/generated/floor-sample-v1/build';
const index = {};
let before = 0, after = 0;
for (const name of fs.readdirSync(BUILD).filter(f => f.endsWith('.json') && f !== 'sheets.json' && f !== 'floors.json').sort()) {
  const key = name.slice(0, -5), meta = JSON.parse(fs.readFileSync(`${BUILD}/${name}`, 'utf8'));
  // The PNG strips are kept in the art library (assets/ART-LIBRARY.md); a fresh one here wins.
  const png = librarySource(`${BUILD}/${key}.png`), webp = `${BUILD}/${key}.webp`;
  if (!meta.frameWidth || !fs.existsSync(png)) continue;
  if (!fs.existsSync(webp) || fs.statSync(webp).mtimeMs < fs.statSync(png).mtimeMs) {
    await sharp(png).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(webp);
  }
  before += fs.statSync(png).size; after += fs.statSync(webp).size;
  index[key] = { frameWidth: meta.frameWidth, frameHeight: meta.frameHeight, frames: meta.frames };
}
fs.writeFileSync(`${BUILD}/sheets.json`, JSON.stringify(index, null, 0).replace(/\},"/g, '},\n"') + '\n');
console.log(`${Object.keys(index).length} sheets, ${(before / 1048576).toFixed(1)} MB PNG -> ${(after / 1048576).toFixed(1)} MB WebP`);
