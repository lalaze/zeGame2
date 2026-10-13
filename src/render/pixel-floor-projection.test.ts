import { describe, expect, it } from 'vitest';
import { pixelFloorDoorLight, projectFloorLayer } from './pixel-floor-projection';
import { projectPoint, type PixelProjectionOptions } from './pixel-projection';

interface ImageStrip {
  source: HTMLCanvasElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  smoothing: boolean;
}

describe('pixel floor door light cache levels', () => {
  it('settles all invisible easing tails to the same zero key', () => {
    for (const value of [-1, 0, 0.00001, 0.018, 0.019, 0.02, 0.05]) expect(pixelFloorDoorLight(value)).toBe(0);
  });
  it('uses bounded eighths and stable nearby light intensities', () => {
    expect(pixelFloorDoorLight(0.49)).toBe(0.5);
    expect(pixelFloorDoorLight(0.51)).toBe(0.5);
    expect(pixelFloorDoorLight(2)).toBe(1);
    for (let i = 0; i <= 100; i++) {
      const light = pixelFloorDoorLight(i / 100);
      expect(light).toBeGreaterThanOrEqual(0);
      expect(light).toBeLessThanOrEqual(1);
      expect(light * 8).toBe(Math.round(light * 8));
    }
  });
  it('does not propagate non-finite animation values', () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(pixelFloorDoorLight(value)).toBe(0);
  });
});

function recordingContext(initialSmoothing = true) {
  const strips: ImageStrip[] = [];
  const stack: boolean[] = [];
  const calls: string[] = [];
  const mock = {
    imageSmoothingEnabled: initialSmoothing,
    save() { calls.push('save'); stack.push(this.imageSmoothingEnabled); },
    restore() { calls.push('restore'); this.imageSmoothingEnabled = stack.pop()!; },
    drawImage(source: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
      calls.push('drawImage');
      strips.push({ source, sx, sy, sw, sh, dx, dy, dw, dh, smoothing: this.imageSmoothingEnabled });
    },
  };
  return { strips, calls, mock, ctx: mock as unknown as CanvasRenderingContext2D };
}

const main: PixelProjectionOptions = {
  enabled: true,
  area: 'main',
  width: 320,
  floorTop: 80,
  floorBottom: 233,
  doorways: [{ side: 'left', y: 88 }, { side: 'right', y: 138 }],
};

function render(options: PixelProjectionOptions = main, density = 2, height = 240, initialSmoothing = true) {
  const record = recordingContext(initialSmoothing);
  const source = { width: 320 * density, height: height * density } as HTMLCanvasElement;
  projectFloorLayer(record.ctx, source, options, density);
  return { ...record, source };
}

function bySourceRow(strips: ImageStrip[]): ImageStrip[][] {
  const rows: ImageStrip[][] = [];
  for (const strip of strips) (rows[strip.sy] ??= []).push(strip);
  return rows;
}

