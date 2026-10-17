import { describe, expect, it } from 'vitest';
import palette from '../../docs/art-grid/palette.json';
import { extensionFloor, extensionLampPool, extensionRunner, extensionWindowPatch, readingDoor, readingDoorFrame, readingFurnishing } from './extension-surfaces';
import { remapTablecloth } from './extension-table-art';
import { lightingAt, roomAmbient } from './lighting';
import { thoughtTextWidth, wrapThoughtText } from './thought-text';

function record(paint: (ctx: CanvasRenderingContext2D) => void) {
  const marks: { left: number; top: number; width: number; height: number; color: string; alpha: number }[] = [];
  const stack: number[] = [];
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    save(this: {globalAlpha: number}) { stack.push(this.globalAlpha); }, restore(this: {globalAlpha: number}) { this.globalAlpha = stack.pop()!; },
    beginPath() {}, rect() {}, clip() {},
    fillRect(this: {fillStyle: string; globalAlpha: number}, left: number, top: number, width: number, height: number) { marks.push({ left, top, width, height, color: this.fillStyle, alpha: this.globalAlpha }); },
  } as unknown as CanvasRenderingContext2D;
  paint(ctx); return marks;
}

describe('extension room native artwork', () => {
  it('uses master-palette pigment and half-room-pixel cells for every new surface', () => {
    const colors = new Set(palette.colors.map(color => color.hex));
    const marks = record(ctx => {
      for (const area of ['reading', 'greenhouse', 'terrace', 'kitchen'] as const) {
        extensionFloor(ctx, area, 80, 240);
        extensionRunner(ctx, area, 145, 80, 30, 140, 'v');
        extensionRunner(ctx, area, 0, 130, 175, 14, 'h');
      }
      readingDoor(ctx, 80);
      readingFurnishing(ctx, 'armchair', 115, 102);
      readingFurnishing(ctx, 'lamp', 100, 98);
    });
    for (const mark of marks) {
      expect(colors.has(mark.color), mark.color).toBe(true);
      for (const value of [mark.left, mark.top, mark.width, mark.height]) expect(Number.isInteger(value * 2)).toBe(true);
    }
  });
  it('keeps floor paint below the wall and uses calm tile fields, not checker fills', () => {
    for (const area of ['greenhouse', 'terrace', 'kitchen'] as const) {
      const marks = record(ctx => extensionFloor(ctx, area, 80, 240));
      expect(marks.every(mark => mark.top >= 80)).toBe(true);
      expect(new Set(marks.filter(mark => mark.width > 15 && mark.height > 15).map(mark => mark.color)).size).toBeLessThanOrEqual(2);
    }
  });
  it('has a finite header, open throat and a sill at the existing doorway', () => {
    const marks = record(ctx => readingDoor(ctx, 80));
    expect(Math.min(...marks.map(mark => mark.top))).toBe(10);
    expect(marks.some(mark => mark.left === 144 && mark.top === 18 && mark.width === 32)).toBe(true);
    expect(marks.some(mark => mark.top === 78 && mark.left === 144 && mark.width === 32)).toBe(true);
  });
  it('keeps the doorway throat behind actors and follows the outdoor night sky', () => {
    const front = record(ctx => readingDoorFrame(ctx, 80));
    expect(front.some(mark => mark.left <= 160 && mark.left + mark.width > 160 && mark.top <= 45 && mark.top + mark.height > 45)).toBe(false);
    const day = record(ctx => readingDoor(ctx, 80, lightingAt(10.5)));
    const night = record(ctx => readingDoor(ctx, 80, lightingAt(21)));
    expect(day.find(mark => mark.left === 148 && mark.top === 21)?.color).not.toBe(night.find(mark => mark.left === 148 && mark.top === 21)?.color);
    expect(night.some(mark => mark.alpha > 0 && mark.alpha < 1 && mark.left === 144)).toBe(true);
  });
  it('keeps the reading chair upholstered across its back, with a grounded base', () => {
    const marks = record(ctx => readingFurnishing(ctx, 'armchair', 115, 102));
    const back = marks.filter(mark => mark.left <= 112 && mark.left + mark.width > 112 && mark.top <= 82 && mark.top + mark.height > 82).at(-1);
    expect(back?.color).toBe(palette.colors.find(color => color.ramp === 'gingham' && color.index === 1)?.hex);
    expect(marks.some(mark => mark.alpha < 1 && mark.top >= 99)).toBe(true);
    expect(marks.some(mark => mark.color === '#e26443' && mark.top === 77)).toBe(true);
    expect(marks.some(mark => mark.color === '#8c2b20' && mark.left === 119.5)).toBe(true);
    expect(marks.some(mark => mark.color === '#42251a' && mark.height === 5)).toBe(true);
    expect(marks.every(mark => mark.left >= 103 && mark.left + mark.width <= 127)).toBe(true);
  });
  it('shades the fabric lamp with brass hardware at its existing foot and shade anchors', () => {
    const marks = record(ctx => readingFurnishing(ctx, 'lamp', 100, 98));
    expect(marks.some(mark => mark.color === '#f3bd6a' && mark.top === 96)).toBe(true);
    for (const color of ['#a28e85', '#e5d7ba', '#efdfbe']) expect(marks.some(mark => mark.color === color && mark.top < 75)).toBe(true);
    expect(marks.some(mark => mark.alpha < 1 && mark.top >= 97)).toBe(true);
    expect(Math.min(...marks.map(mark => mark.top))).toBe(65);
  });
  it('suppresses night window patches and retains the travelling sun direction', () => {
    expect(record(ctx => extensionWindowPatch(ctx, 20, 34, 80, lightingAt(21).sun))).toEqual([]);
    const morning = record(ctx => extensionWindowPatch(ctx, 20, 34, 80, lightingAt(9).sun));
    const evening = record(ctx => extensionWindowPatch(ctx, 20, 34, 80, lightingAt(16).sun));
    expect(morning.length).toBeGreaterThan(100);
    expect(morning[100].left).not.toBe(evening[100].left);
    expect(morning.every(mark => mark.top >= 80)).toBe(true);
  });
  it('uses continuous native-grid lamp falloff instead of five concentric brightness steps', () => {
    const marks = record(ctx => extensionLampPool(ctx, 14, '#ffcf7a'));
    expect(new Set(marks.map(mark => mark.alpha.toFixed(4))).size).toBeGreaterThan(100);
    expect(marks.every(mark => mark.width === .5 && mark.height === .5)).toBe(true);
  });
  it('leaves locked ambient grades unchanged and retains stronger outdoor sky exposure', () => {
    const light = lightingAt(21);
    expect(roomAmbient(light, 'terrace', true)).not.toBe(roomAmbient(light, 'terrace'));
    expect(roomAmbient(light, 'greenhouse')).not.toBe(roomAmbient(light, 'reading'));
    expect(roomAmbient(lightingAt(12), 'main')).toBe(roomAmbient(lightingAt(12), 'main', true));
  });
});

