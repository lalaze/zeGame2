// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { itemIcon, itemArtwork } from './sprites';
import { signatureDrinkArt, signatureDrinkCanvas, signatureDrinkIcon, type SignatureArtKey } from './signature-drink-art';
describe('signature drink pixel illustrations', () => {
  it('gives every base and add-on a distinct self-contained pixel silhouette', () => {
    const keys: SignatureArtKey[] = ['coffee', 'tea', 'milk', 'fruit', 'sugar', 'spice', 'cocoa', 'cream', 'matcha'];
    const urls = keys.map(signatureDrinkArt);
    expect(new Set(urls).size).toBe(keys.length);
    for (const url of urls) {
      expect(url.startsWith('data:image/svg+xml,')).toBe(true);
      const svg = decodeURIComponent(url.split(',')[1]);
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).not.toMatch(/<script|<text|<image|foreignObject/);
      expect(svg).toContain('<rect');
    }
  });
});

it('paints matching base plus addon pixels synchronously at requested density', () => {
  const context = { fillStyle: '', fillRect: vi.fn(), imageSmoothingEnabled: true };
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const base = signatureDrinkCanvas('sig:coffee:beans=1', 2); const baseCalls = context.fillRect.mock.calls.length;
  expect(base.width).toBe(64); expect(base.height).toBe(64); expect(baseCalls).toBeGreaterThan(0);
  context.fillRect.mockClear();
  signatureDrinkCanvas('sig:coffee:beans=1,milk=1,sugar=1', 2);
  expect(context.fillRect.mock.calls.length).toBeGreaterThan(baseCalls);
  expect(context.imageSmoothingEnabled).toBe(false); spy.mockRestore();
});

it('reuses canvas identity for live icons and artwork without overflowing order bubbles', () => {
  const context = { fillStyle: '', fillRect: vi.fn(), imageSmoothingEnabled: true };
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const id = 'sig:tea:milk=1,spice=1,tea=1' as const;
  const icon = itemIcon(id); const artwork = itemArtwork(id);
  expect(icon.width).toBe(18); expect(icon.height).toBe(18); expect(artwork.width).toBe(96);
  const calls = context.fillRect.mock.calls.length;
  for (let i = 0; i < 100; i++) {
    expect(itemIcon(id)).toBe(icon); expect(itemIcon(id, false)).toBe(icon);
    expect(signatureDrinkIcon(id)).toBe(icon); expect(itemArtwork(id)).toBe(artwork);
    expect(signatureDrinkCanvas(id, 3)).toBe(artwork);
  }
  expect(context.fillRect.mock.calls.length).toBe(calls); spy.mockRestore();
});
