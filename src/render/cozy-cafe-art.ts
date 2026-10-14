import { generatedMainSource } from './generated-main-art';
import { registerFineSpriteArt } from './fine-sprite-art';

export type CozyCafePart = 'table' | 'chair' | 'cabinet' | 'window';
const PARTS: readonly CozyCafePart[] = ['table', 'chair', 'cabinet', 'window'];
const DENSITY = 3;
type Source = NonNullable<ReturnType<typeof generatedMainSource>>;
let current: Source | undefined;
const crops = new Map<CozyCafePart, HTMLCanvasElement>();
const sprites = new Map<string, HTMLCanvasElement>();

/** Decode one coherent image-generated family once per scene load, preserving alpha. */
export function cozyCafePart(part: CozyCafePart): HTMLCanvasElement | undefined {
  const source = generatedMainSource('cozy-cafe-atlas');
  if (!source) { current = undefined; crops.clear(); sprites.clear(); return undefined; }
  if (current !== source) {
    current = source; crops.clear(); sprites.clear();
    const full = document.createElement('canvas'); full.width = source.width; full.height = source.height;
    const ctx = full.getContext('2d')!; ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, full.width, full.height).data;
    PARTS.forEach((id, i) => {
      const left = Math.floor(i % 2 * full.width / 2), right = Math.floor((i % 2 + 1) * full.width / 2);
      const top = Math.floor(Math.floor(i / 2) * full.height / 2), bottom = Math.floor((Math.floor(i / 2) + 1) * full.height / 2);
      let x0 = right, y0 = bottom, x1 = left - 1, y1 = top - 1;
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        if (pixels[(y * full.width + x) * 4 + 3] < 100) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      if (x1 < x0 || y1 < y0) return;
      const crop = document.createElement('canvas'); crop.width = x1 - x0 + 1; crop.height = y1 - y0 + 1;
      crop.getContext('2d')!.drawImage(full, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
      crops.set(id, crop);
    });
  }
  return crops.get(part);
}

/** Fixed logical envelopes retain seated hips, foot positions and simulation collisions. */
export function cozyCafeSprite(part: 'table' | 'chair', mirror = false): HTMLCanvasElement | undefined {
  const source = cozyCafePart(part); if (!source) return undefined;
  const key = `${part}:${mirror}`, cached = sprites.get(key); if (cached) return cached;
  const w = part === 'table' ? 38 : 20, h = part === 'table' ? 29 : 27;
  const backing = document.createElement('canvas'); backing.width = w * DENSITY; backing.height = h * DENSITY;
  const ctx = backing.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  if (mirror) { ctx.translate(backing.width, 0); ctx.scale(-1, 1); }
  const scale = Math.min(w / source.width, h / source.height);
  const dw = source.width * scale, dh = source.height * scale;
  ctx.drawImage(source, (w - dw) / 2 * DENSITY, (h - dh) * DENSITY, dw * DENSITY, dh * DENSITY);
  const logical = document.createElement('canvas'); logical.width = w; logical.height = h;
  logical.getContext('2d')!.drawImage(backing, 0, 0, w, h);
  registerFineSpriteArt(logical, backing, DENSITY); sprites.set(key, logical); return logical;
}

/** Panel front and countertop stay separate so stock, cups and baristas remain live. */
export function paintCozyCabinet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, topH: number, frontH: number): boolean {
  const source = cozyCafePart('cabinet'); if (!source) return false;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const count = Math.max(1, Math.round(w / 28)), span = w / count;
  // Each module fits its established footprint. Only the cabinet front is reused;
  // one continuous solid worktop avoids repeated gaps between modular tops.
  for (let i = 0; i < count; i++) {
    ctx.drawImage(source, 0, source.height * .18, source.width * .86, source.height * .82,
      x + i * span, y + topH, span, frontH);
  }
  ctx.fillStyle = '#88512f'; ctx.fillRect(x, y, w, topH);
  ctx.fillStyle = '#b97d44'; ctx.fillRect(x + .5, y + .5, w - 1, Math.max(1, topH - 1.5));
  ctx.fillStyle = '#e5ba79'; ctx.fillRect(x + 1, y + .5, w - 2, .5);
  ctx.fillStyle = '#d49a56'; ctx.fillRect(x + .5, y + topH - 1.5, w - 1, 1);
  ctx.fillStyle = '#573724'; ctx.fillRect(x, y + topH - .5, w, 1);
  ctx.restore(); return true;
}
