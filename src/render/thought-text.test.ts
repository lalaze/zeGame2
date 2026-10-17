import { describe, expect, it, vi } from 'vitest';
import { alphaInkBounds, centerInk, thoughtTextRaster } from './thought-text';

function pixels(width: number, height: number, points: [number, number, number][]) {
  const data = new Uint8ClampedArray(width * height * 4);
  points.forEach(([x,y,alpha]) => { data[(y*width+x)*4+3]=alpha; });
  return data;
}
describe('actual thought glyph ink bounds', () => {
  it('ignores transparent font padding and includes antialiased fringe pixels', () => {
    expect(alphaInkBounds(pixels(12,30,[[3,9,1],[7,12,255],[4,19,2]]),12,30)).toEqual({top:9,bottom:19});
  });
  it('measures the whole multiline ink block including descenders on its last line', () => {
    expect(alphaInkBounds(pixels(20,50,[[2,8,255],[6,16,255],[4,22,255],[8,33,255]]),20,50)).toEqual({top:8,bottom:33});
  });
  it('returns no ink for blank input rather than scanning unrelated RGB values', () => {
    const blank=new Uint8ClampedArray(4*10*10); blank[0]=255;
    expect(alphaInkBounds(blank,10,10)).toBeNull();
  });
});
describe('equal top and bottom ink padding', () => {
  it.each([
    {top:13,bottom:23,min:22}, // CJK-like full-height ink
    {top:16,bottom:23,min:22}, // capitals
    {top:16,bottom:26,min:22}, // lowercase descenders
    {top:13,bottom:37,min:36}, // two full-height lines
    {top:17,bottom:40,min:36}, // mixed-case multiline
    {top:0,bottom:39,min:36}, // oversized fallback glyphs
  ])('centers actual bounds $top–$bottom without clipping', ({top,bottom,min}) => {
    const p=centerInk({top,bottom},min);
    expect(p.sourceY).toBe(top);expect(p.inkHeight).toBe(bottom-top+1);
    expect(p.paddingTop).toBe(p.paddingBottom);
    expect(p.textY).toBe(p.height-(p.textY+p.inkHeight));
    expect(Number.isInteger(p.textY)).toBe(true);expect(p.textY).toBeGreaterThanOrEqual(4);
    expect(p.height).toBeGreaterThanOrEqual(min);
  });
  it('changes body height by at most one pixel when its existing padding is sufficient', () => {
    for(let inkHeight=1;inkHeight<=14;inkHeight++) {
      const p=centerInk({top:24-inkHeight,bottom:23},22);
      expect(p.height).toBeGreaterThanOrEqual(22);expect(p.height).toBeLessThanOrEqual(23);
    }
  });
});

describe('native thought lettering raster', () => {
  it('paints binary one-art-pixel glyphs at density two without canvas fillText', () => {
    const rectangles: number[][] = [];
    const fillText = vi.fn();
    vi.stubGlobal('document', { fonts: new Set(), createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => ctx };
      const ctx = {
        fillStyle: '', fillText,
        fillRect(x: number, y: number, w: number, h: number) { rectangles.push([x, y, w, h]); },
        getImageData() {
          const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
          for (const [x, y] of rectangles) data[(y * canvas.width + x) * 4 + 3] = 255;
          return { data };
        },
      };
      return canvas;
    } });
    try {
      const result = thoughtTextRaster(['My little café dream', 'Hello!'], '', 100);
      expect(result.canvas.width).toBe(200);
      expect(rectangles.length).toBeGreaterThan(100);
      expect(rectangles.every(rect => rect.every(Number.isInteger) && rect[2] === 1 && rect[3] === 1)).toBe(true);
      expect(fillText).not.toHaveBeenCalled();
      expect(result.textY).toBe((result.height - result.inkHeight / 2) / 2);
    } finally { vi.unstubAllGlobals(); }
  });
});
