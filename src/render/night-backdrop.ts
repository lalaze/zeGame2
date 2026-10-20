// The extension rooms' backdrops are single paintings with a daytime sky. After dark
// that sky is found once by colour and repainted as night, on the art grid, so the
// view through the glass agrees with the main room's windows.
import { mix } from './color';
import { resampleImage } from './world-art-grid';
import { SCENE_W } from '../game/layout';

const SKY = 1, CLOUD = 2, CANDIDATE = 3;
const NIGHT_TOP = '#141a3c', NIGHT_HORIZON = '#2c3466';
const CLOUD_SHADE = '#262e5a', CLOUD_LIT = '#454f82';

/** Open sky: bright and blue, with more green than red so violets stay flowers. */
export const isSkyBlue = (r: number, g: number, b: number) => b >= 150 && b > r + 30 && b >= g && g > r;
/** Painted clouds include warm ivory highlights as well as cool white shading. */
export const isCloudLike = (r: number, g: number, b: number) => r >= 170 && g >= 185 && b >= 200 && b >= r - 28;

/** Marks each pixel as sky, cloud (touching the sky) or neither. */
export function nightSkyMask(data: ArrayLike<number>, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    if (data[p + 3] > 0 && isSkyBlue(data[p], data[p + 1], data[p + 2])) mask[i] = SKY;
  }

  // Tiny ivory petals can touch the sky too. Require a connected cloud patch of
  // at least five room pixels, with the same area threshold at every art density.
  const minCloudPixels = Math.max(1, Math.round(5 * (width / SCENE_W) ** 2));
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    if (mask[i] || !data[p + 3] || !isCloudLike(data[p], data[p + 1], data[p + 2])) continue;
    const patch = [i];
    mask[i] = CANDIDATE;
    let joinsSky = false;
    for (let j = 0; j < patch.length; j++) {
      const pixel = patch[j], x = pixel % width;
      for (const n of [x > 0 ? pixel - 1 : -1, x < width - 1 ? pixel + 1 : -1, pixel - width, pixel + width]) {
        if (n < 0 || n >= mask.length) continue;
        if (mask[n] === SKY) joinsSky = true;
        if (mask[n]) continue;
        const q = n * 4;
        if (data[q + 3] > 0 && isCloudLike(data[q], data[q + 1], data[q + 2])) { mask[n] = CANDIDATE; patch.push(n); }
      }
    }
    if (joinsSky && patch.length >= minCloudPixels) for (const pixel of patch) mask[pixel] = CLOUD;
  }
  for (let i = 0; i < mask.length; i++) if (mask[i] === CANDIDATE) mask[i] = 0;
  return mask;
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
/** A few fixed stars in open sky, away from cloud edges. */
const star = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/**
 * Night pixels for the masked sky; everything else becomes transparent, so the layer
 * can be laid over the painting at any strength.
 */
export function paintNightSky(data: Uint8ClampedArray, width: number, height: number, mask: Uint8Array): void {
  for (let y = 0; y < height; y++) {
    const sky = rgb(mix(NIGHT_TOP, NIGHT_HORIZON, y / Math.max(1, height - 1)));
    for (let x = 0; x < width; x++) {
      const i = y * width + x, p = i * 4;
      if (!mask[i]) { data[p + 3] = 0; continue; }
      let color = sky;
      if (mask[i] === CLOUD) {
        // Clouds keep their painted shading as dim moonlit shapes.
        const light = Math.max(0, Math.min(1, (data[p] + data[p + 1] + data[p + 2] - 555) / 200));
        color = rgb(mix(CLOUD_SHADE, CLOUD_LIT, light));
      } else if (y < height * .7 && star(x, y) % 211 === 0 && [i - 1, i + 1, i - width, i + width].every(n => mask[n] === SKY)) {
        color = star(y, x) % 3 ? rgb('#aeb6dc') : rgb('#fff6c8');
      }
      data[p] = color[0]; data[p + 1] = color[1]; data[p + 2] = color[2]; data[p + 3] = 255;
    }
  }
}

const nights = new WeakMap<HTMLCanvasElement, HTMLCanvasElement | null>();

/**
 * The night sky for a backdrop drawn at `width`×`height` room pixels on `ctx`: a layer
 * exactly the size of the art pixels it covers, or null where pixels can't be read.
 */
export function nightBackdrop(ctx: CanvasRenderingContext2D, source: CanvasImageSource & { width: number; height: number }, width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || typeof ctx.getTransform !== 'function') return null;
  const m = ctx.getTransform();
  const tw = Math.round(width * Math.abs(m.a)), th = Math.round(height * Math.abs(m.d));
  const image = typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement;
  const sw = image ? source.naturalWidth : source.width, sh = image ? source.naturalHeight : source.height;
  if (tw <= 0 || th <= 0 || sw <= 0 || sh <= 0) return null;
  const day = resampleImage(source, 0, 0, sw, sh, Math.min(tw, sw), Math.min(th, sh));
  if (nights.has(day)) return nights.get(day)!;
  let night: HTMLCanvasElement | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = day.width; canvas.height = day.height;
    const layer = canvas.getContext('2d', { willReadFrequently: true });
    if (layer) {
      layer.drawImage(day, 0, 0);
      const pixels = layer.getImageData(0, 0, canvas.width, canvas.height);
      paintNightSky(pixels.data, canvas.width, canvas.height, nightSkyMask(pixels.data, canvas.width, canvas.height));
      layer.putImageData(pixels, 0, 0);
      night = canvas;
    }
  } catch {
    // Pixel reads can be restricted; the room keeps its dimmed painted sky.
  }
  nights.set(day, night);
  return night;
}
