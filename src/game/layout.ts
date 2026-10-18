// Scene geometry in logical pixels (16px tiles, Stardew-style 3/4 view).
// Characters are positioned by their feet.
//
// Floor plan: production runs along the back wall. A cross-aisle connects the
// dining rooms; two compact dining bays flank the entrance forecourt.
// The kitchen has a separate staff connection behind the counter in the left wall.
// Customers come in through the door in the middle of the bottom edge, line up
// in front of the counter, then sit down or head back out the way they came.
import { AREA_GRID, AREA_IDS, REGIONS, areaConnections, regionOffset, type AreaId, type Direction } from './regions';

export const SCENE_W = 320;

/**
 * The café is always 320 wide; extra height becomes extra floor so the room fills
 * tall screens. The tables and the queue spread out over it (see `spread`).
 */
export const MIN_SCENE_H = 240;
export const MAX_SCENE_H = 360;
let sceneH = MIN_SCENE_H;
export const sceneHeight = () => sceneH;
export function setSceneHeight(h: number): void {
  sceneH = Math.max(MIN_SCENE_H, Math.min(MAX_SCENE_H, Math.round(h)));
}

/** Kitchen expansion follows the existing cook upgrade, independently of viewport height. */
const KITCHEN_HEIGHTS = [184, 216, 240] as const;
let kitchenStage = 0;
export const kitchenLevel = () => kitchenStage;
export function setKitchenLevel(level: number): void {
  kitchenStage = Number.isFinite(level) ? Math.max(0, Math.min(2, Math.floor(level))) : 0;
}
export const kitchenHeight = () => KITCHEN_HEIGHTS[kitchenStage];
/** Equipment anchors in the compact kitchen. Storage and washing move forward
 * when expanded; the production aisle, prep bench and hot line stay in place. */
export function kitchenFloorY(anchorY: number, level = kitchenStage): number {
  const shift = (2 - Math.max(0, Math.min(2, level))) * 8;
  return anchorY - shift * Math.max(0, Math.min(1, (anchorY - 134) / 34));
}

/** The back wall runs from the ceiling down to FLOOR_Y. */
export const FLOOR_Y = 80;
/**
 * The service counter; a glass case in its front shows today's bakes. It stands
 * forward of the back bar, leaving an aisle inside the bar for the baristas to
 * work in. The left return stops at the countertop, leaving a staff opening
 * aligned with the kitchen door behind the counter.
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

/** No freestanding window cupboards remain; keep the shared obstacle list empty. */
export const MAIN_CUPBOARDS: readonly { x: number; y: number; w: number; h: number }[] = [];

/** The front door: an opening in the bottom wall, centered. */
export const DOOR_W = 32;
export const DOOR_X = SCENE_W / 2 - DOOR_W / 2;
/** Where customers appear and disappear, just outside the front door. */
export const doorSpot = () => ({ x: SCENE_W / 2, y: sceneH + 12 });
export const areaOrigin = (area: AreaId, height = sceneH) => ({
  x: AREA_GRID[area].col * SCENE_W, y: (AREA_GRID[area].row - 1) * height,
});
/** Actual room footprint, including the shorter kitchen and the void below it. */
export const areaBounds = (area: AreaId, height = sceneH) => ({
  ...areaOrigin(area, height), w: SCENE_W, h: area === 'kitchen' ? kitchenHeight() : height,
});
export function areaAtPoint(x: number, y: number, height = sceneH): AreaId | undefined {
  return AREA_IDS.find((area) => {
    const bounds = areaBounds(area, height);
    return x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
  });
}

