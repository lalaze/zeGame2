// Scene geometry in logical pixels (16px tiles, Stardew-style 3/4 view).
// Characters are positioned by their feet.
//
// Floor plan: the counter stands in the middle of the back wall, with a dining
// nook on each side, each under a window, and two more tables by the front door.
// The kitchen door is in the left wall.
// Customers come in through the door in the middle of the bottom edge, line up
// in front of the counter, then sit down or head back out the way they came.
import { AREA_GRID, AREA_IDS, REGIONS, areaConnections, regionOffset, type AreaId, type Direction } from './regions';

export const SCENE_W = 320;

/**
 * The café is always 320 wide; extra height becomes extra floor so the room fills
 * tall screens. The tables and the queue spread out over it (see `spread`).
 */
export const MIN_SCENE_H = 192;
export const MAX_SCENE_H = 360;
let sceneH = MIN_SCENE_H;
export const sceneHeight = () => sceneH;
export function setSceneHeight(h: number): void {
  sceneH = Math.max(MIN_SCENE_H, Math.min(MAX_SCENE_H, Math.round(h)));
}

/** The back wall runs from the ceiling down to FLOOR_Y. */
export const FLOOR_Y = 80;
/**
 * The service counter; a glass case in its front shows today's bakes. It stands
 * forward of the back bar, leaving an aisle inside the bar for the baristas to
 * work in, and a short return at its left end closes the bar off from the room.
 */
export const COUNTER = { x: 64, w: 170, top: 96, front: 107, bottom: 127 };
export const COUNTER_RETURN = { x: 64, w: 8 };
/** The hinged flap at the counter's right end that staff walk through. */
export const COUNTER_GATE = { x: COUNTER.x + COUNTER.w, w: 16 };
export const PASTRY_CASE = { x: 148, w: 72 };
/** The low cabinet against the wall behind the baristas. */
export const BACK_BAR = { x: 72, w: 182, top: 57, front: 63 };
/** The floor inside the bar, between the back bar and the counter. */
export const BAR_AISLE = { x: COUNTER_RETURN.x + COUNTER_RETURN.w, w: COUNTER_GATE.x + COUNTER_GATE.w - COUNTER_RETURN.x - COUNTER_RETURN.w, top: FLOOR_Y, bottom: COUNTER.top };

/** The front door: an opening in the bottom wall, centered. */
export const DOOR_W = 32;
export const DOOR_X = SCENE_W / 2 - DOOR_W / 2;
/** Where customers appear and disappear, just outside the front door. */
export const doorSpot = () => ({ x: SCENE_W / 2, y: sceneH + 12 });
export const areaOrigin = (area: AreaId, height = sceneH) => ({
  x: AREA_GRID[area].col * SCENE_W, y: (AREA_GRID[area].row - 1) * height,
});
export function areaAtPoint(x: number, y: number, height = sceneH): AreaId | undefined {
  return AREA_IDS.find((area) => {
    const o = areaOrigin(area, height);
    return x >= o.x && x < o.x + SCENE_W && y >= o.y && y < o.y + height;
  });
}

/** A doorway's position in its room. North doors cut through the back wall. */
export function passageSpot(direction: Direction): { x: number; y: number } {
  if (direction === 'up') return { x: 160, y: 48 };
  if (direction === 'down') return { x: 160, y: sceneH - 5 };
  return { x: direction === 'left' ? 5 : SCENE_W - 5, y: floorY(138) };
}
export const passageY = () => floorY(138);

/** Walk through the same shared doors that are drawn and used for navigation. */
export function roomRoute(from: AreaId, to: AreaId): { x: number; y: number }[] {
  if (from === to) return [];
  const search = (area: AreaId, visited: AreaId[]): { from: AreaId; to: AreaId; direction: Direction }[] | null => {
    for (const connection of areaConnections(area)) {
      if (visited.includes(connection.to)) continue;
      const edge = { from: area, ...connection };
      if (connection.to === to) return [edge];
      const rest = search(connection.to, [...visited, connection.to]);
      if (rest) return [edge, ...rest];
    }
    return null;
  };
  const path = search(from, [from]);
  return (path ?? []).flatMap(({ from: a, to: b, direction }) => {
    const source = areaOrigin(a);
    const dest = areaOrigin(b);
    const y = passageY();
    if (direction === 'left' || direction === 'right') {
      const boundary = direction === 'right' ? source.x + SCENE_W : source.x;
      const sign = direction === 'right' ? 1 : -1;
      return [{ x: source.x + 160, y: source.y + y },
        { x: boundary - sign * 12, y: source.y + y },
        { x: boundary + sign * 12, y: source.y + y },
        { x: dest.x + 160, y: dest.y + y }];
    }
    const boundary = direction === 'up' ? source.y : source.y + sceneH;
    const north = direction === 'up' ? dest : source;
    const south = direction === 'up' ? source : dest;
    const points = [{ x: south.x + 160, y: south.y + y },
      { x: south.x + 160, y: south.y + FLOOR_Y + 8 },
      { x: south.x + 160, y: south.y + 12 },
      { x: north.x + 160, y: boundary - 12 },
      { x: north.x + 160, y: north.y + y }];
    return direction === 'up' ? points : points.reverse();
  });
}

