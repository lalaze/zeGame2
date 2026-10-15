import { SCENE_W } from '../game/layout';

// Presentation only: never change simulation coordinates or saved furniture cells.
let width = SCENE_W;
export const roomPresentationWidth = () => width;
export const roomSideSpace = () => (width - SCENE_W) / 2;
export function setRoomPresentationWidth(value: number): void {
  width = Number.isFinite(value) ? Math.max(SCENE_W, value) : SCENE_W;
}
export function fittedRoomWidth(availableWidth: number, availableHeight: number, height: number, enabled: boolean): number {
  return enabled && availableWidth > 0 && availableHeight > 0
    ? Math.max(SCENE_W, availableWidth * height / availableHeight) : SCENE_W;
}
// Keep the furnished centre intact. Only the twenty-unit side-door approaches
// grow into the new side bays; this monotone map also works across a doorway.
const EDGE = 40;
const RIM = 16;
export function widenRoomX(x: number): number {
  const extra = roomSideSpace();
  if (x <= RIM) return x - extra;
  if (x < EDGE) return RIM - extra + (x - RIM) * (EDGE - RIM + extra) / (EDGE - RIM);
  if (x <= SCENE_W - EDGE) return x;
  if (x < SCENE_W - RIM) return SCENE_W - RIM + extra - (SCENE_W - RIM - x) * (EDGE - RIM + extra) / (EDGE - RIM);
  return x + extra;
}
export function narrowRoomX(x: number): number {
  const extra = roomSideSpace();
  if (x <= RIM - extra) return x + extra;
  if (x < EDGE) return RIM + (x - RIM + extra) * (EDGE - RIM) / (EDGE - RIM + extra);
  if (x <= SCENE_W - EDGE) return x;
  if (x < SCENE_W - RIM + extra) return SCENE_W - RIM - (SCENE_W - RIM + extra - x) * (EDGE - RIM) / (EDGE - RIM + extra);
  return x - extra;
}
