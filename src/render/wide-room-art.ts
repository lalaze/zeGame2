import { paintPixelFloorDepth } from './pixel-floor-depth';
import { FLOOR_Y, SCENE_W } from '../game/layout';
import { paintFloor, paintWall, paintWainscot, wainscotColor } from './decor-art';
import { paintFineBeam } from './pixel-joinery';
import { paintPixelRoomShell } from './pixel-room-shell';
import { roomPresentationWidth, roomSideSpace } from './room-width';

/** Extend architecture at its native pixel density; never stretch the room bitmap. */
export function paintWideRoom(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement,
  density: number, height: number, wallpaper: string, floor: string, front: boolean): void {
  const width = roomPresentationWidth(), side = roomSideSpace();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (!front) {
    if (wallpaper === 'wall_cream') {
      ctx.fillStyle = '#efdfc1'; ctx.fillRect(0, 6, width, 55);
      for (let x = 0; x < width; x += 8) {
        ctx.fillStyle = '#d6bd95'; ctx.fillRect(x, 6, 1, 55);
        ctx.fillStyle = '#fff0d6'; ctx.fillRect(x + 1, 6, 1, 55);
        ctx.fillStyle = '#e5cfaa'; ctx.fillRect(x + 4, 6, 1, 55);
      }
    } else paintWall(ctx, wallpaper, 0, 6, width, 74, 0);
    paintWainscot(ctx, wallpaper, 0, 61, width, 19);
    if (floor === 'floor_checker') paintPixelFloorDepth(ctx, 0, FLOOR_Y, width, height - FLOOR_Y, 17,
      { pixelSize: .5, columns: Math.max(12, Math.round(width / SCENE_W * 12)), rows: 8, horizontalBackScale: 1 });
    else paintFloor(ctx, floor, 0, FLOOR_Y, width, height - FLOOR_Y);
    paintFineBeam(ctx, 0, 0, width, 8);
    // The original furnishing layer remains unchanged and centred.
    ctx.drawImage(source, side, 0, SCENE_W, height);
    // Fresh outer posts and shallow reveals, not magnified edge pixels.
    paintPixelRoomShell(ctx, height, { enabled: true, area: 'main', width,
      floorTop: FLOOR_Y, floorBottom: height - 7, backScale: 1,
      doorways: [{ side: 'left', y: 88 }, { side: 'right', y: 138 }] });
  } else {
    // Continue the front sill across each new bay; keep the original entrance.
    const y = height - 7;
    paintFineBeam(ctx, 0, y, side + 16, 7, false, wainscotColor(wallpaper));
    paintFineBeam(ctx, side + SCENE_W - 16, y, side + 16, 7, false, wainscotColor(wallpaper));
    ctx.drawImage(source, 16 * density, 0, (SCENE_W - 32) * density, height * density,
      side + 16, 0, SCENE_W - 32, height);
    // Side doors and their trim move as intact sixteen-unit strips.
    ctx.drawImage(source, 0, 0, 16 * density, height * density, 0, 0, 16, height);
    ctx.drawImage(source, (SCENE_W - 16) * density, 0, 16 * density, height * density,
      width - 16, 0, 16, height);
  }
  ctx.restore();
}
