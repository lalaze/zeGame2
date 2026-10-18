import { remapTextile } from './textile-styles';
import type { AreaId } from '../game/regions';
import { artRamp } from './main-room-surfaces';
import { registerFineSpriteArt } from './fine-sprite-art';
import { worldSpriteArt } from './world-art-grid';
import { isDiningTableSprite } from './cozy-seating-art';
import { TEXTILE_COLORS } from './textile-styles';

const variants = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

export function remapTablecloth(pixels: Uint8ClampedArray, width: number, height: number, area: AreaId): void {
  if (area === 'main' || area === 'kitchen') return;
  const colors = artRamp(area === 'reading' ? 'cloth-7' : area === 'greenhouse' ? 'sage' : 'cloth-1');
  const trim = artRamp('gingham');
  for (let row = 0; row < height * .76; row++) for (let col = 0; col < width; col++) {
    const offset = (row * width + col) * 4;
    const red = pixels[offset], green = pixels[offset + 1], blue = pixels[offset + 2];
    if (!pixels[offset + 3] || red - green < (area === 'reading' ? 12 : 24) || blue < green * (area === 'reading' ? .6 : .75) || green > red * (area === 'reading' ? .96 : .76)) continue;
    const level = (red + green + blue) / 3 / 255;
    const edge = col === 0 || col === width - 1 || row === 0 || row === height - 1
      || !pixels[offset - 4 + 3] || !pixels[offset + 4 + 3]
      || !pixels[offset - width * 4 + 3] || !pixels[offset + width * 4 + 3];
    const color = area === 'reading' ? edge ? trim[0] : colors[row < height * .4 ? 2 : 1] : colors[Math.min(colors.length - 1, Math.floor(level * colors.length))];
    for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16);
  }
}

export function extensionTable(source: HTMLCanvasElement, area: AreaId, style = 'tablecloth_classic'): HTMLCanvasElement {
  if(isDiningTableSprite(source)&&style==='tablecloth_classic')return source;
  if ((area === 'main' || area === 'kitchen') && style === 'tablecloth_classic') return source;
  const key = `${area}:${style}`;
  const cache = variants.get(source) ?? new Map<string, HTMLCanvasElement>();
  const existing = cache.get(key); if (existing) return existing;
  const art = worldSpriteArt(source), backing = document.createElement('canvas');
  backing.width = art.canvas.width; backing.height = art.canvas.height;
  const ctx = backing.getContext('2d')!;
  ctx.drawImage(art.canvas, 0, 0);
  const pixels = ctx.getImageData(0, 0, backing.width, backing.height);
  if (isDiningTableSprite(source)) {
    const ramp=artRamp(area==='reading'?'cloth-7':area==='greenhouse'?'sage':'cloth-1');
    const color=TEXTILE_COLORS[style]??[1,3,5].map(i=>parseInt(ramp[1].slice(i,i+2),16));
    // The new dining table has a linen inset rather than a hanging cloth.
    // Tint only its light upper surface; preserve the walnut rim and support.
    for(let row=0;row<backing.height*.45;row++)for(let col=0;col<backing.width;col++){
      const i=(row*backing.width+col)*4,[r,g,b,a]=pixels.data.subarray(i,i+4);
      if(!a||r<185||g<150||b<85||r-g>70)continue;
      const weave=style==='tablecloth_linen'&&(row+col)%3===0?.94:1;
      const shade=(r+g+b)/(3*220)*weave;
      for(let channel=0;channel<3;channel++)pixels.data[i+channel]=Math.min(255,Math.round(color[channel]*shade));
    }
  } else if (style === 'tablecloth_classic') remapTablecloth(pixels.data, backing.width, backing.height, area);
  else remapTextile(pixels.data, backing.width, backing.height, style, true);
  ctx.putImageData(pixels, 0, 0);
  const logical = document.createElement('canvas'); logical.width = source.width; logical.height = source.height;
  registerFineSpriteArt(logical, backing, art.density);
  cache.set(key, logical); variants.set(source, cache);
  return logical;
}