/**
 * The pass: a pickup window on the counter's right end, over the staff gate.
 * Baristas set finished table orders on it and ring the bell on its header;
 * servers collect them from the floor side.
 */
export const PASS = { x: 210, w: 40, top: 60 };
/** Plates sit three across, on the steel ledge first, then the heated shelf above. */
export const PASS_COLUMNS = 3;
export const PASS_SLOT_W = 12;
export const passSlot = (i: number) => ({
  x: PASS.x + 2 + (i % PASS_COLUMNS) * PASS_SLOT_W,
  y: i < PASS_COLUMNS ? COUNTER.top : PASS.top + 21,
});
export const PASS_BELL = { x: PASS.x + PASS.w - 6, y: PASS.top - 1 };
/** Where a server stands to take plates off the pass. */
export const passSpot = () => ({ x: PASS.x + PASS.w / 2 + 6, y: COUNTER.bottom + 8 });
/** Servers wait beside the pass between deliveries. */
export const MAX_SERVERS = 3;
export const serverHome = (i: number) => ({ x: 264 + i * 13, y: 94 + (i % 2) * 6 });

export const MAX_BARISTAS = 4;
/** Baristas stand close enough that the fourth leaves room for the pass. */
export const baristaSpot = (i: number) => ({ x: 116 + i * 25, y: 100 });
/** Where a barista works at the back bar, making an order, with their back to the room. */
export const baristaWorkSpot = (i: number) => ({ x: baristaSpot(i).x, y: 87 });
export const serviceSpot = (i: number) => ({ x: 116 + i * 25, y: 145 });
/** Moves a y position down by a share of the floor added beyond the minimum height. */
const spread = (y: number, share: number) => y + Math.round((sceneH - MIN_SCENE_H) * share);
/** The line runs across the runner, between the two lobby tables. */
export const queueSpot = (i: number) => ({ x: 120 + i * 16, y: spread(165, 0.3) });

/**
 * Floor positions are designed at the minimum height. On taller screens the floor
 * stretches: each point moves down by a share of the extra height that grows from
 * 0 at the back wall to 1 at the front wall, so things keep their order and the
 * gaps between them only ever grow. Tables and placed decorations both use this.
 */
const FLOOR_SHARES: readonly [number, number][] = [
  [FLOOR_Y, 0],
  [112, 0.15],
  [146, 0.45],
  [180, 0.8],
  [MIN_SCENE_H - 7, 1],
];
/** Keep a walking customer in the same part of their room when the canvas resizes. */
export function resizeRoomPoint(point: { x: number; y: number }, fromHeight: number): { x: number; y: number } {
  const area = areaAtPoint(point.x, point.y, fromHeight) ?? 'main';
  const oldOrigin = areaOrigin(area, fromHeight);
  const newOrigin = areaOrigin(area);
  const localY = point.y - oldOrigin.y;
  let y = localY;
  if (localY >= fromHeight - 7) y += sceneH - fromHeight;
  else if (localY > FLOOR_Y) {
    for (let i = 1; i < FLOOR_SHARES.length; i++) {
      const [lo, loShare] = FLOOR_SHARES[i - 1];
      const [hi, hiShare] = FLOOR_SHARES[i];
      const oldLo = lo + Math.round((fromHeight - MIN_SCENE_H) * loShare);
      const oldHi = hi + Math.round((fromHeight - MIN_SCENE_H) * hiShare);
      if (localY > oldHi) continue;
      const newLo = lo + Math.round((sceneH - MIN_SCENE_H) * loShare);
      const newHi = hi + Math.round((sceneH - MIN_SCENE_H) * hiShare);
      y = newLo + (localY - oldLo) / (oldHi - oldLo) * (newHi - newLo);
      break;
    }
  }
  return { x: point.x, y: newOrigin.y + y };
}
function floorShare(yMin: number): number {
  if (yMin <= FLOOR_SHARES[0][0]) return 0;
  for (let i = 1; i < FLOOR_SHARES.length; i++) {
    const [y1, s1] = FLOOR_SHARES[i];
    if (yMin <= y1) {
      const [y0, s0] = FLOOR_SHARES[i - 1];
      return s0 + ((yMin - y0) / (y1 - y0)) * (s1 - s0);
    }
  }
  return 1;
}
/** Where a floor position designed at the minimum height lands at the current height. */
export const floorY = (yMin: number) => yMin + Math.round((sceneH - MIN_SCENE_H) * floorShare(yMin));
/** The inverse of floorY: the minimum-height position shown at y on screen. */
export function floorYMin(y: number): number {
  let best = FLOOR_Y;
  for (let yMin = FLOOR_Y; yMin <= MIN_SCENE_H; yMin++) if (floorY(yMin) <= y) best = yMin;
  return best;
}

