// Still copies of existing café sprites for the street, so reduced motion has nothing to stop.
// They copy what the café ships (the WebP), not the PNG masters: art that once shipped as GIF
// keeps its pre-GIF original as the master, and the street should match the café pixel for pixel.
// Then run scripts/convert-art-webp.mjs to ship the copies as WebP too.
import fs from 'node:fs';
import sharp from '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';
const out = 'public/art/street-scene';
fs.mkdirSync(out, { recursive: true });
const sprites = {
  ...Object.fromEntries(['town', 'flowers', 'seaside', 'forest', 'city'].map(id => [`shop-${id}`, `public/art/generated/cozy-idle-v1/shop-${id}.webp`])),
  cloud: 'public/art/generated/cozy-world-v2/environment-cloud.webp',
  trees: 'public/art/generated/cozy-world-v2/environment-outdoor-tree-line.webp',
  village: 'public/art/generated/cozy-world-v2/environment-village-roof-cluster.webp',
  barrier: 'public/art/generated/cozy-idle-v1/build-sawhorse.webp',
  ladder: 'public/art/generated/cozy-idle-v1/build-ladder.webp',
  books: 'public/art/generated/cozy-furniture-v2/furniture-bookshelf.webp',
  plants: 'public/art/generated/cozy-furniture-v2/furniture-plant_fern.webp',
  flowers: 'assets/generated/neighborhood-reserve-v1/sprites/street-flower-cart-spring.png',
  pottery: 'public/art/generated/cozy-world-v2/service-jars.webp',
  tea: 'public/art/generated/cozy-world-v2/service-cups.webp',
  bench: 'assets/generated/neighborhood-reserve-v1/sprites/street-slat-bench-spring.png',
  bicycle: 'assets/generated/neighborhood-reserve-v1/sprites/street-parked-bicycle-spring.png',
  clock: 'assets/generated/neighborhood-reserve-v1/sprites/street-street-clock-spring.png',
  planter: 'assets/generated/neighborhood-reserve-v1/sprites/street-raised-bed-spring.png',
  // Street walkers reuse the first four café guests' twelve-pose sheets (the profile poses are frames 6 to 8).
  ...Object.fromEntries([0, 1, 2, 3].map(i => [`guest-${i}`, `public/art/generated/cozy-cast-v9/customer-${i}.webp`])),
};
for (const [id, source] of Object.entries(sprites)) {
  if (!fs.existsSync(source)) throw Error(`Missing source ${source}`);
  if (source.endsWith('.webp')) await sharp(source).png({ compressionLevel: 9 }).toFile(`${out}/${id}.png`);
  else fs.copyFileSync(source, `${out}/${id}.png`);
}
fs.writeFileSync(`${out}/README.md`, '# Street scene sprites\n\nStill copies of existing café art, made by `node scripts/build-street-scene-art.mjs` from the shipped WebPs. No new external artwork. Shop sprites: cozy-idle-v1; scenery and displays: cozy-world-v2 / cozy-furniture-v2; pedestrians: cozy-cast-v9; street furniture: neighborhood-reserve-v1 (original reserve-library art). PNG sheets animate only through CSS, disabled by prefers-reduced-motion.\n');