describe('isolated ground-layer pixel projection', () => {
  it('covers the entire source and destination exactly when projection is identity', () => {
    for (const options of [{}, { ...main, enabled: false }, { ...main, area: 'reading' }, { ...main, backScale: 1 }]) {
      const { strips, source } = render(options);
      const rows = bySourceRow(strips);
      expect(rows).toHaveLength(source.height);
      for (const row of rows) {
        expect(row).toHaveLength(6);
        expect(row[0].sx).toBe(0);
        expect(row[0].dx).toBe(0);
        expect(row.at(-1)!.sx + row.at(-1)!.sw).toBe(source.width);
        expect(row.at(-1)!.dx + row.at(-1)!.dw).toBe(320);
        for (let index = 0; index < row.length; index++) {
          const strip = row[index];
          expect(strip.dx).toBe(strip.sx / 2);
          expect(strip.dw).toBe(strip.sw / 2);
          if (index > 0) {
            expect(row[index - 1].sx + row[index - 1].sw).toBe(strip.sx);
            expect(row[index - 1].dx + row[index - 1].dw).toBe(strip.dx);
          }
        }
      }
      const final = rows.at(-1)![0];
      expect(final.sy + final.sh).toBe(source.height);
      expect(final.dy + final.dh).toBe(240);
    }
  });

  it('joins all horizontal pieces without gaps or overlaps through portal fades', () => {
    for (const options of [main, { ...main, doorIdentityWidth: 20, doorBlendWidth: 48 }]) {
      const { strips, source } = render(options);
      const rows = bySourceRow(strips);
      for (const row of rows) {
        expect(row).toHaveLength(6);
        for (let index = 0; index < row.length; index++) {
          const strip = row[index];
          expect([strip.sx, strip.sy, strip.sw, strip.sh, strip.dx, strip.dy, strip.dw, strip.dh].every(Number.isFinite)).toBe(true);
          expect(strip.sw).toBeGreaterThan(0);
          expect(strip.dw).toBeGreaterThan(0);
          if (index > 0) {
            expect(row[index - 1].sx + row[index - 1].sw).toBe(strip.sx);
            expect(row[index - 1].dx + row[index - 1].dw).toBe(strip.dx);
          }
          const projectedLeft = projectPoint({ x: strip.sx / 2, y: strip.dy }, options).x;
          const projectedRight = projectPoint({ x: (strip.sx + strip.sw) / 2, y: strip.dy }, options).x;
          expect(strip.dx).toBe(Math.round(projectedLeft * 2) / 2);
          expect(strip.dx + strip.dw).toBe(Math.round(projectedRight * 2) / 2);
        }
        expect(row[0].sx).toBe(0);
        expect(row.at(-1)!.sx + row.at(-1)!.sw).toBe(source.width);
      }
    }
  });

  it('keeps the full near-wall doorway opening at identity on both sides', () => {
    const rows = bySourceRow(render().strips);
    for (const [side, center] of [['left', 88], ['right', 138]] as const) {
      for (let y = center - 14; y <= center + 14; y += 0.5) {
        const row = rows[y * 2];
        const portal = side === 'left' ? row[0] : row.at(-1)!;
        expect(portal.dx).toBe(side === 'left' ? 0 : 304);
        expect(portal.dw).toBe(16);
        expect(portal.dx).toBe(portal.sx / 2);
        expect(portal.dw).toBe(portal.sw / 2);
      }
    }
  });

  it('samples exactly one texture-pixel row into each half-world-pixel strip', () => {
    const { source, strips } = render();
    for (const strip of strips) {
      expect(strip.source).toBe(source);
      expect(Number.isInteger(strip.sy)).toBe(true);
      expect(strip.sh).toBe(1);
      expect(strip.dy).toBe(strip.sy / 2);
      expect(strip.dh).toBe(0.5);
      expect(Number.isInteger(strip.dx * 2)).toBe(true);
      expect(Number.isInteger(strip.dw * 2)).toBe(true);
    }
    const rows = bySourceRow(strips);
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index - 1][0].sy + rows[index - 1][0].sh).toBe(rows[index][0].sy);
      expect(rows[index - 1][0].dy + rows[index - 1][0].dh).toBe(rows[index][0].dy);
    }
  });

  it('scales row sampling with backing density and covers expanded room heights', () => {
    for (const density of [1, 2, 4]) {
      const { source, strips } = render({ ...main, floorBottom: 353 }, density, 360);
      const rows = bySourceRow(strips);
      expect(rows).toHaveLength(source.height);
      expect(strips.every(strip => strip.sh === 1 && strip.dh === 1 / density && strip.dy === strip.sy / density)).toBe(true);
      expect(rows[0][0].dy).toBe(0);
      expect(rows.at(-1)![0].dy + rows.at(-1)![0].dh).toBe(360);
    }
  });

  it('turns smoothing off for every ground strip and restores either caller state', () => {
    for (const initial of [false, true]) {
      const { strips, calls, mock } = render(main, 2, 240, initial);
      expect(calls[0]).toBe('save');
      expect(calls.at(-1)).toBe('restore');
      expect(calls.filter(call => call === 'save')).toHaveLength(1);
      expect(calls.filter(call => call === 'restore')).toHaveLength(1);
      expect(strips.every(strip => strip.smoothing === false)).toBe(true);
      expect(mock.imageSmoothingEnabled).toBe(initial);
    }
  });
});
