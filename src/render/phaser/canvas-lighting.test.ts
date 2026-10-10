import { describe, expect, it, vi } from 'vitest';
import { prepareCanvasMultiply } from './canvas-lighting';

// Model the stale table produced when Phaser's image-based probe is still pending.
const MULTIPLY = 2;
const modes = () => ['source-over', 'lighter', 'source-over', 'screen'];
function canvasProbe(pixel = [255, 0, 0, 255], supportsMultiply = true) {
  let operation = 'source-over';
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: pixel })),
    get globalCompositeOperation() { return operation; },
    set globalCompositeOperation(value: string) { if (supportsMultiply) operation = value; },
  };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) };
  return { ctx, canvas, create: () => canvas as unknown as HTMLCanvasElement };
}

describe('Canvas ambient grading compatibility', () => {
  it('repairs the stale multiply entry without changing other blend modes', () => {
    const table = modes();
    const probe = canvasProbe();
    expect(prepareCanvasMultiply(table, MULTIPLY, probe.create)).toBe(true);
    expect(table).toEqual(['source-over', 'lighter', 'multiply', 'screen']);
    expect(probe.canvas.width).toBe(1);
    expect(probe.canvas.height).toBe(1);
    expect(probe.ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(probe.ctx.getImageData).toHaveBeenCalledWith(0, 0, 1, 1);
  });

  it('is safe on repeated scene creation', () => {
    const table = modes();
    expect(prepareCanvasMultiply(table, MULTIPLY, canvasProbe().create)).toBe(true);
    expect(prepareCanvasMultiply(table, MULTIPLY, canvasProbe().create)).toBe(true);
    expect(table[MULTIPLY]).toBe('multiply');
  });

  it('disables the opaque grade when multiply is unsupported', () => {
    const table = modes();
    const probe = canvasProbe([255, 255, 0, 255], false);
    expect(prepareCanvasMultiply(table, MULTIPLY, probe.create)).toBe(false);
    expect(table).toEqual(modes());
    expect(probe.ctx.getImageData).not.toHaveBeenCalled();
  });

  it('disables the grade if the operation is accepted but paints source-over', () => {
    const table = modes();
    expect(prepareCanvasMultiply(table, MULTIPLY, canvasProbe([255, 255, 0, 255]).create)).toBe(false);
    expect(table).toEqual(modes());
  });

  it('requires an opaque multiplied pixel', () => {
    expect(prepareCanvasMultiply(modes(), MULTIPLY, canvasProbe([255, 0, 0, 0]).create)).toBe(false);
  });

  it('disables the grade if no 2D context is available', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(prepareCanvasMultiply(modes(), MULTIPLY, () => canvas)).toBe(false);
  });

  it('disables the grade if canvas creation throws', () => {
    expect(prepareCanvasMultiply(modes(), MULTIPLY, () => { throw new Error('Unavailable'); })).toBe(false);
  });

  it('disables the grade on a restricted pixel read, even with an existing multiply entry', () => {
    const table = modes();
    table[MULTIPLY] = 'multiply';
    const probe = canvasProbe();
    probe.ctx.getImageData.mockImplementation(() => { throw new Error('SecurityError'); });
    expect(prepareCanvasMultiply(table, MULTIPLY, probe.create)).toBe(false);
    expect(table[MULTIPLY]).toBe('multiply');
  });
});
