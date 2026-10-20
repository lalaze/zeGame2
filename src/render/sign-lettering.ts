import zh from '../locales/zh.json';
import { glyph, FONT_CHARS } from './font';

/** Native Unicode lettering, measured rather than horizontally stretched. */
export function fitSignLabel(text: string, maxWidth: number, measure: (text: string) => number): string {
  const units = [...text.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 20);
  const full = units.join('');
  if (measure(full) <= maxWidth) return full;
  while (units.length && measure(units.join('') + '…') > maxWidth) units.pop();
  return units.length ? units.join('') + '…' : '';
}
export function paintSignText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number,
  width: number, height: number, color: string): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - width / 2, y, width, height); ctx.clip();
  ctx.font = Math.max(5, height - 1) + 'px "Pixel ZH", "Pixelify Sans", sans-serif';
  // optimizeSpeed turns off ligatures: Pixelify Sans draws fi/fl as an "A"-like glyph.
  if ('textRendering' in ctx) ctx.textRendering = 'optimizeSpeed';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  const label = fitSignLabel(text, width - 2, value => ctx.measureText(value).width);
  ctx.fillText(label, cx, y + height / 2);
  ctx.restore();
}

// Main-room labels are binary masks. Platform fallback is explicitly allowed for
// characters outside the bundled pixel subset; no text is replaced by hex codes.
const chinese = new Set([...Object.values(zh).join('')]);
const latin = new Set(FONT_CHARS.flatMap(c => [c, c.toLowerCase()]));
export interface SignMask { width: number; height: number; bits: Uint8Array }
const masks = new Map<string, SignMask>();
function pixelFontReady(): boolean {
  if (typeof document === 'undefined' || !document.fonts?.[Symbol.iterator]) return false;
  return [...document.fonts].some(face => face.family.replace(/["']/g, '') === 'Pixel ZH' && face.status === 'loaded');
}
/** Also forms part of BOTH room layer signatures, including when the game is paused. */
export const signFontRevision = () => pixelFontReady() ? 'pixel-ready' : 'platform';
export async function loadSignFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  // A failed download uses the legible platform mask rather than blocking the game.
  await document.fonts.load('12px "Pixel ZH"').catch(() => []);
}
function replacementMask(): SignMask {
  const g = glyph('?'), bits = new Uint8Array(12 * 12);
  for (let p = 0; p < g.bits.length; p++) if (g.bits[p] === '1')
    bits[(2 + Math.floor(p / g.w) * 2) * 12 + 3 + (p % g.w) * 2] = 1;
  return { width: 12, height: 12, bits };
}
function rasterMask(ch: string, pixel: boolean): SignMask {
  if (typeof document === 'undefined') return replacementMask();
  const c = document.createElement('canvas'); c.width = 24; c.height = 32;
  const ctx = c.getContext('2d');
  if (!ctx || typeof ctx.getImageData !== 'function') return replacementMask();
  ctx.font = pixel ? '12px "Pixel ZH"' : '12px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#ffffff';
  ctx.fillText(ch, 4, 20);
  const data = ctx.getImageData(0, 0, 24, 32).data;
  let left = 24, top = 32, right = 0, bottom = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 24; x++) if (data[(y * 24 + x) * 4 + 3] >= 128) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  if (left === 24) return pixel ? rasterMask(ch, false) : replacementMask();
  const bits = new Uint8Array(12 * 12);
  // Crop ink bearings, retaining all native strokes; the larger scratch canvas
  // prevents ascenders/descenders being clipped before the 12px cell is made.
  const dx = Math.max(0, Math.floor((12 - (right - left)) / 2));
  const dy = Math.max(0, Math.floor((12 - (bottom - top)) / 2));
  for (let y = 0; y < Math.min(12, bottom - top); y++) for (let x = 0; x < Math.min(12, right - left); x++)
    bits[(y + dy) * 12 + x + dx] = data[((y + top) * 24 + x + left) * 4 + 3] >= 128 ? 1 : 0;
  return { width: 12, height: 12, bits };
}
export function pixelSignGlyph(ch: string): SignMask {
  const key = `${signFontRevision()}:${ch}`;
  const old=masks.get(key); if(old)return old;
  let mask: SignMask;
  if(ch==='…') { const bits=new Uint8Array(10*12);for(const x of [1,4,7])bits[9*10+x]=1;mask={width:10,height:12,bits}; }
  else if(latin.has(ch) || (ch !== ch.normalize('NFD')[0] && latin.has(ch.normalize('NFD')[0]))) {
    const base=ch.normalize('NFD')[0], g=glyph(base), width=g.w*2, height=12, bits=new Uint8Array(width*height);
    for(let p=0;p<g.bits.length;p++)if(g.bits[p]==='1')for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)bits[(2+Math.floor(p/g.w)*2+dy)*width+(p%g.w)*2+dx]=1;
    if(ch!==base) {
      const mark=ch.normalize('NFD').slice(1), center=Math.floor(width/2);
      const accents:Record<string,number[][]>={
        '\u0301':[[center+1,0],[center,1]], '\u0300':[[center-1,0],[center,1]],
        '\u0302':[[center,0],[center-1,1],[center+1,1]], '\u0308':[[center-1,0],[center+1,0]],
        '\u0303':[[center-1,0],[center,0],[center+1,1]], '\u030a':[[center,0],[center-1,1],[center+1,1]],
      };
      if(!accents[mark]) return rasterMask(ch, false);
      for(const [x,y] of accents[mark])bits[y*width+x]=1;
    }mask={width,height,bits};
  } else { mask = rasterMask(ch, chinese.has(ch) && pixelFontReady()); }
  // User-entered names cannot grow a process-lifetime cache without bound.
  if(masks.size>=512)masks.delete(masks.keys().next().value!);
  masks.set(key,mask);
  return mask;
}
/** Width of pixel sign lettering at the drawer's half-scale pen, in logical units. */
export const pixelSignWidth = (text: string, scale = 1): number =>
  (Math.max(0, [...text].reduce((sum, ch) => sum + pixelSignGlyph(ch).width + 1, 0) - 1) / 2) * scale;

/**
 * Draws small pixel lettering centred in its box. `scale` shrinks the glyph grid
 * (0.5 = the original half-scale pen) so a crowded row can stay whole instead of
 * losing characters to an ellipsis; the fitted label is measured at the same scale.
 */
export function paintPixelSignText(ctx:CanvasRenderingContext2D,text:string,cx:number,y:number,width:number,height:number,color:string,scale=1):void {
  const measure=(value:string)=>pixelSignWidth(value,scale);
  const label=fitSignLabel(text,width-1,measure);
  let left=Math.round((cx-measure(label)/2)*2)/2;
  const top=Math.round((y+(height-6*scale)/2)*2)/2;
  ctx.save();ctx.beginPath();ctx.rect(Math.round((cx-width/2)*2)/2,y,width,height);ctx.clip();ctx.fillStyle=color;
  for(const ch of label){const mask=pixelSignGlyph(ch);for(let row=0;row<mask.height;row++)for(let col=0;col<mask.width;col++)if(mask.bits[row*mask.width+col])ctx.fillRect(left+col/2*scale,top+row/2*scale,.5*scale,.5*scale);left+=(mask.width+1)/2*scale;}
  ctx.restore();
}
