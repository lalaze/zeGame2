import { describe, expect, it } from 'vitest';
import { paintKitchen } from './kitchen-art';
import { FLOOR_Y } from '../game/layout';
import type { Equipment, Station } from '../game/kitchen';

type Rect = [number, number, number, number, string];
function render(locked: boolean, installed: ReadonlySet<Equipment>, active: ReadonlySet<Station> = new Set()) {
  const rectangles: Rect[] = [];
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    fillRect(this: { fillStyle: string }, x: number, y: number, w: number, h: number) { rectangles.push([x, y, w, h, this.fillStyle]); },
    save() {}, restore() {},
  } as unknown as CanvasRenderingContext2D;
  paintKitchen(ctx, 184, 0, locked, installed, active);
  return rectangles;
}

describe('unbuilt kitchen shell', () => {
  it('never renders fitted appliances even when stale equipment or active stations are supplied', () => {
    const empty = render(true, new Set());
    const stale = render(true, new Set<Equipment>(['cooler', 'dryStore', 'handSink', 'deckOven', 'mixer', 'fryer']), new Set<Station>(['deckOven', 'mixer', 'fryer']));
    expect(stale).toEqual(empty);
    // Bare plaster and packed materials replace subway tiles, drain, mats and fittings.
    expect(empty).toContainEqual([0, 0, 320, FLOOR_Y, '#c4b7a5']);
    expect(empty.some(rect => rect[4] === '#eef0ea')).toBe(false);
    expect(empty.length).toBeLessThan(300);
  });
  it('renders the fitted kitchen only after purchase', () => {
    const built = render(false, new Set<Equipment>(['cooler', 'dryStore', 'handSink']));
    expect(built.some(rect => rect[4] === '#eef0ea')).toBe(true);
    expect(built.length).toBeGreaterThan(render(true, new Set()).length);
  });
});
