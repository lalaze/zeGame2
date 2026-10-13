import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import staticArchive from '../../assets/generated/original-main-static-v1/manifest.json';
import { FURNITURE } from '../game/furniture';
import { fineSpriteArt } from './fine-sprite-art';
import { createGeneratedFurnitureArt, GENERATED_FURNITURE_ASSETS, GENERATED_FURNITURE_CATALOG,
  GENERATED_FURNITURE_DENSITY, GENERATED_FURNITURE_IDS, generatedFurnitureKey,
  type GeneratedFurnitureId, type GeneratedFurnitureSources } from './generated-furniture-art';

type Draw = { source: CanvasImageSource; args: number[]; smoothing: boolean };
class RecordingCanvas {
  width = 0; height = 0;
  draws: Draw[] = []; lines: number[][] = []; strokes = 0; fills = 0;
  stack: boolean[] = [];
  context = {
    imageSmoothingEnabled: true, lineWidth: 1, lineCap: '', strokeStyle: '', fillStyle: '',
    save: () => { this.stack.push(this.context.imageSmoothingEnabled); },
    restore: () => { this.context.imageSmoothingEnabled = this.stack.pop()!; },
    scale() {}, translate() {}, beginPath() {}, moveTo() {}, arc() {},
    lineTo: (...args: number[]) => { this.lines.push(args); },
    stroke: () => { this.strokes++; }, fill: () => { this.fills++; },
    drawImage: (source: CanvasImageSource, ...args: number[]) => { this.draws.push({ source, args, smoothing: this.context.imageSmoothingEnabled }); },
  };
  getContext() { return this.context; }
}
const record = (canvas: HTMLCanvasElement) => canvas as unknown as RecordingCanvas;
const source = (w: number, h: number) => ({ width: w, height: h }) as HTMLCanvasElement;
const ctx = (c: RecordingCanvas) => c.context as unknown as CanvasRenderingContext2D;
function fixture(packed = false) {
  const sources = Object.fromEntries(GENERATED_FURNITURE_IDS.map(id => {
    const [w, h] = GENERATED_FURNITURE_CATALOG[id].size, k = packed ? Math.min(1, 256 / Math.max(w, h)) : 1;
    return [id, source(Math.round(w * k), Math.round(h * k))];
  })) as Record<GeneratedFurnitureId, CanvasImageSource>;
  const canvases: RecordingCanvas[] = [];
  const createCanvas = vi.fn(() => { const c = new RecordingCanvas(); canvases.push(c); return c as unknown as HTMLCanvasElement; });
  const create = (input: GeneratedFurnitureSources = sources) => createGeneratedFurnitureArt(input, { createCanvas });
  return { sources, canvases, createCanvas, create };
}

