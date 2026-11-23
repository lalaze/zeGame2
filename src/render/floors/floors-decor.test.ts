import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DECOR, decorDef } from '../../game/decor';

const BUILD = 'assets/generated/floor-sample-v1/build';
const manifestPath = `${BUILD}/decor/decor.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, {
  back: string[]; front: string[]; slots: Record<string, Record<string, string>>;
}> : null;

/** Which slots each decorated floor shows: the counter, rug and neon are downstairs, curtains and sill upstairs. */
const SHOWN: Record<string, string[]> = {
  '1f': ['wallpaper', 'floor', 'counter', 'tablecloth', 'centerpiece', 'ceiling', 'rug', 'neon'],
  '2f': ['wallpaper', 'floor', 'curtain', 'tablecloth', 'centerpiece', 'ceiling', 'sill'],
};

describe.skipIf(!manifest)('floors decor layers', () => {
  it('has a layer for every decor item a floor shows, except the empty choices', () => {
    for (const [floor, slots] of Object.entries(SHOWN)) {
      for (const slot of slots) {
        const items = DECOR.filter(d => d.slot === slot && !d.id.endsWith('_none')).map(d => d.id);
        expect(Object.keys(manifest![floor].slots[slot] ?? {}).sort(), `${floor} ${slot}`).toEqual(items.sort());
      }
    }
  });

  it('names only real decor items in their own slot, and files that exist', () => {
    for (const [floor, entry] of Object.entries(manifest!)) {
      for (const [slot, items] of Object.entries(entry.slots)) {
        for (const [id, file] of Object.entries(items)) {
          expect(decorDef(id)?.slot, `${floor} ${id}`).toBe(slot);
          expect(existsSync(`${BUILD}/${file}`), file).toBe(true);
        }
      }
      for (const file of [...entry.back, ...entry.front]) expect(existsSync(`${BUILD}/${file}`), file).toBe(true);
      expect(entry.back.some(file => file.endsWith('/shell.webp')), `${floor} shell`).toBe(true);
    }
  });
});
