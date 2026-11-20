import type { LocationId } from '../game/locations';
import type { RegionId } from '../game/regions';
import anchors from '../../public/art/street-art-v2/anchors.json';

const base = import.meta.env.BASE_URL;
// CSS custom properties resolve against the stylesheet: use document-absolute URLs.
export const streetSpriteUrl = (name: string) => new URL(`${base}art/street-scene/${name}.webp`, document.baseURI).href;
const approvedUrl = (name: string) => new URL(`${base}art/street-art-v2/${name}.webp`, document.baseURI).href;
export const streetSprite = (name: string, className = '') => `<img class="${className}" src="${streetSpriteUrl(name)}" alt="" draggable="false" decoding="async">`;
const approvedSprite = (name: string, className = '') => `<img class="${className}" src="${approvedUrl(name)}" alt="" draggable="false" decoding="async">`;
type Business = RegionId | 'cafe' | null;
/** Stable per address, independent of owned count, selected street and save migration. */
export function streetShopAsset(street: LocationId, business: Business, plot = '01'): keyof typeof anchors {
  if (business) return ({ cafe: 'cafe', reading: 'bookshop', greenhouse: 'plant-shop', terrace: 'florist', workshop: 'pottery', observatory: 'tea-shop' } as const)[business];
  return (Number(plot) + ['town', 'flowers', 'seaside', 'forest', 'city'].indexOf(street)) % 2 ? 'vacant-brick' : 'vacant-blue';
}
export function styleStreetShop(button: HTMLElement, street: LocationId, business: Business, plot = '01'): void {
  const asset = streetShopAsset(street, business, plot), anchor = anchors[asset];
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
  return `${[0, 1, 2].map(i => approvedSprite('cloud', `street-cloud cloud-${i}`)).join('')}
    <div class="street-hills"></div><div class="street-distant">${[0, 1, 2, 3, 4].map(i => approvedSprite('town', `street-village village-${i}`)).join('')}</div>
    <div class="street-furniture">${[0, 1, 2, 3, 4].map(i => `<span class="street-bench" style="--gap:${i}">${approvedSprite('bench')}</span><span class="street-lamp" style="--gap:${i}">${approvedSprite('lamp')}</span>`).join('')}</div>
    <div class="street-neighbors">${[0, 1, 2, 3, 4, 5].map(i => `<span class="street-walker walker-${i}" style="--guest:url('${streetSpriteUrl(`guest-${i % 4}`)}');--start:${130 + i * 340}px;--delay:-${i * 4}s"><i></i></span>`).join('')}</div>`;
}
