import { describe, expect, it } from 'vitest';
import { MAIN_CUPBOARDS, BACK_BAR, COUNTER, WINDOWS } from '../game/layout';
import { RoomPainter } from './room-art';

describe('removed right-window service cupboard', () => {
  it('leaves no invisible cupboard obstacle', () => { expect(MAIN_CUPBOARDS).toEqual([]); });
  it.each([1, 2, 3])('draws neither cabinet nor floating bottle/cups at density %i', density => {
    const ctx = new Proxy({}, { get(_target, key) { throw new Error('Unexpected paint: ' + String(key)); } });
    const painter = new RoomPainter(ctx as CanvasRenderingContext2D, density, false);
    for (const finish of ['counter_oak', 'counter_white', 'counter_dark']) painter.drawServiceCupboards(finish);
  });
  it('preserves the back bar, serving counter, and window bays', () => {
    expect(BACK_BAR).toEqual({ x: 72, w: 182, top: 57, front: 63 });
    expect(COUNTER).toEqual({ x: 64, w: 170, top: 96, front: 107, bottom: 127 });
    expect(WINDOWS).toHaveLength(2);
  });
});
