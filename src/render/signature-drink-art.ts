import type { IngredientId } from '../game/data';
import { signatureDefinition, BASE_INGREDIENT } from '../game/signature-drinks';

export type SignatureArtKey = IngredientId | 'coffee';
const ink = '#49382e';
const rect = (x: number, y: number, w: number, h: number, color: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
/** Tiny original pixel illustrations, without fonts, external assets or a canvas dependency. */
export function signatureDrinkArt(key: SignatureArtKey): string {
  let art = '';
  const r = (x: number, y: number, w: number, h: number, color: string) => { art += rect(x, y, w, h, color); };
  if (key === 'coffee' || key === 'beans') {
    if (key === 'coffee') {
      r(4, 8, 14, 12, ink); r(6, 10, 10, 8, '#b98e64'); r(6, 10, 10, 3, '#5b3427');
      r(18, 10, 4, 7, ink); r(18, 12, 2, 3, '#faf1d9'); r(3, 21, 17, 2, ink); r(8, 3, 2, 3, '#b9ac91'); r(13, 1, 2, 5, '#b9ac91');
    } else { r(5, 5, 6, 12, ink); r(3, 7, 10, 8, '#886448'); r(7, 6, 2, 10, ink); r(15, 10, 6, 10, '#654b39'); r(17, 11, 2, 8, '#c49262'); }
  } else if (key === 'milk') {
    r(7, 2, 9, 3, '#759bb1'); r(5, 5, 13, 17, ink); r(7, 7, 9, 13, '#fff9e5'); r(7, 7, 9, 4, '#93b5c5'); r(10, 13, 4, 5, '#93b5c5');
  } else if (key === 'tea' || key === 'matcha') {
    r(3, 11, 18, 7, ink); r(5, 13, 14, 6, key === 'tea' ? '#c58b3d' : '#7e9d48'); r(5, 19, 14, 2, ink); r(8, 21, 8, 2, ink);
    r(9, 3, 7, 3, '#66865c'); r(7, 6, 7, 3, '#8bac68'); r(10, 4, 2, 7, '#446849');
  } else if (key === 'fruit') {
    r(10, 2, 2, 5, '#66865c'); r(12, 2, 6, 3, '#8bac68'); r(4, 7, 16, 11, '#b63e4b'); r(6, 5, 12, 16, '#df6172'); r(6, 8, 3, 5, '#f9a68c'); r(9, 20, 7, 2, ink);
  } else if (key === 'sugar') {
    r(3, 10, 10, 11, ink); r(5, 12, 6, 7, '#fffdf2'); r(11, 4, 10, 11, ink); r(13, 6, 6, 7, '#f4e5bb'); r(5, 12, 6, 2, '#d8ccb0');
  } else if (key === 'spice') {
    r(4, 4, 5, 17, '#915537'); r(6, 5, 2, 15, '#cf9060'); r(12, 8, 5, 13, '#aa633b'); r(14, 9, 2, 11, '#e1a064'); r(17, 3, 3, 3, '#cc9a47');
  } else if (key === 'cocoa') {
    r(4, 3, 16, 19, ink); r(6, 5, 12, 15, '#6c4031'); for (const x of [7, 13]) for (const y of [6, 11, 16]) r(x, y, 4, 3, '#a56a48');
  } else if (key === 'cream') {
    r(4, 17, 16, 5, '#93b5c5'); r(6, 11, 12, 6, '#e0c99a'); r(8, 7, 8, 6, '#fff9e5'); r(11, 3, 4, 5, '#fff9e5'); r(5, 16, 14, 2, '#fff9e5');
  } else { r(6, 5, 12, 17, '#dfbf8f'); r(8, 7, 8, 11, '#faf1d9'); r(9, 2, 6, 4, ink); }
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" shape-rendering="crispEdges">${art}</svg>`)}`;
}

const canvasCache = new Map<string, HTMLCanvasElement>();
/** Synchronous matching pixel art for Phaser/menu sprite paths.
 * Stable identity matters: Phaser retains a texture for each source canvas. */
export function signatureDrinkCanvas(id: string, density = 1): HTMLCanvasElement {
  return paintSignature(id, density, false);
}
/** Order bubbles have an 18px content box, including addon marks. */
export function signatureDrinkIcon(id: string): HTMLCanvasElement {
  return paintSignature(id, 1, true);
}
function paintSignature(id: string, density: number, compact: boolean): HTMLCanvasElement {
  const def = signatureDefinition(id);
  const scale = Number.isFinite(density) ? Math.max(1, Math.min(16, Math.floor(density))) : 1;
  const key = `${def?.id ?? 'invalid'}.${scale}.${compact ? 'icon' : 'art'}`;
  const existing = canvasCache.get(key); if (existing) return existing;
  const canvas = document.createElement('canvas');
  const side = compact ? 18 : 32; canvas.width = side * scale; canvas.height = side * scale;
  canvasCache.set(key, canvas);
  const context = canvas.getContext('2d');
  if (!context || !def) return canvas;
  context.imageSmoothingEnabled = false;
  function draw(key: SignatureArtKey, x: number, y: number, size: number): void {
    const svg = decodeURIComponent(signatureDrinkArt(key).split(',')[1]);
    for (const match of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[a-fA-F0-9]+)"\/>/g)) {
      context!.fillStyle = match[5];
      const px = (v: number) => Math.round(v * scale);
      context!.fillRect(px(x + Number(match[1]) * size / 24), px(y + Number(match[2]) * size / 24), Math.max(scale, px(Number(match[3]) * size / 24)), Math.max(scale, px(Number(match[4]) * size / 24)));
    }
  }
  draw(def.base, compact ? 2 : 4, 0, compact ? 14 : 24);
  const addons = Object.keys(def.recipe).filter(key => key !== BASE_INGREDIENT[def.base]) as IngredientId[];
  addons.forEach((key, index) => draw(key, compact ? index * 6 : 2 + index * 10, compact ? 12 : 22, compact ? 6 : 10));
  return canvas;
}
