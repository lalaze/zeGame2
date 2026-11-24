// The street, the branch map and the chain's pictures in the floors view (?floors). The screens keep
// their layout and behaviour (src/ui/streets.ts, branch-map.ts, chain-ui.ts); this fills their art
// hooks with the painted pictures of assets/generated/floor-sample-v1/build/{street,map}
// (scripts/art-gen/floor-street-build.py and floor-map-build.py), and floors-street.css corrects
// what the pixel pieces' CSS assumed.
import '../../ui/floors-street.css';
import type { GameState } from '../../game/state';
import type { LocationId } from '../../game/locations';
import { activeTableIndices, type RegionId } from '../../game/regions';
import { setBranchArt, type BranchArt } from '../branch-map-art';
import { setStreetArt, type StreetAnchor, type StreetArt } from '../street-art';
import { setChainArt, type ChainArt } from '../../ui/chain-ui';
import { setStreetIcons, type StreetIcon } from '../../ui/street-icons';
import { building } from './floors-layout';

interface Size { width: number; height: number }
/** build/street/street.json: sizes are in the units of public/art/street-art-v2/anchors.json. */
export interface StreetManifest {
  /** Storefronts by the pixel pack's names, and the café by its seating floors: cafe-0, cafe-1, cafe-2. */
  shops: Record<string, StreetAnchor>;
  /** Scenery and construction pieces, by the pixel packs' names where they stand in for one. */
  scenery: Record<string, Size>;
  badges: Record<string, Size>;
  /** The strip of far hills: the units its tile spans, and the meadow colour it ends in. */
  hills?: { span: number; height: number; meadow: string };
  /** The paving: how many units one painting spans, and the colour it ends in. */
  ground?: { span: number; height: number; edge: string };
  /** Strolling guests: guest-0 … guest-(count-1), strips of `frames` cells this size. */
  walkers?: { count: number; width: number; height: number; frames: number };
}
/** build/map/map.json: which pictures the map build wrote. */
export interface MapManifest {
  map?: Size;
  views: string[];
  regions: string[];
  places: string[];
  perks: string[];
  pin?: Size;
}

/** How many seating floors a café with this state has between its ground floor and its attic. */
export function seatingFloors(state: GameState): number {
  return building(activeTableIndices(state).length, state.kitchen).floors.filter(floor => floor === 'floor-2' || floor === 'floor-3').length;
}

/** The street's pictures. `seating` picks the café that matches the player's building. */
export function floorsStreetArt(base: string, street: StreetManifest, map: MapManifest | null, seating: () => number): StreetArt {
  const file = (name: string) => new URL(`${base}street/${name}.webp`, document.baseURI).href;
  const cafe = () => `cafe-${Math.max(0, Math.min(2, seating()))}`;
  const regions = new Set(map?.regions ?? []);
  return {
    sprite(pack, name) {
      if (pack === 'street-art-v2') {
        if (name === 'cafe') return street.shops[cafe()] ? file(cafe()) : undefined;
        return street.shops[name] || street.scenery[name] ? file(name) : undefined;
      }
      const guest = /^guest-(\d+)$/.exec(name);
      if (guest) return street.walkers?.count ? file(`guest-${Number(guest[1]) % street.walkers.count}`) : undefined;
      return street.scenery[name] ? file(name) : undefined;
    },
    anchor: asset => street.shops[asset === 'cafe' ? cafe() : asset],
    region: (business: RegionId) => (regions.has(business) ? new URL(`${base}map/region-${business}.webp`, document.baseURI).href : undefined),
  };
}

/** The branch map and the view from each place's windows. */
export function floorsBranchArt(base: string, map: MapManifest): BranchArt {
  const views = new Set(map.views);
  return {
    map: map.map ? `${base}map/map.webp` : undefined,
    view: (id: LocationId) => (views.has(id) ? `${base}map/view-${id}.webp` : undefined),
  };
}

/** The little café of each place and the chain's perks. */
export function floorsChainArt(base: string, map: MapManifest): ChainArt {
  const places = new Set(map.places), perks = new Set(map.perks);
  return (kind, id) => {
    if (kind === 'shop') return places.has(id) ? `${base}map/place-${id}.webp` : undefined;
    return perks.has(id) ? `${base}map/perk-${id}.webp` : undefined;
  };
}

