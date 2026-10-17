import { artRamp } from './main-room-surfaces';
import { projectPoint, type PixelProjectionOptions } from './pixel-projection';

/** The narrow exposed inner faces live behind movable objects, never over their feet. */
export function paintPixelRoomShell(ctx: CanvasRenderingContext2D, height: number, options: PixelProjectionOptions, wallpaper = 'wall_cream'): void {
  const width = options.width ?? 320;
  const paper = artRamp(wallpaper === 'wall_mint' ? 'cloth-2' : wallpaper === 'wall_rose' ? 'cloth-5' : wallpaper === 'wall_stars' ? 'pants-0' : wallpaper === 'wall_dots' ? 'cloth-1' : wallpaper === 'wall_brick' ? 'terracotta' : wallpaper === 'wall_walnut' ? 'walnut' : 'cloth-7');
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  };
  ctx.save();
  for (let y = 0; y < height - 7; y += 0.5) {
    for (const side of ['left', 'right'] as const) {
      const edge = Math.round(projectPoint({ x: side === 'left' ? 0 : width, y }, options).x * 2) / 2;
      const depth = side === 'left' ? edge : width - edge;
      if (depth < 1) continue;
      const x = side === 'left' ? 0 : width - depth;
      const warm = paper[side === 'left' ? paper.length - 1 : Math.max(0, paper.length - 2)];
      r(x, y, depth, .5, warm);
      // Quiet panel-paper stripes recede with the wall face rather than sitting on the floor.
      if (Math.floor(y * 2) % 25 === 1) r(x + .5, y, Math.max(0, depth - 1), .5, '#efdfbe');
      const rail = side === 'left' ? edge - Math.min(1.5, depth) : edge;
      r(rail, y, Math.min(1.5, depth), .5, '#61311d');
      r(side === 'left' ? rail : rail + 1, y, .5, .5, '#dfa261');
      r(side === 'left' ? 1 : width - 2, y, Math.min(1, depth), .5, '#81401f');
      // Sparse vertical wood fibres, not a repeated dark rectangular border.
      if (Math.floor(y) % 19 < 8 && depth > 4) r(side === 'left' ? 2 : width - 3, y, .5, .5, '#c0824f');
    }
  }
  // Chunky outer oak posts and projecting collars frame the diorama. They
  // stay in the existing outer wall margin and never cover a walkable foot.
  for (const side of ['left', 'right'] as const) {
    const x = side === 'left' ? 0 : width - 5;
    r(x, 0, 5, height - 7, '#55301f');
    r(x + 1, 0, 3, height - 7, '#ae602e');
    r(side === 'left' ? x + 1 : x + 3.5, 1, .5, height - 9, '#dfa261');
    r(side === 'left' ? x + 4 : x, 1, .5, height - 9, '#42251a');
    for (const y of [2, 39, height - 70, height - 30, height - 12]) {
      r(Math.max(0, x - 1), y, 6, 4, '#55301f');
      r(Math.max(0, x - 1), y, 6, .5, '#dfa261');
      r(Math.max(0, x - .5), y + .5, 5.5, 1.5, '#c0824f');
    }
  }
  // An architectural header and rear reveal above the original floor opening.
  // This is background joinery; paintRoomBoundaries retains its <=8px sill.
  const kitchen = options.doorways?.find(door => door.side === 'left');
  if (kitchen) {
    const y = kitchen.y, rise = Math.max(0, (options.floorTop ?? 80) - (y - 14));
    if (rise > 0) {
      r(1, y - 14, 15, rise, '#81401f');
      r(2, y - 14, 13, .5, '#c0824f');
      r(14.5, y - 13, .5, Math.max(0, rise - 1), '#f6c87b');
    }
    for (let step = 0; step < 16; step++) {
      const top = y - 18 - Math.floor(step / 5) * .5;
      r(step + 1, top, 1, 3, '#42251a');
      r(step + 1, top, 1, .5, '#dfa261');
      r(step + 1, top + .5, 1, 1, '#ae602e');
    }
  }
  ctx.restore();
}
