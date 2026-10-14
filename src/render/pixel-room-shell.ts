import { projectPoint, type PixelProjectionOptions } from './pixel-projection';

/** The narrow exposed inner faces live behind movable objects, never over their feet. */
export function paintPixelRoomShell(ctx: CanvasRenderingContext2D, height: number, options: PixelProjectionOptions): void {
  const width = options.width ?? 320;
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
      const warm = side === 'left' ? '#decea9' : '#c9b48e';
      r(x, y, depth, .5, warm);
      // Quiet panel-paper stripes recede with the wall face rather than sitting on the floor.
      if (Math.floor(y * 2) % 25 === 1) r(x + .5, y, Math.max(0, depth - 1), .5, '#eee0bc');
      const rail = side === 'left' ? edge - Math.min(1.5, depth) : edge;
      r(rail, y, Math.min(1.5, depth), .5, '#714529');
      r(side === 'left' ? rail : rail + 1, y, .5, .5, '#c48b52');
      r(side === 'left' ? 1 : width - 2, y, Math.min(1, depth), .5, '#865332');
      // Sparse vertical wood fibres, not a repeated dark rectangular border.
      if (Math.floor(y) % 19 < 8 && depth > 4) r(side === 'left' ? 2 : width - 3, y, .5, .5, '#b1814f');
    }
  }
  // Chunky outer oak posts and projecting collars frame the diorama. They
  // stay in the existing outer wall margin and never cover a walkable foot.
  for (const side of ['left', 'right'] as const) {
    const x = side === 'left' ? 0 : width - 5;
    r(x, 0, 5, height - 7, '#684730');
    r(x + 1, 0, 3, height - 7, '#92603b');
    r(side === 'left' ? x + 1 : x + 3.5, 1, .5, height - 9, '#c39460');
    r(side === 'left' ? x + 4 : x, 1, .5, height - 9, '#463022');
    for (const y of [2, 39, height - 70, height - 30, height - 12]) {
      r(Math.max(0, x - 1), y, 6, 4, '#563b29');
      r(Math.max(0, x - 1), y, 6, .5, '#d5aa72');
      r(Math.max(0, x - .5), y + .5, 5.5, 1.5, '#a67649');
    }
  }
  // An architectural header and rear reveal above the original floor opening.
  // This is background joinery; paintRoomBoundaries retains its <=8px sill.
  const kitchen = options.doorways?.find(door => door.side === 'left');
  if (kitchen) {
    const y = kitchen.y, rise = Math.max(0, (options.floorTop ?? 80) - (y - 14));
    if (rise > 0) {
      r(1, y - 14, 15, rise, '#795333');
      r(2, y - 14, 13, .5, '#b58350');
      r(14.5, y - 13, .5, Math.max(0, rise - 1), '#dec08a');
    }
    for (let step = 0; step < 16; step++) {
      const top = y - 18 - Math.floor(step / 5) * .5;
      r(step + 1, top, 1, 3, '#573721');
      r(step + 1, top, 1, .5, '#d5a365');
      r(step + 1, top + .5, 1, 1, '#9e6b3c');
    }
  }
  ctx.restore();
}