/** The street's marks as round line icons on the floors UI's 24-unit grid. */
const LINES: Partial<Record<StreetIcon, string>> = {
  left: 'M19 12H5.5M11 6l-6 6 6 6',
  right: 'M5 12h13.5M13 6l6 6-6 6',
  down: 'M6 9.5l6 6 6-6',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
};
/** Marks that are painted badges instead (build/street, the `badges` of street.json). */
const BADGES: Partial<Record<StreetIcon, string>> = { flag: 'flag', lock: 'lock', book: 'blueprint' };

export function floorsStreetIcon(base: string, street: StreetManifest | null): (name: StreetIcon) => string | undefined {
  return name => {
    const badge = BADGES[name];
    if (badge && street?.badges[badge]) {
      return `<img class="street-ui-icon street-ui-icon-${name} street-ui-badge" src="${base}street/${badge}.webp" alt="" draggable="false">`;
    }
    const line = LINES[name];
    return line && `<svg class="street-ui-icon street-ui-icon-${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="${line}"/></svg>`;
  };
}

/** What floors-street.css reads from the page: the pictures it sets as backgrounds, and their sizes. */
export function streetStyleProperties(base: string, street: StreetManifest | null, map: MapManifest | null): Record<string, string> {
  const url = (path: string) => `url("${new URL(`${base}${path}.webp`, document.baseURI).href}")`;
  const out: Record<string, string> = {};
  if (street) {
    if (street.hills) {
      out['--fl-street-hills'] = url('street/hills');
      out['--fl-street-hills-span'] = `${street.hills.span}px`;
      out['--fl-street-meadow'] = street.hills.meadow;
    }
    if (street.ground) {
      out['--fl-street-ground'] = url('street/ground');
      out['--fl-street-ground-span'] = `${street.ground.span}px`;
      out['--fl-street-ground-edge'] = street.ground.edge;
    }
    for (const name of ['mound', 'hoarding', 'scaffold']) if (street.scenery[name]) out[`--fl-street-${name}`] = url(`street/${name}`);
    for (const name of Object.keys(street.badges)) out[`--fl-street-badge-${name}`] = url(`street/${name}`);
    const lamp = street.scenery.lamp;
    if (lamp) out['--fl-street-lamp'] = `${lamp.width} / ${lamp.height}`;
    const sign = street.badges.sign;
    if (sign) out['--fl-street-sign'] = `${sign.width} / ${sign.height}`;
    if (street.walkers) {
      out['--fl-street-walker-w'] = `${street.walkers.width}px`;
      out['--fl-street-walker-h'] = `${street.walkers.height}px`;
      out['--fl-street-walker-strip'] = `${street.walkers.width * street.walkers.frames}px`;
    }
  }
  if (map?.pin) out['--fl-map-pin'] = url('map/pin');
  return out;
}

/**
 * Loads the painted street and map and hands them to the screens. Whatever is missing stays as the
 * pixel view draws it; the stylesheet only applies once the street's pictures are in
 * (body.floors-street) or the map's (body.floors-map).
 */
export async function installFloorsStreet(base: string, getState: () => GameState, root: HTMLElement = document.body): Promise<void> {
  const load = <T>(path: string) => fetch(`${base}${path}`).then(r => (r.ok ? r.json() as Promise<T> : null)).catch(() => null);
  const [street, map] = await Promise.all([load<StreetManifest>('street/street.json'), load<MapManifest>('map/map.json')]);
  for (const [name, value] of Object.entries(streetStyleProperties(base, street, map))) root.style.setProperty(name, value);
  if (street) {
    setStreetArt(floorsStreetArt(base, street, map, () => seatingFloors(getState())));
    setStreetIcons(floorsStreetIcon(base, street));
    root.classList.add('floors-street');
  }
  if (map) {
    setBranchArt(floorsBranchArt(base, map));
    setChainArt(floorsChainArt(base, map));
    root.classList.add('floors-map');
  }
}
