// Freeze existing authored sprites so reduced-motion also stops their GIF frames.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const out = 'public/art/street-scene';
fs.mkdirSync(out, { recursive: true });
const sprites = {
  ...Object.fromEntries(['town', 'flowers', 'seaside', 'forest', 'city'].map(id => [`shop-${id}`, `public/art/generated/cozy-idle-v1/shop-${id}.gif`])),
  cloud: 'public/art/generated/cozy-world-v2/environment-cloud.gif',
  trees: 'public/art/generated/cozy-world-v2/environment-outdoor-tree-line.gif',
  village: 'public/art/generated/cozy-world-v2/environment-village-roof-cluster.gif',
  barrier: 'public/art/generated/cozy-idle-v1/build-sawhorse.gif',
  ladder: 'public/art/generated/cozy-idle-v1/build-ladder.gif',
  books: 'public/art/generated/cozy-furniture-v2/furniture-bookshelf.gif',
  plants: 'public/art/generated/cozy-furniture-v2/furniture-plant_fern.gif',
  flowers: 'assets/generated/neighborhood-reserve-v1/sprites/street-flower-cart-spring.png',
  pottery: 'public/art/generated/cozy-world-v2/service-jars.png',
  tea: 'public/art/generated/cozy-world-v2/service-cups.gif',
  bench: 'assets/generated/neighborhood-reserve-v1/sprites/street-slat-bench-spring.png',
  bicycle: 'assets/generated/neighborhood-reserve-v1/sprites/street-parked-bicycle-spring.png',
  clock: 'assets/generated/neighborhood-reserve-v1/sprites/street-street-clock-spring.png',
  planter: 'assets/generated/neighborhood-reserve-v1/sprites/street-raised-bed-spring.png',
};
for (const [id, source] of Object.entries(sprites)) {
  if (!fs.existsSync(source)) throw Error(`Missing source ${source}`);
  execFileSync('sips', ['-s', 'format', 'png', source, '--out', `${out}/${id}.png`], { stdio: 'ignore' });
}
// Street walkers reuse the first four café guests' twelve-pose sheets (the profile poses are frames 6 to 8).
for (let i = 0; i < 4; i++) fs.copyFileSync(`assets/art-masters/art/generated/cozy-cast-v9/customer-${i}.png`, `${out}/guest-${i}.png`);
fs.writeFileSync(`${out}/README.md`, '# Street scene sprites\n\nStatic first frames of existing café art, extracted with `node scripts/build-street-scene-art.mjs` (macOS sips). No new external artwork. Shop sprites: cozy-idle-v1; scenery and displays: cozy-world-v2 / cozy-furniture-v2; pedestrians: cozy-cast-v7; street furniture: neighborhood-reserve-v1 (original reserve-library art). PNG sheets animate only through CSS, disabled by prefers-reduced-motion.\n');