/** Three rows of tables, at their minimum-height positions. */
const ROW_Y_MIN = [112, 146, 180];
export const tableRowY = (row: number) => floorY(ROW_Y_MIN[row]);
const NOOK_X = [36, 284];
const LOBBY_X = [88, 234];
/**
 * Every table spot, in the order they're built: down each nook a row at a time,
 * alternating left and right, then one on each side of the front door.
 */
const TABLE_SPOTS: readonly { x: number; row: number }[] = [
  { x: NOOK_X[0], row: 0 },
  { x: NOOK_X[1], row: 0 },
  { x: NOOK_X[0], row: 1 },
  { x: NOOK_X[1], row: 1 },
  { x: NOOK_X[0], row: 2 },
  { x: NOOK_X[1], row: 2 },
  { x: LOBBY_X[0], row: 2 },
  { x: LOBBY_X[1], row: 2 },
];
export const MAX_TABLES = TABLE_SPOTS.length;
export const TOTAL_TABLE_SPOTS = MAX_TABLES + REGIONS.reduce((n, r) => n + r.tables, 0);
export function tablePos(i: number): { x: number; y: number } {
  const spot = tableSpotMin(i);
  const area = tableArea(i);
  const o = areaOrigin(area);
  return { x: o.x + spot.x - regionOffset(area), y: o.y + floorY(spot.y) };
}
export const tableArea = (i: number): AreaId => i < MAX_TABLES ? 'main' : REGIONS[Math.floor((i - MAX_TABLES) / 4)].id;
/** A table's position at the minimum height, for laying things out around it. */
export function tableSpotMin(i: number): { x: number; y: number } {
  if (i >= MAX_TABLES) {
    const index = i - MAX_TABLES;
    const region = REGIONS[Math.floor(index / 4)];
    return { x: regionOffset(region.id) + (index % 2 === 0 ? 64 : 256), y: ROW_Y_MIN[index % 4 < 2 ? 0 : 2] };
  }
  const spot = TABLE_SPOTS[i];
  return { x: spot.x, y: ROW_Y_MIN[spot.row] };
}
export const SEAT_OFFSET = 15;
/** Seat 0 is left of the table (facing right), seat 1 is right of it. */
export const seatSpot = (table: number, side: 0 | 1) => ({
  x: tablePos(table).x + (side === 0 ? -SEAT_OFFSET : SEAT_OFFSET),
  y: tablePos(table).y + 1,
});
/** The spot just in front of a seat, so people walk around the table rather than through it. */
export const seatApproach = (table: number, side: 0 | 1) => {
  const s = seatSpot(table, side);
  return { x: s.x, y: Math.min(s.y + 12, areaOrigin(tableArea(table)).y + sceneH - 12) };
};

/** The first window has the cat, the neon sign and the OPEN sign. */
export const WINDOWS = [{ x: 12, y: 12, w: 46, h: 38 }, { x: 262, y: 12, w: 46, h: 38 }] as const;
export const CAT_SPOT = { x: 26, y: 53 };
export const CAT_SPOTS = [CAT_SPOT, { x: 48, y: 53 }, { x: 284, y: 53 }] as const;
/** Potted figs flank the front door. */
export const doorPlantSpots = () => [
  { x: DOOR_X - 16, y: sceneH - 9 },
  { x: DOOR_X + DOOR_W + 16, y: sceneH - 9 },
];
