import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve('public/art/generated/cozy-cats-v2');
const breeds = ['ginger', 'tuxedo', 'calico', 'tabby', 'black', 'white', 'british', 'american', 'siamese', 'ragdoll', 'persian', 'mainecoon'];
const states = ['idle', 'swish', 'blink', 'happy', 'walkA', 'walkB', 'sleep', 'groomA', 'groomB', 'stretch', 'watch', 'lookUp', 'nuzzleA', 'nuzzleB'];
const manifest = { version: 2, density: 4, width: 24, height: 18, foot: { x: 12, y: 17 }, breeds: [] };

for (const breed of breeds) {
  const file = breed + '.png', bytes = await fs.readFile(path.join(root, file));
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info, seen = new Uint8Array(width * height), components = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] <= 100) continue;
    const queue = [start]; seen[start] = 1;
    let left = width, right = 0, top = height, bottom = 0;
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i], x = n % width, y = Math.floor(n / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, at = yy * width + xx;
        if (xx >= 0 && xx < width && yy >= 0 && yy < height && !seen[at] && data[at * 4 + 3] > 100) {
          seen[at] = 1; queue.push(at);
        }
      }
    }
    if (queue.length > 4000) components.push({ left, top, right: right + 1, bottom: bottom + 1, pixels: queue.length });
  }
  if (components.length !== 14) throw Error(`${breed}: expected 14 independent silhouettes, got ${components.length}`);
  components.sort((a, b) => Math.floor((a.top + a.bottom) / 2 / (height / 4)) - Math.floor((b.top + b.bottom) / 2 / (height / 4)) || a.left - b.left);
  const frames = components.map((b, i) => {
    const w = b.right - b.left, h = b.bottom - b.top;
    const walking = i === 4 || i === 5, low = i === 6 || i === 9;
    const footX = b.left + w * (walking || low ? .5 : .66);
    const headX = b.left + w * (walking ? .23 : i === 6 ? .26 : i === 9 ? .25 : .76);
    // Longhair walking tails rise above the head; do not mistake their top
    // silhouette for the forehead when calibrating the interaction contact.
    const headY = b.top + h * (walking && ['ragdoll', 'persian'].includes(breed) ? .36 : i === 6 ? .36 : i === 9 ? .66 : i >= 11 ? .20 : .23);
    return { state: states[i], box: [Math.max(0, b.left - 3), Math.max(0, b.top - 3), Math.min(width, b.right + 3), Math.min(height, b.bottom + 3)],
      silhouette: [b.left, b.top, b.right, b.bottom], foot: { x: +footX.toFixed(2), y: b.bottom - 1 }, headContact: { x: +headX.toFixed(2), y: +headY.toFixed(2) } };
  });
  // Shared physical scale across all fourteen poses; floor/head metadata moves,
  // while no frame is independently stretched to match another pose's height.
  const left = Math.max(...frames.map(f => f.foot.x - f.box[0]));
  const right = Math.max(...frames.map(f => f.box[2] - f.foot.x));
  const above = Math.max(...frames.map(f => f.foot.y - f.box[1]));
  const scale = Math.min(11.4 / left, 11.4 / right, 15.8 / above);
  manifest.breeds.push({ breed, file, size: [width, height], sha256: createHash('sha256').update(bytes).digest('hex'), scale, frames });
  console.log(JSON.stringify({ breed, frames: frames.length, scale, width, height }));
}
await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