describe('generated furniture catalog and renderer', () => {
  it('covers all 39 placeable IDs and unchanged archived PNGs, including three reusable aliases', () => {
    expect([...GENERATED_FURNITURE_IDS].sort()).toEqual(FURNITURE.map(f => f.id).sort());
    const manifest = JSON.parse(readFileSync('assets/generated/bulk-candidates/furniture/renderer-manifest.json', 'utf8'));
    for (const entry of [...manifest.assets, ...manifest.aliases]) {
      const id = entry.id as GeneratedFurnitureId, meta = GENERATED_FURNITURE_CATALOG[id];
      const originalFile = resolve('assets/generated/bulk-candidates/furniture', entry.file);
      const archived = staticArchive.images.find(row => resolve(row.previousPublicFile) === originalFile);
      const bytes = readFileSync(archived ? resolve(archived.file) : originalFile);
      if (archived) expect(createHash('sha256').update(bytes).digest('hex')).toBe(archived.sha256);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual(meta.size);
      expect(meta.anchor).toEqual(entry.anchor);
      expect(meta.logicalEnvelope).toEqual(entry.logicalEnvelope);
      expect(meta.footprintCells).toEqual([FURNITURE.find(f => f.id === id)!.w, FURNITURE.find(f => f.id === id)!.h]);
      expect(generatedFurnitureKey(id)).toBe(`furniture-${id}`);
      expect(GENERATED_FURNITURE_ASSETS[id]).toBe(`catalog-v1/furniture/${id}.png`);
    }
  });

  for (const packed of [false, true]) it(`preserves whole bitmap, native aspect, envelope and measured anchor (${packed ? 'packed' : 'original'} PNGs)`, () => {
    const f = fixture(packed), adapter = f.create();
    expect(adapter.readyIds).toEqual(GENERATED_FURNITURE_IDS);
    for (const id of GENERATED_FURNITURE_IDS) {
      const meta = GENERATED_FURNITURE_CATALOG[id], [w, h] = meta.logicalEnvelope;
      const sprite = adapter.sprite(id)!, backing = fineSpriteArt(sprite).canvas;
      expect([sprite.width, sprite.height]).toEqual([w, h]);
      expect([backing.width, backing.height]).toEqual([w * 4, h * 4]);
      expect(fineSpriteArt(sprite).density).toBe(GENERATED_FURNITURE_DENSITY);
      const draw = record(backing).draws[0], input = f.sources[id] as HTMLCanvasElement;
      expect(draw.source).toBe(input); expect(draw.smoothing).toBe(false);
      expect(draw.args.slice(0, 4)).toEqual([0, 0, input.width, input.height]);
      const [, , sw, sh, x, y, dw, dh] = draw.args;
      expect(dw / sw).toBeCloseTo(dh / sh, 12);
      expect(x).toBeGreaterThanOrEqual(-1e-10); expect(y).toBeGreaterThanOrEqual(-1e-10);
      expect(x + dw).toBeLessThanOrEqual(backing.width + 1e-10);
      expect(y + dh).toBeLessThanOrEqual(backing.height + 1e-10);
      const packedScale = Math.max(sw, sh) / Math.max(...meta.size);
      expect(x + meta.anchor.x * packedScale * dw / sw).toBeCloseTo(w / 2 * 4, 10);
      expect(y + meta.anchor.y * packedScale * dh / sh).toBeCloseTo((meta.anchor.kind === 'wall-center' ? h / 2 : h - 1) * 4, 10);
      expect(record(backing).strokes).toBe(0); expect(record(backing).fills).toBe(0);
    }
  });

  it('keeps floor hit bounds and world feet fixed while centering wall envelopes in their original footprints', () => {
    const adapter = fixture(true).create();
    for (const id of GENERATED_FURNITURE_IDS) {
      const c = new RecordingCanvas(), meta = GENERATED_FURNITURE_CATALOG[id], [w, h] = meta.logicalEnvelope;
      if (meta.surface === 'floor') {
        expect(adapter.paintFloor(ctx(c), id, 100, 200)).toBe(true);
        expect(c.draws[0].args).toEqual([100 - w / 2, 201 - h, w, h]);
        expect(adapter.floorBounds(id, 100, 200)).toEqual({ x: 100 - w / 2, y: 201 - h, w, h });
        expect(adapter.paintWall(ctx(c), id, 10, 20, new Date())).toBe(false);
      } else {
        expect(adapter.paintWall(ctx(c), id, 10, 20, new Date())).toBe(true);
        expect(c.draws[0].args).toEqual([10 + (meta.footprintCells[0] * 8 - w) / 2, 20 + (meta.footprintCells[1] * 8 - h) / 2, w, h]);
        expect(adapter.paintFloor(ctx(c), id, 100, 200)).toBe(false);
        expect(adapter.floorBounds(id, 100, 200)).toBeUndefined();
      }
      expect(c.context.imageSmoothingEnabled).toBe(true); expect(c.stack).toEqual([]);
    }
  });

  it('draws fresh local-time clock hands over the blank face and retains unlit lantern/rope overlay coordinates', () => {
    const adapter = fixture(true).create(), c = new RecordingCanvas();
    adapter.paintWall(ctx(c), 'clock', 0, 0, new Date(2000, 0, 1, 3, 0));
    const morning = [...c.lines];
    adapter.paintWall(ctx(c), 'clock', 0, 0, new Date(2000, 0, 1, 9, 30));
    expect(c.strokes).toBe(4); expect(c.lines.slice(2)).not.toEqual(morning);
    expect(adapter.overlay('clock')!.clock!.minute).toBeGreaterThan(adapter.overlay('clock')!.clock!.hour);
    const base = record(fineSpriteArt(adapter.sprite('clock')!).canvas);
    expect(base.strokes).toBe(0); expect(base.fills).toBe(0);
    const lantern = adapter.overlay('lantern')!.points.wick;
    expect(lantern.x).toBeGreaterThan(0); expect(lantern.x).toBeLessThan(12);
    expect(lantern.y).toBeGreaterThan(10); expect(lantern.y).toBeLessThan(24);
    const light = new RecordingCanvas(); adapter.paintFloor(ctx(light), 'lantern', 100, 200);
    expect(light.draws).toHaveLength(1); expect(light.strokes).toBe(0); expect(light.fills).toBe(0);
    expect(Object.keys(adapter.overlay('hanging_ivy')!.points)).toEqual(['potRim', 'leftAttachment', 'rightAttachment']);
  });

  it('publishes complete identities independently with safe missing, invalid, failed and fresh-load fallback', () => {
    const f = fixture();
    expect(f.create({}).ready).toBe(false);
    expect(f.create({ piano: f.sources.piano }).readyIds).toEqual(['piano']);
    const missing = f.create({ piano: source(0, 0), clock: source(100, 20), lamp: source(NaN, Infinity) });
    expect(missing.readyIds).toEqual([]);
    const unloaded = { width: 1089, height: 1102, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
    expect(f.create({ clock: unloaded }).ready).toBe(false);
    const fail = vi.fn(() => { if (fail.mock.calls.length === 4) throw new Error('partial clock'); return f.createCanvas(); });
    const partial = createGeneratedFurnitureArt(f.sources, { createCanvas: fail });
    expect(partial.sprite('clock')).toBeUndefined(); expect(partial.icon('clock')).toBeUndefined();
    expect(partial.readyIds).toHaveLength(38);
    expect(f.create().readyIds).toHaveLength(39);
    expect(createGeneratedFurnitureArt(f.sources, { createCanvas: () => { throw new Error('no canvas'); } }).ready).toBe(false);
  });

  it('bounds allocation to 156 cached canvases and never allocates for world paint or repeated lookups', () => {
    const f = fixture(true), adapter = f.create(), c = new RecordingCanvas();
    expect(f.createCanvas).toHaveBeenCalledTimes(156);
    const original = adapter.icon('clock');
    for (let n = 0; n < 20; n++) for (const id of GENERATED_FURNITURE_IDS) {
      expect(adapter.sprite(id)).toBeDefined(); expect(adapter.icon(id)).toBeDefined(); adapter.overlay(id);
      adapter.paintFloor(ctx(c), id, 20, 40); adapter.paintWall(ctx(c), id, 0, 0, new Date(2000, 0, 1));
    }
    expect(adapter.icon('clock')).toBe(original); expect(f.createCanvas).toHaveBeenCalledTimes(156);
    expect(adapter.sprite('unknown')).toBeUndefined(); expect(adapter.icon('unknown')).toBeUndefined();
    expect(adapter.paintFloor(ctx(c), 'unknown', 1, 2)).toBe(false);
    expect(adapter.paintWall(ctx(c), 'unknown', 1, 2, new Date())).toBe(false);
    expect(adapter.floorBounds('unknown', 1, 2)).toBeUndefined();
  });
});
