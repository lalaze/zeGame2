import { mix } from './color';

type Ctx = CanvasRenderingContext2D;
type Mark = readonly [x: number, y: number, width: number, height: number];

// Authored in the main window's 46 × 38 world-pixel space. Half-pixel marks
// become crisp single pixels on the room's 2× backing canvas.
const DESIGN_W = 46;
const DESIGN_H = 38;

const LEAVES: readonly (readonly Mark[])[] = [
  [[2, 1, 1.5, .5], [4, 1.5, 1, .5], [1, 2.5, 1, 1], [3, 3, 1.5, .5], [5.5, 3, .5, 1], [2, 4.5, 1, .5], [4.5, 5, 1.5, .5]],
  [[3, .5, 1, .5], [1.5, 2, 1.5, .5], [4.5, 2.5, 1, 1], [.5, 3.5, 1, .5], [2.5, 4, 1, 1], [5.5, 4.5, 1, .5], [3.5, 5.5, 1, .5]],
  [[2.5, 1, 1, .5], [4.5, 1.5, 1, 1], [1, 2.5, 1.5, .5], [3.5, 3, .5, 1], [5, 4, 1.5, .5], [1.5, 4.5, 1, .5], [3, 5.5, 1.5, .5]],
];

/**
 * A little painted neighborhood beyond the main café windows. Pass the whole
 * glass rectangle, not just the tree-line strip. The upper third is transparent
 * so the caller's animated sky, clouds, sun and stars remain visible.
 *
 * All shapes are hard-edged rectangles on a half-world-pixel grid. No canvas
 * transform, filter, image smoothing or clipping state is changed. Rectangles
 * are clipped numerically, including for unusually small or fractional bounds.
 */
