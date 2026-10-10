import { paintRunner } from './decor-art';
import { FLOOR_Y, SCENE_W, passageY, sceneHeight } from '../game/layout';
import { adjacentArea, isAreaOpen, type AreaId, type Direction } from '../game/regions';
import type { GameState } from '../game/state';

/** Physical thresholds and circulation belong to the building, not to the camera. */
export function paintPassageFloor(ctx: CanvasRenderingContext2D, area: AreaId): void {
  const y = passageY();
  // The same jute runner as the entrance; the glasshouse and garden get a paler, sun-bleached one.
  const jute = area === 'main' || area === 'reading' ? '#d6b382' : '#d9d7b8';
  const left = adjacentArea(area, 'left');
  const right = adjacentArea(area, 'right');
  const start = left ? 0 : 146;
  const end = right ? 320 : 174;
  // The runner to the glasshouse tucks under the cross runner.
  if (adjacentArea(area, 'up')) paintRunner(ctx, 145, 0, 30, y, 'v', jute);
  paintRunner(ctx, start, y - 7, end - start, 14, 'h', jute);
  ctx.fillStyle = '#b29770';
  for (const direction of ['left', 'right'] as const) {
    if (!adjacentArea(area, direction)) continue;
    const x = direction === 'left' ? 0 : 312;
    ctx.fillRect(x, y - 12, 8, 24);
    ctx.fillStyle = '#f3dfb8';
    ctx.fillRect(x, y - 11, 8, 2);
    ctx.fillRect(x, y + 9, 8, 2);
  }
  if (adjacentArea(area, 'up')) {
    ctx.fillStyle = '#b29770';
    ctx.fillRect(145, FLOOR_Y - 2, 30, 3);
    ctx.fillStyle = '#f4dfb7';
    ctx.fillRect(146, FLOOR_Y - 1, 28, 1);
  }
}

export function paintRoomBoundaries(ctx: CanvasRenderingContext2D, area: AreaId, state: GameState): void {
  const height = sceneHeight();
  const y = passageY();
  const r = (x: number, top: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, h);
  };
  const garden = area === 'terrace';
  const base = garden ? '#7a8b61' : area === 'greenhouse' ? '#58796b' : '#a67450';
  const ink = '#493127';
  const blocked = (direction: Direction) => {
    const to = adjacentArea(area, direction);
    return to && (!isAreaOpen(state, area) || !isAreaOpen(state, to));
  };
  for (const direction of ['left', 'right'] as const) {
    const x = direction === 'left' ? 0 : SCENE_W - 5;
    const connected = adjacentArea(area, direction);
    const segments = connected ? [[0, y - 14], [y + 14, height - y - 14]] : [[0, height]];
    for (const [top, h] of segments) {
      r(x, top, 5, h, ink);
      r(x + 1, top, 3, h, base);
      r(x + 1, top, 1, h, '#d5b48a');
    }
    if (!connected) continue;
    for (const top of [y - 17, y + 13]) {
      r(x - 2, top, 9, 4, ink);
      r(x - 1, top, 7, 2, '#dec19a');
    }
    if (blocked(direction)) {
      r(x, y - 12, 5, 24, '#916444');
      for (let top = y - 10; top < y + 12; top += 7) r(x, top, 5, 2, '#efcf94');
      r(x + 1, y - 2, 3, 4, '#e6b34d');
    }
  }
  // A real rear doorway replaces the window's middle, meeting the glasshouse threshold.
  if (adjacentArea(area, 'up')) {
    for (const x of [139, 176]) {
      r(x, 0, 5, FLOOR_Y + 4, ink);
      r(x + 1, 0, 3, FLOOR_Y + 3, base);
      r(x + 1, 0, 1, FLOOR_Y + 3, '#dec19a');
    }
    if (blocked('up')) {
      r(144, 24, 32, FLOOR_Y - 24, '#916444');
      for (let top = 28; top < FLOOR_Y; top += 9) r(145, top, 30, 2, '#bb8e5e');
      r(158, 52, 5, 6, '#e6b34d');
    }
  }
}
