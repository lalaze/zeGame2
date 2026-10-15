import { DOOR_W, DOOR_X, passageY } from '../game/layout';
import { generatedMainSource } from './generated-main-art';

const FRONT_WALL = 7;

/** One woven family, joined around the existing T-shaped circulation footprint. */
export function paintMainCarpet(ctx: CanvasRenderingContext2D, height: number, entryStem: boolean): boolean {
  const source = generatedMainSource('main-runner');
  if (!source) return false;
  const sw = source.width, sh = source.height, cap = Math.round(sh * .16);
  const top = passageY() - 7;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  // End embroidery and rounded corners keep their scale; only quiet weave extends.
  const strip = (x: number, y: number, width: number, length: number, head = true) => {
    const end = Math.min(cap * width / sw, length / 2), start = head ? end : 0;
    if (head) ctx.drawImage(source, 0, 0, sw, cap, x, y, width, start);
    ctx.drawImage(source, 0, cap, sw, sh - cap * 2, x, y + start, width, length - start - end);
    ctx.drawImage(source, 0, sh - cap, sw, cap, x, y + length - end, width, end);
  };
  // Keep the right-hand wooden doorway sill exposed at x312.
  ctx.save(); ctx.translate(64, top + 14); ctx.rotate(-Math.PI / 2);
  strip(0, 0, 14, 248); ctx.restore();
  if (entryStem) {
    const bottom = height - FRONT_WALL - 1;
    strip(145, top + 14, 30, bottom - top - 14, false);
    // Remove the transverse lower binding at the junction, leaving a single T.
    // This uses the same authored center weave, never an unrelated flat color.
    ctx.drawImage(source, sw * .20, sh * .35, sw * .60, sh * .2,
      147, top + 2, 26, 14);
  } else {
    ctx.save(); ctx.translate(DOOR_X + 2, height - FRONT_WALL - 1); ctx.rotate(-Math.PI / 2);
    strip(0, 0, 8, DOOR_W - 4); ctx.restore();
  }
  ctx.restore(); return true;
}
