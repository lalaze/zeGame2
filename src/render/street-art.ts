import type { LocationId } from '../game/locations';
import type { RegionId } from '../game/regions';
import anchors from '../../public/art/street-art-v2/anchors.json';

const base = import.meta.env.BASE_URL;
/** A storefront's box, the line its name is written on and its door, in the units of anchors.json. */
export interface StreetAnchor { width: number; height: number; signY: number; doorX: number }
/**
 * Pictures another look draws the street with instead of the pixel packs. The floors view (?floors)
 * supplies its painted ones (src/render/floors/floors-street.ts); without a source, or where it has
 * no picture, the street is drawn as shipped.
 */
export interface StreetArt {
  /** The picture standing in for `name` of public/art/street-art-v2 or public/art/street-scene. */
  sprite(pack: 'street-art-v2' | 'street-scene', name: string): string | undefined;
  /** The box and anchors of its storefront picture, where they differ from anchors.json. */
  anchor(asset: keyof typeof anchors): StreetAnchor | undefined;
  /** A picture of what a business is like inside, for the lot's details. */
  region(business: RegionId): string | undefined;
}
let painted: StreetArt | null = null;
export function setStreetArt(art: StreetArt | null): void {
  painted = art;
}
export const streetRegionArt = (business: RegionId) => painted?.region(business);
// CSS custom properties resolve against the stylesheet: use document-absolute URLs.
export const streetSpriteUrl = (name: string) => painted?.sprite('street-scene', name) ?? new URL(`${base}art/street-scene/${name}.webp`, document.baseURI).href;
const approvedUrl = (name: string) => painted?.sprite('street-art-v2', name) ?? new URL(`${base}art/street-art-v2/${name}.webp`, document.baseURI).href;
export const streetSprite = (name: string, className = '') => `<img class="${className}" src="${streetSpriteUrl(name)}" alt="" draggable="false" decoding="async">`;
const approvedSprite = (name: string, className = '') => `<img class="${className}" src="${approvedUrl(name)}" alt="" draggable="false" decoding="async">`;
type Business = RegionId | 'cafe' | null;
/** Stable per address, independent of owned count, selected street and save migration. */
export function streetShopAsset(street: LocationId, business: Business, plot = '01'): keyof typeof anchors {
  if (business) return ({ cafe: 'cafe', reading: 'bookshop', greenhouse: 'plant-shop', terrace: 'florist', workshop: 'pottery', observatory: 'tea-shop' } as const)[business];
  return (Number(plot) + ['town', 'flowers', 'seaside', 'forest', 'city'].indexOf(street)) % 2 ? 'vacant-brick' : 'vacant-blue';
}
export function styleStreetShop(button: HTMLElement, street: LocationId, business: Business, plot = '01'): void {
  const asset = streetShopAsset(street, business, plot), anchor = painted?.anchor(asset) ?? anchors[asset];
  button.dataset.storefront = asset;
  // Metadata records 2x sizes; CSS chooses a single integer scale for the viewport.
  for (const [key, value] of Object.entries({ 'shop-width': anchor.width, 'shop-height': anchor.height, 'sign-y': anchor.signY, 'door-x': anchor.doorX })) button.style.setProperty(`--${key}`, `${value / 2}px`);
}
/** Approved complete storefronts already contain their own displays. Never overlay old goods/windows. */
export function streetShopArt(street: LocationId, business: Business, status: 'sale' | 'vacant' | 'building' | 'open', plot = '01'): string {
  return `${approvedSprite(streetShopAsset(street, business, plot), 'street-building')}
    ${status === 'building' ? `<span class="street-construction">${streetSprite('ladder', 'street-ladder')}<i class="street-hoarding"></i>${streetSprite('barrier', 'street-barrier')}</span>` : ''}`;
}
/** Scenery contains no foreground buildings or baked pedestrians; population remains bounded. */
export function streetSceneryArt(): string {
  // Seven world-space anchors cover both five-lot streets and the six-slot home
  // street, including both edges. CSS shares the storefront pitch and pixel scale.
  return `<div class="street-depth-clouds">${[0, 1, 2, 3, 4, 5, 6].map(i => `<span class="street-depth-section" style="--section:${i}">${approvedSprite(i % 2 ? 'depth-cloud-small' : 'cloud', `street-depth-cloud${i % 2 ? ' street-depth-cloud-small' : ''}`)}</span>`).join('')}</div><div class="street-hills"></div>
    <div class="street-depth" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6].map(i => `<span class="street-depth-section" style="--section:${i}">
      ${approvedSprite(i % 3 === 1 ? 'depth-town' : 'depth-hamlet', `street-depth-town${i % 3 === 1 ? '' : ' street-depth-hamlet'}`)}
      ${approvedSprite('depth-hedge', 'street-depth-hedge')}
      ${approvedSprite('depth-tree', 'street-depth-tree')}
    </span>`).join('')}</div>
    <div class="street-furniture">${[0, 1, 2, 3, 4].map(i => `<span class="street-bench" style="--gap:${i}">${approvedSprite('bench')}</span><span class="street-lamp" style="--gap:${i}">${approvedSprite('lamp')}</span>`).join('')}</div>
    <div class="street-neighbors">${[0, 1, 2, 3, 4, 5].map(i => `<span class="street-walker walker-${i}" style="--guest:url('${streetSpriteUrl(`guest-${i % 4}`)}');--section:${i};--start:${130 + i * 340}px;--delay:-${i * 4}s"><i></i></span>`).join('')}</div>`;
}