/** A doorway's position in its room. North doors cut through the back wall. */
export function passageSpot(direction: Direction, area: AreaId = 'main'): { x: number; y: number } {
  if (direction === 'up') return { x: 160, y: 48 };
  if (direction === 'down') return { x: 160, y: areaBounds(area).h - 5 };
  return { x: direction === 'left' ? 5 : SCENE_W - 5, y: doorwayY(area, direction) };
}
export const passageY = () => floorY(138);
/** The service door is aligned with the bar aisle, separate from guest circulation. */
export const doorwayY = (area: AreaId, direction: Direction, height = sceneH) =>
  (area === 'main' && direction === 'left') || (area === 'kitchen' && direction === 'right') ? 88 : floorY(138, height);

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
    const y = doorwayY(a, direction);
    if (direction === 'left' || direction === 'right') {
      const boundary = direction === 'right' ? source.x + SCENE_W : source.x;
      const sign = direction === 'right' ? 1 : -1;
      const service = a === 'kitchen' || b === 'kitchen';
      return [{ x: source.x + (service && a === 'main' ? 202 : 160), y: source.y + y },
        { x: boundary - sign * 12, y: source.y + y },
        { x: boundary + sign * 12, y: source.y + y },
        { x: dest.x + (service && b === 'main' ? 202 : 160), y: dest.y + y }];
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
export const serverHome = (i: number) => ({ x: 264 + i * 17, y: 119 });

export const MAX_BARISTAS = 4;
/** Baristas stand close enough that the fourth leaves room for the pass. */
export const baristaSpot = (i: number) => ({ x: 116 + i * 25, y: 100 });
/** Where a barista works at the back bar, making an order, with their back to the room. */
export const baristaWorkSpot = (i: number) => ({ x: baristaSpot(i).x, y: 87 });
export const serviceSpot = (i: number) => ({ x: 116 + i * 25, y: 145 });
/** Six waiting positions form a compact horseshoe in the entrance forecourt.
 * The centre stays open for arrivals and departures; the head faces the till. */
export const queueSpot = (i: number) => ({
  x: i < 3 ? 144 : 176,
  y: floorY(158 + (i < 3 ? i : 5 - i) * 21),
});

/**
 * Floor positions are designed at the minimum height. On taller screens the floor
 * stretches: each point moves down by a share of the extra height that grows from
 * 0 at the back wall to 1 at the front wall, so things keep their order and the
 * gaps between them only ever grow. Tables and placed decorations both use this.
 */
const FLOOR_SHARES: readonly [number, number][] = [
  [FLOOR_Y, 0],
  [128, 0.05],
  [150, 0.15],
  [174, 0.35],
  [218, 0.85],
  [MIN_SCENE_H - 7, 1],
];
/** Keep a walking customer in the same part of their room when the canvas resizes. */
export function resizeRoomPoint(point: { x: number; y: number }, fromHeight: number): { x: number; y: number } {
  const area = areaAtPoint(point.x, point.y, fromHeight) ?? 'main';
  if (area === 'kitchen') return { ...point };
  const oldOrigin = areaOrigin(area, fromHeight);
  const newOrigin = areaOrigin(area);
  const localY = point.y - oldOrigin.y;
  const localX = point.x - oldOrigin.x;
  // A walker midway through a shared doorway stays on that doorway's centre
  // line; interpolating rounded floor bands can move it half a pixel into a wall.
  for (const direction of ['left', 'right'] as const) {
    if ((direction === 'left' ? localX <= 12 : localX >= SCENE_W - 12) &&
        areaConnections(area).some(link => link.direction === direction) && Math.abs(localY - doorwayY(area, direction, fromHeight)) < .001)
      return { x: point.x, y: newOrigin.y + doorwayY(area, direction) };
  }
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
export const floorY = (yMin: number, height = sceneH) => yMin + Math.round((height - MIN_SCENE_H) * floorShare(yMin));
/** The inverse of floorY: the minimum-height position shown at y on screen. */
export function floorYMin(y: number): number {
  let best = FLOOR_Y;
  for (let yMin = FLOOR_Y; yMin <= MIN_SCENE_H; yMin++) if (floorY(yMin) <= y) best = yMin;
  return best;
}

/** Extension rooms retain their original stable table arrangement. */
const ROW_Y_MIN = [112, 146, 180];
export const tableRowY = (row: number) => floorY(ROW_Y_MIN[row]);
/** Main dining bays fill from the two intimate starter tables outward. Stable
 * indices preserve reservations, table upgrades and save capacity. */
const TABLE_SPOTS: readonly { x: number; y: number }[] = [
  { x: 100, y: 174 }, { x: 220, y: 174 },
  { x: 40, y: 174 }, { x: 280, y: 174 },
  { x: 100, y: 218 }, { x: 220, y: 218 },
  { x: 40, y: 218 }, { x: 280, y: 218 },
];
export const MAX_TABLES = TABLE_SPOTS.length;
export const TOTAL_TABLE_SPOTS = MAX_TABLES + REGIONS.reduce((n, r) => n + r.tables, 0);
export function tablePos(i: number): { x: number; y: number } {
  return tablePosAtHeight(i, sceneH);
}
/** Explicit height keeps tablePos safe to pass directly to array callbacks. */
export function tablePosAtHeight(i: number, height: number): { x: number; y: number } {
  const spot = tableSpotMin(i);
  const area = tableArea(i);
  const o = areaOrigin(area, height);
  return { x: o.x + spot.x - regionOffset(area), y: o.y + floorY(spot.y, height) };
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
  return { ...spot };
}
/** Shared by walking endpoints and the authored seating artwork. */
export const SEAT_OFFSET = 20;
/** Ground footprint includes both chairs and room for the seated figures. */
export const TABLE_HALF_WIDTH = 36;
export const tableFootprint = (table: number) => {
  const p = tablePos(table);
  return { x: p.x - TABLE_HALF_WIDTH, y: p.y - 10, w: TABLE_HALF_WIDTH * 2, h: 13 };
};
/** Seat 0 is left of the table (facing right), seat 1 is right of it. */
export const seatSpot = (table: number, side: 0 | 1) => ({
  x: tablePos(table).x + (side === 0 ? -SEAT_OFFSET : SEAT_OFFSET),
  y: tablePos(table).y + 1,
});
/** Clear apron for entering a chair, in front or in the rear aisle. */
export const seatApproach = (table: number, side: 0 | 1) => {
  const s = seatSpot(table, side), p = tablePos(table), area = tableArea(table);
  // The entrance pots close the front aisle of the rear dining row on compact
  // screens. Always use its rear aisle, so resizing never changes that route.
  const rearAisle = area === 'main' && tableSpotMin(table).y === 218;
  return { x: s.x, y: rearAisle ? p.y - 20 : Math.min(s.y + 12, areaOrigin(area).y + sceneH - 9) };
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
