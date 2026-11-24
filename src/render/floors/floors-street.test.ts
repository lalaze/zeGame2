// @vitest-environment happy-dom
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { PERKS } from '../../game/chain-bonuses';
import { LOCATION_IDS } from '../../game/locations';
import { createInitialState } from '../../game/state';
import { BUSINESSES, STREETS, STREET_PLOTS } from '../../game/streets';
import { perkImage, setChainArt, shopImage } from '../../ui/chain-ui';
import { setStreetIcons, streetIcon, type StreetIcon } from '../../ui/street-icons';
import { imageSize } from '../../../scripts/art-files.mjs';
import anchors from '../../../public/art/street-art-v2/anchors.json';
import { branchViewArt, setBranchArt } from '../branch-map-art';
import { setStreetArt, streetRegionArt, streetSceneryArt, streetShopArt, streetShopAsset, streetSpriteUrl, styleStreetShop } from '../street-art';
import {
  floorsBranchArt, floorsChainArt, floorsStreetArt, floorsStreetIcon, seatingFloors, streetStyleProperties,
  type MapManifest, type StreetManifest,
} from './floors-street';

const BUILD = 'assets/generated/floor-sample-v1/build';
const read = <T>(path: string) => (existsSync(`${BUILD}/${path}`) ? JSON.parse(readFileSync(`${BUILD}/${path}`, 'utf8')) as T : null);
const street = read<StreetManifest & { res: number }>('street/street.json');
const map = read<MapManifest>('map/map.json');
const BASE = '/floors-art/';
/** The file a painted URL points at. */
const file = (url: string | undefined) => `${BUILD}/${url!.slice(url!.indexOf(BASE) + BASE.length)}`;
const size = (path: string) => imageSize(readFileSync(path));
const STATUSES = ['sale', 'vacant', 'building', 'open'] as const;
const businesses = [...BUSINESSES.map(b => b.id), 'cafe' as const, null];

afterEach(() => { setStreetArt(null); setStreetIcons(null); setBranchArt(null); setChainArt(null); });

/** Every picture the street's own code asks its art source for, whatever the lot and its state. */
function asked(): { pack: 'street-art-v2' | 'street-scene'; name: string }[] {
  const seen = new Map<string, { pack: 'street-art-v2' | 'street-scene'; name: string }>();
  setStreetArt({ sprite: (pack, name) => { seen.set(`${pack}/${name}`, { pack, name }); return undefined; }, anchor: () => undefined, region: () => undefined });
  streetSceneryArt();
  for (const def of STREETS) for (const plot of STREET_PLOTS) for (const business of businesses) for (const status of STATUSES) streetShopArt(def.id, business, status, plot.id);
  for (let i = 0; i < 4; i++) streetSpriteUrl(`guest-${i}`);
  setStreetArt(null);
  return [...seen.values()];
}

