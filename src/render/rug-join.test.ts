import { afterEach, describe, expect, it } from 'vitest';
import { MAX_SCENE_H, MIN_SCENE_H, floorY, passageY, setSceneHeight } from '../game/layout';
import { mix } from './color';
import { paintRunner, paintRunnerJoin, RUNNER_EDGE } from './decor-art';
import { lightingAt } from './lighting';
import { artRamp, mainCarpet, mainFloor, mainRug } from './main-room-surfaces';
import { RoomPainter } from './room-art';

type Rect = [x: number, y: number, width: number, height: number, color: string];

function record(paint: (ctx: CanvasRenderingContext2D) => void): Rect[] {
  const rectangles: Rect[] = [];
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    stack: [] as [string, number][],
    fillRect(this: { fillStyle: string; globalAlpha: number }, x: number, y: number, w: number, h: number) {
      if (this.globalAlpha === 1) rectangles.push([x, y, w, h, this.fillStyle]);
    },
    save(this: {stack: [string,number][]; fillStyle: string; globalAlpha: number}) { this.stack.push([this.fillStyle, this.globalAlpha]); }, restore(this: {stack: [string,number][]; fillStyle: string; globalAlpha: number}) { const old = this.stack.pop(); if (old) [this.fillStyle, this.globalAlpha] = old; },
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
    const interiorColors = [artRamp('sage')[2], artRamp('cloth-2')[0]];

    // Exclude the outer trim, but include both the former cross-runner bottom
    // border and the old separate entry rug's fringe and finished head.
    for (let y = top + 4; y <= oldHead + 4; y++) {
      for (let x = 149; x < 171; x++) {
        expect(interiorColors, `unbroken jute at ${x},${y}`).toContain(colorAt(painted, x, y));
      }
    }
    // A full-width dark edge would still read as two overlapping carpets.
    for (const y of [top + 12, top + 13]) {
      expect(Array.from({ length: 22 }, (_, i) => colorAt(painted, 149 + i, y)).every(color => interiorColors.includes(color!))).toBe(true);
    }
  });

  it('keeps the top border continuous and turns the lower borders down each side', () => {
    setSceneHeight(height);
    const painted = roomFloor('rug_none', height);
    const withoutEntryStem = roomFloor('rug_blue', height);
    const top = passageY() - 7;

    for (let x = 140; x < 180; x++) {
      expect(colorAt(painted, x, top), `top edge at ${x}`).toBe(artRamp('sage')[0]);
      expect([artRamp('cloth-7')[1],artRamp('floor')[2]], `woven top binding at ${x}`).toContain(colorAt(painted,x,top+1));
    }
    for (const [start, end] of [[140, 145], [175, 180]]) {
      for (let x = start; x < end; x++) expect(colorAt(painted, x, top + 13.5)).toBe(artRamp('sage')[0]);
    }
    for (let y = top + 14; y <= floorY(150) + 4; y++) {
      for (const x of [146, 173.75]) expect([artRamp('cloth-7')[1],artRamp('floor')[2]], `woven side binding at ${x},${y}`).toContain(colorAt(painted,x,y));
    }
    for (let y = top + 14; y <= floorY(150) + 4; y++) {
      for (const x of [145, 174.5]) expect(colorAt(painted, x, y), `side edge at ${x},${y}`).toBe(artRamp('sage')[0]);
    }
    // Extending the entry rug must not move its old fringe above the T.
    for (let y = top - 2; y < top; y++) {
      for (let x = 145; x < 175; x++) expect(colorAt(painted, x, y)).toBe(colorAt(withoutEntryStem, x, y));
    }
  });

  it.each(['rug_red', 'rug_blue', 'rug_round'])('keeps purchased %s separate from the cross runner', rug => {
    setSceneHeight(height);
    const painted = roomFloor(rug, height);
    const passage = record(ctx => mainCarpet(ctx, height, false));
    const floor = record(ctx => mainFloor(ctx, 'floor_wood', height));
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
    const expectedRug = record(ctx => mainRug(ctx, rug, 133, rugTop, 54, height - 20 - rugTop));
    expect(colorAt(painted, 160, rugTop + 4)).toBe(colorAt(expectedRug, 160, rugTop + 4));
    expect(colorAt(painted, 160, rugTop + 4)).not.toBeUndefined();
  });
});

it('confines the join patch to its footprint and honors the runner material', () => {
  const base = '#d9d7b8';

  const painted = record(ctx => paintRunnerJoin(ctx, 145, 131, 30, 14, base));
  expect(painted.every(([x, y, w, h]) => x >= 145 && y >= 131 && x + w <= 175 && y + h <= 145)).toBe(true);
  expect(colorAt(painted, 160, 131)).toBe(RUNNER_EDGE);
  for (let y = 135; y < 145; y++) {
    for (let x = 149; x < 171; x++) {
      expect([base, mix(base, '#f3e7cf', 0.23), mix(base, '#8f785e', 0.13)]).toContain(colorAt(painted, x, y));
    }
  }
});

 it('uses restrained, deterministic woven yarn without red geometric motifs', () => {
  const paint = (ctx: CanvasRenderingContext2D) => paintRunner(ctx, 10, 20, 30, 80, 'v');
  const painted = record(paint);
  expect(painted).toEqual(record(paint));
  expect(painted.some(([, , , , color]) => color === '#b5453a')).toBe(false);
  expect(painted.every(([x, y, w, h]) => x >= 10 && y >= 20 && x + w <= 40 && y + h <= 100 && w > 0 && h > 0)).toBe(true);
  expect(painted.some(([, , , h]) => h === .25)).toBe(true);
});
