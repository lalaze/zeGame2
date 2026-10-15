import { describe, expect, it } from 'vitest';
import { RoomPainter } from './room-art';
import { CafeView } from './cafe-view';

describe('quiet unbuilt table spots', () => {
  it.each([1, 2, 3])('paints no plaque, glyph, or corner brackets at density %i', density => {
    const ctx = new Proxy({}, { get(_target, key) { throw Error('Unexpected paint: ' + String(key)); } });
    new RoomPainter(ctx as CanvasRenderingContext2D, density, false).drawUnbuilt(100, 100);
  });
  it('does not request a table preview by default', () => {
    expect(new CafeView().tablePreview).toBe(false);
  });
});
