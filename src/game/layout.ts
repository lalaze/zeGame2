// Scene geometry in logical pixels (16px tiles, Stardew-style 3/4 view).
// Characters are positioned by their feet.
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
export const COUNTER = { x: 8, w: 200, top: 90, front: 101, bottom: 122 };

export const DOOR = { x: 282, y: 28, w: 26, h: 52 };
export const DOOR_SPOT = { x: DOOR.x + DOOR.w / 2, y: FLOOR_Y + 6 };

export const MAX_BARISTAS = 4;
export const baristaSpot = (i: number) => ({ x: 56 + i * 36, y: 98 });
export const serviceSpot = (i: number) => ({ x: 56 + i * 36, y: 140 });
/** Moves a y position down by a share of the floor added beyond the minimum height. */
const spread = (y: number, share: number) => y + Math.round((sceneH - MIN_SCENE_H) * share);
export const queueSpot = (i: number) => ({ x: 70 + i * 21, y: spread(172, 0.3) });

/** Both rows of tables move down when there's more floor, the front row the most. */
export const backRowY = () => spread(134, 0.2);
export const frontRowY = () => spread(180, 0.75);
export function tablePos(i: number): { x: number; y: number } {
  return [
    { x: 246, y: backRowY() },
    { x: 246, y: frontRowY() },
    { x: 294, y: frontRowY() },
    { x: 294, y: backRowY() },
  ][i];
}
/** Seat 0 is left of the table (facing right), seat 1 is right of it. */
export const seatSpot = (table: number, side: 0 | 1) => ({
  x: tablePos(table).x + (side === 0 ? -17 : 17),
  y: tablePos(table).y + 1,
});

export const WINDOW = { x: 214, y: 12, w: 52, h: 40 };
export const CAT_SPOT = { x: 230, y: 55 };
