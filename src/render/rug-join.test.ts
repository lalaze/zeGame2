import { afterEach, describe, expect, it } from 'vitest';
import { FLOOR_Y, MAX_SCENE_H, MIN_SCENE_H, SCENE_W, floorY, passageY, setSceneHeight } from '../game/layout';
import { mix, ramp } from './color';
import { paintFloor, paintRug, paintRunnerJoin } from './decor-art';
import { lightingAt } from './lighting';
import { paintPassageFloor } from './passages';
import { RoomPainter } from './room-art';

type Rect = [x: number, y: number, width: number, height: number, color: string];
const JUTE = ramp('#d6b382');
const TRIM = '#9a6a45';
const WEAVE = mix(JUTE.base, JUTE.lo, 0.45);

function record(paint: (ctx: CanvasRenderingContext2D) => void): Rect[] {
  const rectangles: Rect[] = [];
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    fillRect(this: { fillStyle: string }, x: number, y: number, w: number, h: number) {
      rectangles.push([x, y, w, h, this.fillStyle]);
    },
    save() {}, restore() {},
  } as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return rectangles;
}

// Carpet probes avoid sunbeams, queue marks, dining bays, and room-edge shadows.
// Where the counter shadow can overlap, compare equivalent full-room renders.
function colorAt(rectangles: Rect[], x: number, y: number): string | undefined {
  for (let i = rectangles.length - 1; i >= 0; i--) {
    const [left, top, width, height, color] = rectangles[i];
    if (x >= left && x < left + width && y >= top && y < top + height) return color;
  }
}

function roomFloor(rug: string, height: number): Rect[] {
  return record(ctx => new RoomPainter(ctx).drawFloor('floor_wood', rug, lightingAt(0), height));
}

afterEach(() => setSceneHeight(MIN_SCENE_H));

describe.each([MIN_SCENE_H, MAX_SCENE_H])('main entry rug at scene height %i', height => {
  it('has continuous woven material through the T junction and the former floor gap', () => {
    setSceneHeight(height);
    const painted = roomFloor('rug_none', height);
    const top = passageY() - 7;
    const oldHead = floorY(150);
    const interiorColors = [JUTE.base, JUTE.lo, WEAVE, '#b5453a'];

    // Exclude the outer trim, but include both the former cross-runner bottom
    // border and the old separate entry rug's fringe and finished head.
    for (let y = top + 4; y <= oldHead + 4; y++) {
      for (let x = 149; x < 171; x++) {
        expect(interiorColors, `unbroken jute at ${x},${y}`).toContain(colorAt(painted, x, y));
      }
    }
    // A full-width dark edge would still read as two overlapping carpets.
    for (const y of [top + 10, top + 13]) {
      expect(Array.from({ length: 22 }, (_, i) => colorAt(painted, 149 + i, y))).toContain(JUTE.base);
    }
  });

  it('keeps the top border continuous and turns the lower borders down each side', () => {
    setSceneHeight(height);
    const painted = roomFloor('rug_none', height);
    const withoutEntryStem = roomFloor('rug_blue', height);
    const top = passageY() - 7;

    for (let x = 140; x < 180; x++) {
      expect(colorAt(painted, x, top), `top edge at ${x}`).toBe(JUTE.lo);
      expect(colorAt(painted, x, top + 3), `top trim at ${x}`).toBe(TRIM);
    }
    for (const [start, end] of [[140, 149], [171, 180]]) {
      for (let x = start; x < end; x++) expect(colorAt(painted, x, top + 10)).toBe(TRIM);
    }
    for (let y = top + 10; y <= floorY(150) + 4; y++) {
      for (const x of [148, 171]) expect(colorAt(painted, x, y), `side trim at ${x},${y}`).toBe(TRIM);
    }
    for (let y = top + 14; y <= floorY(150) + 4; y++) {
      for (const x of [145, 174]) expect(colorAt(painted, x, y), `side edge at ${x},${y}`).toBe(JUTE.lo);
    }
    // Extending the entry rug must not move its old fringe above the T.
    for (let y = top - 2; y < top; y++) {
      for (let x = 145; x < 175; x++) expect(colorAt(painted, x, y)).toBe(colorAt(withoutEntryStem, x, y));
    }
  });

  it.each(['rug_red', 'rug_blue', 'rug_round'])('keeps purchased %s separate from the cross runner', rug => {
    setSceneHeight(height);
    const painted = roomFloor(rug, height);
    const passage = record(ctx => paintPassageFloor(ctx, 'main'));
    const floor = record(ctx => paintFloor(ctx, 'floor_wood', 0, FLOOR_Y, SCENE_W, height - FLOOR_Y));
    const top = passageY() - 7;
    const rugTop = floorY(150);

    // No T opening is cut into the cross runner when a purchased rug is shown.
    for (let y = top; y < top + 14; y++) {
      for (let x = 145; x < 175; x++) expect(colorAt(painted, x, y)).toBe(colorAt(passage, x, y));
    }
    // Leave two pixels for the purchased rectangular rugs' own fringe.
    expect(rugTop - 2).toBeGreaterThan(top + 14);
    for (let y = top + 14; y < rugTop - 2; y++) {
      for (let x = 145; x < 175; x++) expect(colorAt(painted, x, y)).toBe(colorAt(floor, x, y));
    }
    const expectedRug = record(ctx => paintRug(ctx, rug, 133, rugTop, 54, height - 20 - rugTop));
    expect(colorAt(painted, 160, rugTop + 4)).toBe(colorAt(expectedRug, 160, rugTop + 4));
    expect(colorAt(painted, 160, rugTop + 4)).not.toBeUndefined();
  });
});

it('confines the join patch to its footprint and honors the runner material', () => {
  const base = '#d9d7b8';
  const field = ramp(base);
  const painted = record(ctx => paintRunnerJoin(ctx, 145, 131, 30, 14, base));
  expect(painted.every(([x, y, w, h]) => x >= 145 && y >= 131 && x + w <= 175 && y + h <= 145)).toBe(true);
  expect(colorAt(painted, 160, 131)).toBe(field.lo);
  for (let y = 135; y < 145; y++) {
    for (let x = 149; x < 171; x++) {
      expect([base, mix(base, field.lo, 0.45)]).toContain(colorAt(painted, x, y));
    }
  }
});
