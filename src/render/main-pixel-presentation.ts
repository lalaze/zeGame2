import { widenRoomX, narrowRoomX } from './room-width';
import { COUNTER, FLOOR_Y, SCENE_W, doorwayY, sceneHeight } from '../game/layout';
import { projectPoint, unprojectPoint, type PixelPoint, type PixelProjectionOptions } from './pixel-projection';

/** One shared visual setup. Pass the current room height; gameplay stays logical. */
export function mainPixelProjection(height = sceneHeight()): PixelProjectionOptions {
  return {
    enabled: true, area: 'main', width: SCENE_W, floorTop: FLOOR_Y, floorBottom: height - 7, backScale: 0.9,
    doorways: [{ side: 'left', y: doorwayY('main', 'left') }, { side: 'right', y: doorwayY('main', 'right') }],
  };
}

const inMain = (p: PixelPoint) => p.x >= 0 && p.x <= SCENE_W && p.y >= 0 && p.y <= sceneHeight();

/** Floor coordinates, including both shared door boundaries; other rooms stay exact. */
export function projectMainWorld(point: PixelPoint): PixelPoint {
  const painted = inMain(point) ? projectPoint(point, mainPixelProjection()) : { ...point };
  return point.y >= 0 && point.y <= sceneHeight() ? { x: widenRoomX(painted.x), y: painted.y } : painted;
}

export function unprojectMainWorld(point: PixelPoint): PixelPoint {
  const base = point.y >= 0 && point.y <= sceneHeight() ? { x: narrowRoomX(point.x), y: point.y } : point;
  return inMain(base) ? unprojectPoint(base, mainPixelProjection()) : { ...base };
}

/** Fixed architecture planes are horizontal affine maps, without portal notches. */
export function projectMainPlaneWorld(point: PixelPoint, anchorY = FLOOR_Y): PixelPoint {
  if (!inMain(point) || !inMain({ x: point.x, y: anchorY })) return { ...point };
  return { x: projectPoint({ x: point.x, y: anchorY }, { ...mainPixelProjection(), doorways: [] }).x, y: point.y };
}

export function unprojectMainPlaneWorld(point: PixelPoint, anchorY = FLOOR_Y): PixelPoint {
  if (!inMain(point) || !inMain({ x: point.x, y: anchorY })) return { ...point };
  return { x: unprojectPoint({ x: point.x, y: anchorY }, { ...mainPixelProjection(), doorways: [] }).x, y: point.y };
}

/** Keep all upright attachments at exactly the same displacement as their owner. */
export function projectMainAttachment(point: PixelPoint, anchor: PixelPoint): PixelPoint {
  const foot = projectMainWorld(anchor);
  return { x: point.x + foot.x - anchor.x, y: point.y };
}

/** Sample edges as well as corners, so ghosts follow the local portal transitions. */
export function projectMainCellOutline(rect: { x: number; y: number; w: number; h: number }, surface: 'floor' | 'wall', area: string): PixelPoint[] {
  const points: PixelPoint[] = [];
  const corners = [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }];
  for (let side = 0; side < corners.length; side++) {
    const a = corners[side], b = corners[(side + 1) % corners.length];
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / 2));
    for (let i = 0; i < count; i++) {
      const point = { x: a.x + (b.x - a.x) * i / count, y: a.y + (b.y - a.y) * i / count };
      points.push(area !== 'main' ? point : surface === 'wall' ? projectMainPlaneWorld(point, FLOOR_Y) : projectMainWorld(point));
    }
  }
  return points;
}

export const MAIN_WALL_PLANE = FLOOR_Y;
export const MAIN_COUNTER_PLANE = COUNTER.bottom;
