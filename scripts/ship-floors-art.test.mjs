import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { FLOORS_PACK, copyFloorsArt, shipsFloorsFile } from './ship-floors-art.mjs';

it('ships what the building loads and leaves build leftovers behind', () => {
  expect(shipsFloorsFile('sheets.json')).toBe(true);
  expect(shipsFloorsFile('cast-07-moves.webp')).toBe(true);
  expect(shipsFloorsFile('decor/1f/wall_mint.webp')).toBe(true);
  expect(shipsFloorsFile('app/icon-192.png')).toBe(true);
  expect(shipsFloorsFile('app/manifest.webmanifest')).toBe(true);
  // PNG strips a build writes beside the WebP live in the art library, and never ship.
  expect(shipsFloorsFile('owner.png')).toBe(false);
  expect(shipsFloorsFile('cats/ginger.png')).toBe(false);
});

it('copies the pack to the address the game asks for, the same as on the dev server', async () => {
  const out = await mkdtemp(join(tmpdir(), 'floors-art-'));
  try {
    const names = await copyFloorsArt('.', out);
    expect(readFileSync('src/render/floors/floors-scene.ts', 'utf8')).toContain(`\`\${import.meta.env.BASE_URL}${FLOORS_PACK}/\``);
    for (const name of ['sheets.json', 'floor-1.webp', 'decor/decor.json', 'icons/icons.json', 'cats/cats.json', 'staff/staff.json', 'street/street.json', 'map/map.json', 'sky/sky.json', 'fx/fx.json', 'app/loading.webp'])
      expect(names, name).toContain(name);
    expect(names.every(shipsFloorsFile)).toBe(true);
    for (const name of names) expect(existsSync(join(out, FLOORS_PACK, name)), name).toBe(true);
    expect((await readdir(join(out, FLOORS_PACK))).some((name) => name.endsWith('.png'))).toBe(false);
  } finally { await rm(out, { recursive: true, force: true }); }
});