describe.skipIf(!street)('the painted street of the floors view', () => {
  const art = () => floorsStreetArt(BASE, street!, map, () => 0);

  it('has a painted picture for every storefront, scenery piece, walker and construction piece the street asks for', () => {
    const wanted = asked();
    expect(wanted.map(w => w.name)).toEqual(expect.arrayContaining(['cafe', 'bookshop', 'plant-shop', 'florist', 'pottery', 'tea-shop', 'vacant-brick', 'vacant-blue',
      'cloud', 'depth-cloud-small', 'depth-town', 'depth-hamlet', 'depth-hedge', 'depth-tree', 'bench', 'lamp', 'ladder', 'barrier', 'guest-0', 'guest-3']));
    for (const { pack, name } of wanted) {
      const url = art().sprite(pack, name);
      expect(url, `${pack}/${name}`).toBeTruthy();
      expect(existsSync(file(url)), file(url)).toBe(true);
    }
  });

  it('keeps every storefront in the box of its pixel piece, with its sign and door inside', () => {
    for (const def of STREETS) for (const plot of STREET_PLOTS) for (const business of BUSINESSES.map(b => b.id).concat()) {
      for (const asset of [streetShopAsset(def.id, business, plot.id), streetShopAsset(def.id, null, plot.id)]) {
        const anchor = art().anchor(asset)!, pixel = anchors[asset];
        expect(anchor, asset).toBeTruthy();
        expect([anchor.width, anchor.height], asset).toEqual([pixel.width, pixel.height]);
        expect(size(`${BUILD}/street/${asset}.webp`), asset).toEqual([anchor.width * street!.res, anchor.height * street!.res]);
        expect(anchor.signY).toBeGreaterThan(0); expect(anchor.signY).toBeLessThan(anchor.height);
        expect(anchor.doorX).toBeGreaterThan(0); expect(anchor.doorX).toBeLessThan(anchor.width);
      }
    }
  });

  it('draws the player\'s café as its own building: one picture per number of seating floors', () => {
    const heights: number[] = [];
    for (const floors of [0, 1, 2]) {
      const own = floorsStreetArt(BASE, street!, map, () => floors);
      const anchor = own.anchor('cafe')!;
      expect(own.sprite('street-art-v2', 'cafe')).toContain(`street/cafe-${floors}.webp`);
      expect(size(file(own.sprite('street-art-v2', 'cafe')))).toEqual([anchor.width * street!.res, anchor.height * street!.res]);
      heights.push(anchor.height);
    }
    // With no seating floor it fills the pixel café's box; each floor makes it taller.
    expect(heights[0]).toBe(anchors.cafe.height);
    expect(heights[1]).toBeGreaterThan(heights[0]); expect(heights[2]).toBeGreaterThan(heights[1]);
    const state = createInitialState(0);
    expect(seatingFloors(state)).toBe(0);
    state.upgrades.tables = 6;
    expect(seatingFloors(state)).toBeGreaterThan(0);
  });

  it('sizes a styled storefront from the painted anchors, and from anchors.json again without them', () => {
    const button = document.createElement('button');
    setStreetArt(floorsStreetArt(BASE, street!, map, () => 1));
    styleStreetShop(button, 'town', 'cafe');
    expect(button.style.getPropertyValue('--shop-height')).toBe(`${street!.shops['cafe-1'].height / 2}px`);
    expect(streetShopArt('town', 'reading', 'open')).toContain(`${BASE}street/bookshop.webp`);
    setStreetArt(null);
    styleStreetShop(button, 'town', 'cafe');
    expect(button.style.getPropertyValue('--shop-height')).toBe(`${anchors.cafe.height / 2}px`);
    expect(streetShopArt('town', 'reading', 'open')).toContain('/art/street-art-v2/bookshop.webp');
    expect(streetSpriteUrl('guest-1')).toContain('/art/street-scene/guest-1.webp');
  });

  it('has the backgrounds and badges its stylesheet names', () => {
    const properties = streetStyleProperties(BASE, street, map);
    const css = readFileSync('src/ui/floors-street.css', 'utf8');
    for (const [, name] of css.matchAll(/var\((--fl-(?:street|map)-[\w-]+)/g)) expect(Object.keys(properties), name).toContain(name);
    for (const [name, value] of Object.entries(properties)) {
      const url = /^url\("(.+)"\)$/.exec(value)?.[1];
      if (url) expect(existsSync(file(url)), name).toBe(true);
    }
  });

  it('draws every street mark itself', () => {
    const icon = floorsStreetIcon(BASE, street);
    setStreetIcons(icon);
    for (const name of ['left', 'right', 'down', 'lock', 'flag', 'book', 'close'] as StreetIcon[]) {
      expect(icon(name), name).toBeTruthy();
      expect(streetIcon(name)).toContain(`street-ui-icon-${name}`);
      expect(streetIcon(name)).not.toContain('crispEdges');
      const badge = /src="([^"]+)"/.exec(streetIcon(name))?.[1];
      if (badge) expect(existsSync(file(badge)), badge).toBe(true);
    }
    setStreetIcons(null);
    expect(streetIcon('left')).toContain('crispEdges');
  });
});

describe.skipIf(!map)('the painted branch map, regions and chain of the floors view', () => {
  it('has the map, and a view and a little café for every place', () => {
    const branch = floorsBranchArt(BASE, map!);
    setBranchArt(branch); setChainArt(floorsChainArt(BASE, map!));
    expect(size(file(branch.map))).toEqual([1280, 800]);
    for (const id of LOCATION_IDS) {
      expect(existsSync(file(branchViewArt(id))), `view ${id}`).toBe(true);
      const [width, height] = size(file(branchViewArt(id)));
      expect(width / height).toBeCloseTo(92 / 76, 2);
      expect(shopImage(id)).toBe(`${BASE}map/place-${id}.webp`);
      expect(existsSync(file(shopImage(id))), `place ${id}`).toBe(true);
    }
    setBranchArt(null); setChainArt(null);
    expect(branchViewArt('city')).toBeUndefined();
    expect(shopImage('city')).toContain('art/generated/cozy-idle-v1/shop-city.webp');
  });

  it('has a picture for every chain perk', () => {
    setChainArt(floorsChainArt(BASE, map!));
    for (const perk of PERKS) expect(existsSync(file(perkImage(perk.id))), perk.id).toBe(true);
  });

  it.skipIf(!street)('has a picture of the inside of every street business', () => {
    setStreetArt(floorsStreetArt(BASE, street!, map, () => 0));
    for (const business of BUSINESSES) expect(existsSync(file(streetRegionArt(business.id))), business.id).toBe(true);
    setStreetArt(null);
    expect(streetRegionArt('reading')).toBeUndefined();
  });
});

describe('floors street stylesheet', () => {
  it('only styles the floors view, so the pixel view keeps its look', () => {
    const rules = readFileSync('src/ui/floors-street.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+{(?:[^{}]*{[^{}]*})*[^{}]*}/g, '');
    const selectors = [...rules.matchAll(/([^{}]+){[^{}]*}/g)].map(m => m[1].trim());
    expect(selectors.length).toBeGreaterThan(20);
    for (const list of selectors) {
      for (const selector of list.split(/,(?![^()]*\))/)) expect(selector.trim(), list).toMatch(/^:root body\.floors-view\b/);
    }
  });
});
