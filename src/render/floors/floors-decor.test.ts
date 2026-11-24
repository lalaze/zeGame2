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

const thumbsPath = `${BUILD}/thumbs/thumbs.json`;
const thumbs = existsSync(thumbsPath) ? JSON.parse(readFileSync(thumbsPath, 'utf8')) as string[] : null;

describe.skipIf(!thumbs)('floors ledger thumbnails', () => {
  it('has a thumbnail for every decor option, the empty choices included', () => {
    expect([...thumbs!].sort()).toEqual(DECOR.map(d => d.id).sort());
    for (const id of thumbs!) expect(existsSync(`${BUILD}/thumbs/${id}.webp`), id).toBe(true);
  });

  it('shows floors art for furniture and decor, and leaves every other icon drawn', async () => {
    const { floorsIconArt } = await import('./floors-icons');
    const art = floorsIconArt('/art/', { lamp: {} }, thumbs!);
    expect(art('furniture:lamp')).toBe('/art/furniture/lamp.webp');
    expect(art('furniture:piano')).toBeUndefined();
    expect(art('decor:wall_mint')).toBe('/art/thumbs/wall_mint.webp');
    // Tablecloth and centerpiece keys carry the table setting after the id.
    expect(art('decor:tablecloth_mint:tablecloth_mint:centerpiece_none')).toBe('/art/thumbs/tablecloth_mint.webp');
    expect(art('item:latte')).toBeUndefined();
    expect(art('ing:milk')).toBeUndefined();
    const painted = floorsIconArt('/art/', null, [], ['item:latte', 'ing:milk']);
    expect(painted('item:latte')).toBe('/art/icons/item-latte.webp');
    expect(painted('ing:milk')).toBe('/art/icons/ing-milk.webp');
    expect(painted('upgrade:barista')).toBeUndefined();
  });
});

const iconsPath = `${BUILD}/icons/icons.json`;
const icons = existsSync(iconsPath) ? JSON.parse(readFileSync(iconsPath, 'utf8')) as string[] : null;

describe.skipIf(!icons)('floors ledger icons', () => {
  it('names only real menu items, ingredients, upgrades and dialog pictures, with files that exist', async () => {
    const { MENU, INGREDIENTS, UPGRADES } = await import('../../game/data');
    const { SIGNATURE_BASES } = await import('../../game/signature-drinks');
    const { PROMOTION_PLANS } = await import('../../game/promotion');
    const known = new Set([...MENU.map(m => `item:${m.id}`), ...INGREDIENTS.map(i => `ing:${i.id}`), ...UPGRADES.map(u => `upgrade:${u.id}`),
      // The dialogs' pictures (floors-fx.test.ts): signature drinks by base, promotion platforms, Mina's map by route.
      ...SIGNATURE_BASES.map(base => `sig:${base}`), ...PROMOTION_PLANS.map(plan => `promo:${plan.platform}`), 'wish:quiet', 'wish:milky']);
    for (const key of icons!) {
      expect(known.has(key), key).toBe(true);
      expect(existsSync(`${BUILD}/icons/${key.replace(':', '-')}.webp`), key).toBe(true);
    }
  });
});
