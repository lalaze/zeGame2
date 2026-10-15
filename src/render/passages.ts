import { paintRunner, RUNNER_BASE } from './decor-art';
import { mix } from './color';
import { FLOOR_Y, SCENE_W, passageY, areaBounds, doorwayY } from '../game/layout';
import { adjacentArea, isAreaOpen, type AreaId, type Direction } from '../game/regions';
import type { GameState } from '../game/state';


/** Visible woven fibres at the room's native art resolution. No navigation changes. */
export function passageRunner(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: 'h' | 'v', base: string, detailed: boolean): void {
  paintRunner(ctx, x, y, w, h, dir, base);
  if (!detailed) return;
  const light = mix(base, '#f3e7cf', .28), shade = mix(base, '#705a40', .18);
  for (let yy = Math.ceil(y + 3); yy < y + h - 3; yy += 3) {
    const shift = Math.floor(yy / 3) % 2 ? 2 : 0;
    for (let xx = Math.ceil(x + 3) + shift; xx < x + w - 3; xx += 5) {
      ctx.fillStyle = shade; ctx.fillRect(xx, yy, 2, 1);
      ctx.fillStyle = light; ctx.fillRect(xx, yy + 1, 1, 1);
    }
  }
  // One inward contact edge gives the fabric thickness without widening paths.
  ctx.fillStyle = mix(base, '#493127', .24);
  if (dir === 'v') ctx.fillRect(x + w - 1, y, 1, h);
  else ctx.fillRect(x, y + h - 1, w, 1);
}

/** Physical thresholds and circulation belong to the building, not to the camera. */
export function paintPassageFloor(ctx: CanvasRenderingContext2D, area: AreaId): void {
  // The kitchen's tiled floor needs no runner.
  if (area === 'kitchen') return;
  const y = passageY();
  // The same jute runner as the entrance; the glasshouse and garden get a paler, sun-bleached one.
  const jute = area === 'main' || area === 'reading' ? RUNNER_BASE : '#d9d7b8';
  const left = area !== 'main' && adjacentArea(area, 'left');
  const right = adjacentArea(area, 'right');
  const start = area === 'main' ? 64 : left ? 0 : 146;
  const end = right ? 320 : 174;
  // The runner to the glasshouse tucks under the cross runner.
  if (adjacentArea(area, 'up')) passageRunner(ctx, 145, 0, 30, y, 'v', jute, area !== 'main');
  passageRunner(ctx, start, y - 7, end - start, 14, 'h', jute, area !== 'main');
  ctx.fillStyle = '#b29770';
  for (const direction of ['left', 'right'] as const) {
    if (!adjacentArea(area, direction) || (area === 'main' && direction === 'left')) continue;
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

/**
 * The walls along a room's sides, with gaps for the shared doors, and bars across
 * any door into a room that isn't open yet. The kitchen door has a swinging leaf,
 * `kitchenDoor` open (0 to 1).
 */
export function paintRoomBoundaries(ctx: CanvasRenderingContext2D, area: AreaId, state: GameState, kitchenDoor = 0): void {
  const height = areaBounds(area).h;
  const r = (x: number, top: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, h);
  };
  const garden = area === 'terrace';
  const base = garden ? '#7a8b61' : area === 'greenhouse' ? '#58796b' : area === 'kitchen' ? '#7c8790' : '#a67450';
  const ink = '#493127';
  const blocked = (direction: Direction) => {
    const to = adjacentArea(area, direction);
    return to && (!isAreaOpen(state, area) || !isAreaOpen(state, to));
  };
  for (const direction of ['left', 'right'] as const) {
    const x = direction === 'left' ? 0 : SCENE_W - 5;
    const y = doorwayY(area, direction);
    const connected = adjacentArea(area, direction);
    const segments = connected ? [[0, y - 14], [y + 14, height - y - 14]] : [[0, height]];
    for (const [top, h] of segments) {
      r(x, top, 5, h, ink);
      r(x + 1, top, 3, h, base);
      r(x + 1, top, 1, h, '#d5b48a');
      // Raised timber pilaster: alternating polished grain and mortise collars.
      // The existing five-pixel wall footprint and physical doorway remain exact.
      for (let yy = top + 8; yy < top + h - 4; yy += 19) {
        r(x + 2, yy, 1, 7, mix(base, '#543425', 0.42));
        r(x + 3, yy + 2, 1, 4, mix(base, '#c98c4d', 0.35));
      }
      for (let yy = top + 22; yy < top + h - 3; yy += 49) {
        r(x, yy, 5, 3, '#543425');
        r(x + 1, yy, 3, 1, '#c98c4d');
        r(x + 2, yy + 1, 1, 1, '#dfba76');
      }
    }
    if (!connected) continue;
    if (area === 'kitchen' || connected === 'kitchen') {
      // A shallow inset sill belongs to the door, not a long strip across the room.
      const sillX = direction === 'left' ? 0 : SCENE_W - 8;
      r(sillX, y - 12, 8, 24, '#967655');
      r(sillX + 1, y - 11, 6, 22, '#b89a70');
      r(sillX + (direction === 'left' ? 6 : 1), y - 11, 1, 22, '#dfc596');
    }
    for (const top of [y - 17, y + 13]) {
      r(x - 2, top, 9, 4, ink);
      r(x - 1, top, 7, 2, '#dec19a');
      r(x - 1, top + 1, 7, 1, '#ad7845');
      r(x + 1, top + 2, 3, 1, '#6a452d');
      r(x - 1, top, 1, 1, '#f4e6c7');
    }
    if (blocked(direction)) {
      r(x, y - 12, 5, 24, '#916444');
      for (let top = y - 10; top < y + 12; top += 7) r(x, top, 5, 2, '#efcf94');
      r(x + 1, y - 2, 3, 4, '#e6b34d');
      r(x + 1, y - 3, 3, 1, '#543425');
      r(x + 1, y - 2, 1, 3, '#f3d796');
      r(x + 2, y - 1, 1, 2, '#7d5833');
    } else if (area === 'kitchen' || connected === 'kitchen') {
      // A steel swing door with a porthole, folding away from its top hinge as it opens.
      const leaf = Math.round(26 * (1 - kitchenDoor));
      if (leaf >= 2) {
        r(x, y - 13, 5, leaf, ink);
        r(x + 1, y - 13, 3, leaf - 1, '#b9c4cb');
        r(x + 1, y - 13, 1, leaf - 1, '#e3e9ec');
        if (leaf > 12) {
          r(x + 1, y - 7, 3, 4, ink);
          r(x + 2, y - 6, 1, 2, '#ffcf7a');
        }
        // Rivets and a brushed kick plate make the service door a small fixture,
        // rather than a flat grey strip; every mark folds with the same leaf.
        if (leaf > 8) r(x + 3, y - 11, 1, 1, '#657580');
        if (leaf > 16) r(x + 3, y, 1, 2, '#657580');
        if (leaf > 22) {
          r(x + 1, y + 7, 3, 4, '#8d969e');
          r(x + 1, y + 7, 3, 1, '#d6dfdf');
          r(x + 2, y + 9, 2, 1, '#6d7880');
        }
      }
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