export function paintPixelWindowVillage(
  ctx: Ctx, x: number, y: number, w: number, h: number, darkness = 0,
): void {
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return;
  const dark = Number.isFinite(darkness) ? Math.max(0, Math.min(1, darkness)) : 0;
  // Color interpolation happens only here, never in the foliage/roof loops.
  const tone = (day: string, night: string) => mix(day, night, dark);
  const p = {
    farGround: tone('#a3b78b', '#304e49'),
    farLeaf: tone('#92b27c', '#34594c'),
    farShade: tone('#729979', '#29453f'),
    farLight: tone('#bfd094', '#476858'),
    farWall: tone('#dfd7b9', '#58636b'),
    farSide: tone('#b8bfaa', '#3f555e'),
    farRoof: tone('#b88a7d', '#535462'),
    farRoofLight: tone('#d5aa8b', '#6c6870'),
    farGlass: tone('#8aabb0', '#859681'),
    wall: tone('#eee0b6', '#67767c'),
    wallSide: tone('#c9be98', '#465a64'),
    roof: tone('#ae6955', '#494650'),
    roofLight: tone('#d89167', '#78696b'),
    roofShade: tone('#895e4f', '#353e49'),
    glass: tone('#709795', '#e0b87b'),
    sill: tone('#f9ebc8', '#a6a486'),
    trunk: tone('#697143', '#283b38'),
    leafDeep: tone('#3c6949', '#193c37'),
    leafShade: tone('#527d45', '#234c3e'),
    leaf: tone('#76a14e', '#356247'),
    leafLight: tone('#a5bd5c', '#507a51'),
    leafSun: tone('#d0d677', '#688b62'),
    grass: tone('#809e50', '#2c5140'),
  };
  const half = (value: number) => Math.round(value * 2) / 2;
  const r = (dx: number, dy: number, rw: number, rh: number, color: string) => {
    const left = Math.max(0, Math.min(w, half(dx * w / DESIGN_W)));
    const top = Math.max(0, Math.min(h, half(dy * h / DESIGN_H)));
    const right = Math.max(0, Math.min(w, half((dx + rw) * w / DESIGN_W)));
    const bottom = Math.max(0, Math.min(h, half((dy + rh) * h / DESIGN_H)));
    if (right <= left || bottom <= top) return;
    ctx.fillStyle = color;
    ctx.fillRect(x + left, y + top, right - left, bottom - top);
  };

  // Pale, broken distant horizon. It sits behind the architecture and foliage;
  // no color is laid over the open sky above the first chimney.
  r(0, 29, 46, 9, p.farGround);
  for (const [dx, dy, rw, rh] of [
    [0, 23.5, 5, 6], [4, 22, 6.5, 7.5], [9, 24, 6, 5.5],
    [14, 26, 8, 3.5], [21, 25, 7, 4.5], [27, 23.5, 7, 6],
    [33, 22, 6, 7.5], [38, 24, 8, 5.5],
  ]) r(dx, dy, rw, rh, p.farLeaf);

  // A distant village: quieter contrast, shallow warm roofs, tiny chimneys.
  const farHouse = (hx: number, hy: number, width: number, height: number) => {
    r(hx, hy, width, height, p.farWall);
    r(hx + width - 1.5, hy, 1.5, height, p.farSide);
    r(hx - .5, hy - .5, width + 1, .5, p.farRoof);
    r(hx, hy - 1.5, width, 1, p.farRoof);
    r(hx + 1.5, hy - 2.5, width - 3, 1, p.farRoofLight);
    r(hx + width - 2.5, hy - 4, 1, 2, p.farRoof);
    r(hx + width - 3, hy - 4, 1.5, .5, p.farRoofLight);
    for (let wx = 1; wx < width - 1.5; wx += 2.5) {
      r(hx + wx, hy + 1.5, 1, 1.5, p.farGlass);
      r(hx + wx, hy + 4, 1, 1.5, p.farGlass);
    }
  };
  farHouse(13.5, 22, 7, 8);
  farHouse(29.5, 21, 7.5, 9);
  // One slim roofline makes the skyline feel inhabited without busying it.
  r(34.5, 18, 3, 6, p.farWall);
  r(36.5, 18, 1, 6, p.farSide);
  r(34, 17.5, 4, .5, p.farRoof);
  r(34.5, 16.5, 3, 1, p.farRoof);
  r(35.5, 16, 1, .5, p.farRoofLight);
  r(35.5, 19, .5, 1.5, p.farGlass);

  // Each crown is an irregular group of interlocking lobes, with a lit upper
  // shoulder and shaded underside. Leaf flecks are authored, not random noise.
  const crown = (cx: number, cy: number, size: number, variant: number, far = false) => {
    const cr = (dx: number, dy: number, rw: number, rh: number, color: string) =>
      r(cx + dx * size, cy + dy * size, rw * size, rh * size, color);
    const shade = far ? p.farShade : p.leafDeep;
    const body = far ? p.farLeaf : p.leafShade;
    const lit = far ? p.farLight : p.leaf;
    const glint = far ? p.farLight : p.leafLight;
    cr(2, 0, 3, .5, body);
    cr(1, .5, 5, 1, body);
    cr(.5, 1.5, 6, 1.5, body);
    cr(0, 3, 7.5, 2, shade);
    cr(.5, 5, 6.5, 1.5, shade);
    cr(1.5, 6.5, 4, 1, shade);
    cr(.5, 2.5, 3.5, 3, body);
    cr(3.5, 1.5, 3, 3.5, body);
    cr(1.5, 1, 3, 2.5, lit);
    cr(.5, 2, 2, 1.5, lit);
    cr(4, 2, 2, 1.5, lit);
    cr(2, 4, 2.5, 2, lit);
    cr(5, 4.5, 1.5, 1, body);
    cr(1, 5.5, 1, .5, body);
    for (const [lx, ly, lw, lh] of LEAVES[variant % LEAVES.length]) cr(lx, ly, lw, lh, glint);
    if (!far) {
      cr(2 + variant % 2, 1, .5, .5, p.leafSun);
      cr(1, 2.5, 1, .5, p.leafSun);
      cr(4.5, 3.5, .5, .5, p.leafSun);
      // Smaller leaf pairs break the broad color planes at backing-pixel
      // resolution without turning the whole crown into checkerboard noise.
      cr(2.5, 2, .5, .5, p.leafLight);
      cr(3.5, 2.5, .5, .5, p.leafShade);
      cr(.5, 4, .5, .5, p.leafLight);
      cr(2, 3.5, .5, .5, p.leafShade);
      cr(4, 4.5, .5, .5, p.leafLight);
      cr(5.5, 5, .5, .5, p.leafLight);
      cr(2.5, 5.5, .5, .5, p.leafShade);
      cr(3.5, 6, 1.5, .5, p.leafDeep);
    }
  };

  // Soft far trees overlap parts of the first row of houses.
  crown(-2, 19, 1.35, 0, true);
  crown(5.5, 22, 1.1, 1, true);
  crown(38.5, 20.5, 1.2, 2, true);
  crown(16, 28, .9, 2, true);

  // The closer cream house stays visible between the two foreground trees.
  r(23, 27, 10, 9.5, p.wall);
  r(31, 27, 2, 9.5, p.wallSide);
  r(23, 27, 8, .5, p.roofShade);
  r(22, 26, 12, 1, p.roofShade);
  r(22.5, 25, 11, 1, p.roof);
  r(23.5, 24, 9, 1, p.roof);
  r(25, 23, 6, 1, p.roofLight);
  r(26, 22.5, 4, .5, p.roofLight);
  r(30.5, 21.5, 1, 2.5, p.roofShade);
  r(30, 21, 2, .5, p.roofLight);
  // Broken half-pixel tiles, not continuous horizontal stripes.
  for (const [tx, ty, tw] of [[25, 23.5, 1], [27.5, 24.5, 1.5], [24, 25, 1], [30, 25, 1.5]]) {
    r(tx, ty, tw, .5, p.roofLight);
  }
  for (const wx of [24.5, 28]) for (const wy of [28.5, 32]) {
    r(wx, wy, 1.5, 2, p.glass);
    r(wx + .5, wy, .5, 2, p.wallSide);
    r(wx - .5, wy + 2, 2.5, .5, p.sill);
    r(wx, wy - .5, 1.5, .5, p.sill);
  }
  r(31.5, 29, .5, 1.5, p.glass);
  r(26.5, 35, 1.5, 3, p.roofShade);
  r(22.5, 36.5, 11, .5, p.wallSide);

  // A foreground pair frames that house. Crown heights and overlaps are
  // deliberately asymmetric, avoiding the repeated round hedge appearance.
  r(6.5, 26, 1, 12, p.trunk);
  r(38.5, 25, 1, 13, p.trunk);
  crown(-3, 26, 1.4, 2);
  crown(2.5, 22, 1.15, 0);
  crown(8.5, 25, 1.05, 1);
  crown(1, 29.5, 1.4, 1);
  crown(10.5, 31, 1.1, 2);
  crown(40, 21.5, 1.2, 2);
  crown(35, 25.5, 1.3, 1);
  crown(41, 29, 1.3, 0);
  crown(32.5, 33, .95, 0);

  // Low garden foliage softens the bottom edge while keeping a small glimpse
  // of the house's front path. A few half-pixel tips catch the afternoon sun.
  r(0, 37, 22.5, 1, p.grass);
  r(29, 37, 17, 1, p.leafShade);
  for (const [gx, gy, gw] of [[2, 36.5, 1.5], [14, 36, 1], [17.5, 37, 1.5], [21, 36.5, .5], [34, 37, 1], [44, 36, 1.5]]) {
    r(gx, gy, gw, .5, p.leafLight);
  }
}
