import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MENU } from '../../game/data';
import type { MomentKind } from '../../game/moments';
import { PROMOTION_PLANS } from '../../game/promotion';
import { ROOM_PROJECTS } from '../../game/room-projects';
import { SIGNATURE_BASES } from '../../game/signature-drinks';
import { CUE_KINDS, FX_FRAMES, SIGNATURE_BASE_ART, isDrinkItem, isHotDrink, itemFrame } from './floors-fx';
import { floorsIconArt } from './floors-icons';

const BUILD = 'assets/generated/floor-sample-v1/build';
const json = <T>(path: string): T | null => (existsSync(`${BUILD}/${path}`) ? JSON.parse(readFileSync(`${BUILD}/${path}`, 'utf8')) as T : null);
interface Atlas { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>; meta: { image: string; size: { w: number; h: number } } }
const fx = json<Atlas>('fx/fx.json'), items = json<Atlas>('fx/items.json'), icons = json<string[]>('icons/icons.json');
const furniture = json<Record<string, unknown>>('furniture/furniture.json');
/** The icon keys the dialogs ask for beyond the ledger's menu, pantry and upgrades. */
const DIALOG_ICONS = [
  ...SIGNATURE_BASES.map(base => `sig:${base}`),
  ...new Set(PROMOTION_PLANS.map(plan => `promo:${plan.platform}`)),
  'wish:quiet', 'wish:milky',
];

describe.skipIf(!fx || !items || !icons)('floors props and effects art', () => {
  it('has every frame the floors view draws, inside its atlas', () => {
    for (const atlas of [fx!, items!]) {
      expect(existsSync(`${BUILD}/fx/${atlas.meta.image}`), atlas.meta.image).toBe(true);
      for (const [name, { frame }] of Object.entries(atlas.frames)) {
        expect(frame.w > 0 && frame.h > 0 && frame.x >= 0 && frame.y >= 0, name).toBe(true);
        expect(frame.x + frame.w <= atlas.meta.size.w && frame.y + frame.h <= atlas.meta.size.h, name).toBe(true);
      }
    }
    expect(FX_FRAMES.filter(frame => !fx!.frames[frame])).toEqual([]);
    expect(existsSync(`${BUILD}/fx/case-empty.webp`)).toBe(true);
  });

  it('has a cue for every kind of moment', () => {
    // A new kind of moment fails to compile here until it has a cue.
    const kinds: Record<MomentKind, true> = { recommend: true, greet: true, cat: true, photo: true, delivery: true };
    expect([...CUE_KINDS].sort()).toEqual(Object.keys(kinds).sort());
    expect(CUE_KINDS.filter(kind => !fx!.frames[`cue-${kind}`])).toEqual([]);
  });

  it('pictures every menu item and every signature base, as an icon and at table size', () => {
    expect([...SIGNATURE_BASE_ART]).toEqual([...SIGNATURE_BASES]);
    const wanted = [...MENU.map(m => `item:${m.id}`), ...SIGNATURE_BASES.map(base => `sig:${base}`)];
    expect(wanted.filter(key => !icons!.includes(key))).toEqual([]);
    expect(wanted.filter(key => !items!.frames[key.replace(':', '-')])).toEqual([]);
    expect(MENU.map(m => itemFrame(m.id)).filter(frame => !items!.frames[frame])).toEqual([]);
    expect(itemFrame('sig:coffee:beans=1,cream=1,milk=1')).toBe('sig-coffee');
    expect(itemFrame('sig:fruit:fruit=2,sugar=1')).toBe('sig-fruit');
  });

  it('tells drinks from baked goods, and hot drinks from cold', () => {
    expect(MENU.filter(m => isDrinkItem(m.id)).map(m => m.category).every(c => c === 'coffee' || c === 'tea')).toBe(true);
    expect([isDrinkItem('croissant'), isDrinkItem('latte'), isDrinkItem('sig:tea:tea=1')]).toEqual([false, true, true]);
    expect([isHotDrink('latte'), isHotDrink('coldbrew'), isHotDrink('croissant'), isHotDrink('sig:fruit:fruit=1')]).toEqual([true, false, false, false]);
  });

  it('has a file for every icon key, and the dialogs find theirs through the icon hook', () => {
    expect(icons!.filter(key => !existsSync(`${BUILD}/icons/${key.replace(':', '-')}.webp`))).toEqual([]);
    expect(DIALOG_ICONS.filter(key => !icons!.includes(key))).toEqual([]);
    const art = floorsIconArt('/art/', furniture, [], icons!);
    expect(art('item:latte')).toBe('/art/icons/item-latte.webp');
    expect(art('item:sig:milk:matcha=1,milk=2')).toBe('/art/icons/sig-milk.webp');
    expect(art('promo:flash')).toBe('/art/icons/promo-flash.webp');
    expect(art('wish:quiet')).toBe('/art/icons/wish-quiet.webp');
    expect(art('item:sig:soup:water=1')).toBeUndefined();
    // Room projects show a piece of furniture.
    if (furniture) expect(ROOM_PROJECTS.filter(p => !art(`furniture:${p.art}`)).map(p => p.id)).toEqual([]);
  });
});