describe('geometry-preserving extension table colourways', () => {
  it('replaces red and pale check pigments with a calm cream field and silhouette trim', () => {
    const pixels = new Uint8ClampedArray(8 * 10 * 4);
    for (let row = 1; row < 7; row++) for (let col = 1; col < 7; col++) {
      pixels.set(col % 3 === 0 ? [251, 142, 97, 255] : col % 2 ? [252, 131, 101, 255] : [253, 229, 183, 255], (row * 8 + col) * 4);
    }
    const alpha = pixels.filter((_, index) => index % 4 === 3);
    remapTablecloth(pixels, 8, 10, 'reading');
    const color = (col: number, row: number) => [...pixels.slice((row * 8 + col) * 4, (row * 8 + col) * 4 + 3)];
    expect(color(2, 2)).toEqual([239, 223, 190]);
    expect(color(3, 2)).toEqual(color(2, 2));
    expect(color(2, 5)).toEqual([229, 215, 186]);
    expect(color(1, 3)).toEqual([140, 43, 32]);
    expect(pixels.filter((_, index) => index % 4 === 3)).toEqual(alpha);
  });
  it('remaps only cloth pigment, never alpha, wood, foliage or the main table', () => {
    const source = new Uint8ClampedArray([180, 50, 45, 255, 150, 95, 40, 255, 50, 90, 40, 255, 180, 50, 45, 0]);
    const variants = [];
    for (const area of ['main', 'reading', 'greenhouse', 'terrace'] as const) {
      const pixels = source.slice(); remapTablecloth(pixels, 4, 1, area);
      expect([...pixels.filter((_, index) => index % 4 === 3)]).toEqual([255, 255, 255, 0]);
      expect(pixels.slice(4)).toEqual(source.slice(4));
      if (area === 'main') expect(pixels).toEqual(source);
      variants.push([...pixels.slice(0, 3)].join(','));
    }
    expect(new Set(variants).size).toBe(4);
  });
});

describe('pixel thought layout', () => {
  it.each([['My little café dream', false], ['我的小小咖啡馆梦想', true], ['averylongwordwithoutbreaks'.repeat(3), false]] as const)('wraps %s with the same widths it paints', (text, chinese) => {
    const lines = wrapThoughtText(text, chinese);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every(line => thoughtTextWidth(line) <= 80)).toBe(true);
    expect(lines.join(chinese ? '' : ' ').replaceAll(' ', '')).toBe(text.replaceAll(' ', ''));
  });
});
