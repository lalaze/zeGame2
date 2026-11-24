// The cross-section art (assets/generated/floor-sample-v1/build) ships from where its build scripts
// write it: the game asks for it at the same address on the dev server and in a build
// (FLOORS_ART in src/render/floors/floors-scene.ts), so a build copies it there. It is painted
// art saved as WebP by its own builds, not pixel art: it does not go through public/art,
// convert-art-webp.mjs or assets/art-masters.
import { cp, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

export const FLOORS_PACK = 'assets/generated/floor-sample-v1/build';

/** What ships: the WebP and JSON the game loads, and the app icons. PNG strips left beside them by a build stay behind. */
export function shipsFloorsFile(name) {
  return /\.(webp|json|webmanifest)$/.test(name) || /^app\/[^/]+\.png$/.test(name);
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }))).flat();
}

export async function copyFloorsArt(root, outputDirectory) {
  const from = resolve(root, FLOORS_PACK);
  const names = (await filesIn(from)).map((path) => relative(from, path).split('\\').join('/')).filter(shipsFloorsFile).sort();
  for (const name of names) await cp(join(from, name), join(outputDirectory, FLOORS_PACK, name));
  return names;
}

export function shipFloorsArt() {
  let root;
  let outputDirectory;
  return {
    name: 'tiny-bean-ship-floors-art',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    // Before closeBundle, where the offline precache lists everything in the build.
    async writeBundle() {
      const names = await copyFloorsArt(root, outputDirectory);
      if (!names.includes('sheets.json')) throw new Error('The floors art is incomplete: no sheets.json');
    },
  };
}
