import { mix } from './color';

export interface FineSpriteArt {
  readonly canvas: HTMLCanvasElement;
  readonly density: number;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
}

const artwork = new WeakMap<HTMLCanvasElement, FineSpriteArt>();
const deferred = new WeakMap<HTMLCanvasElement, () => void>();
const backings = new WeakSet<HTMLCanvasElement>();

/** Registered backings are finished artwork: painters never draw into them again. */
export function isFineBacking(canvas: HTMLCanvasElement): boolean { return backings.has(canvas); }

/** Source canvases keep their legacy dimensions, anchors and UI contracts. */
export function fineSpriteArt(original: HTMLCanvasElement): FineSpriteArt {
  const paint = deferred.get(original);
  if (paint) { deferred.delete(original); paint(); }
  let art = artwork.get(original);
  if (!art) {
    art = Object.freeze({ canvas: original, density: 1, logicalWidth: original.width, logicalHeight: original.height });
    artwork.set(original, art);
  }
  return art;
}

/** Register an independently authored backing image without resizing its source. */
export function registerFineSpriteArt(original: HTMLCanvasElement, canvas: HTMLCanvasElement, density = 2): void {
  if (!Number.isInteger(density) || density < 1 || canvas.width !== original.width * density || canvas.height !== original.height * density) {
    throw new Error('Fine sprite backing dimensions must match its logical source.');
  }
  deferred.delete(original);
  backings.add(canvas);
  artwork.set(original, Object.freeze({ canvas, density, logicalWidth: original.width, logicalHeight: original.height }));
}

/** Phaser crop coordinates are physical texture pixels, even on scaled images. */
export function logicalCrop(original: HTMLCanvasElement, x: number, y: number, width: number, height: number) {
  const { density, logicalWidth, logicalHeight } = fineSpriteArt(original);
  const left = Math.min(logicalWidth, Math.max(0, x));
  const top = Math.min(logicalHeight, Math.max(0, y));
  const right = Math.min(logicalWidth, Math.max(left, x + width));
  const bottom = Math.min(logicalHeight, Math.max(top, y + height));
  return { x: left * density, y: top * density, width: (right - left) * density, height: (bottom - top) * density };
}

/** Called once alongside the cached legacy mirror, never during scene painting. */
export function mirrorFineSpriteArt(original: HTMLCanvasElement, mirrored: HTMLCanvasElement): void {
  if (!deferred.has(original) && (artwork.get(original)?.density ?? 1) === 1) return;
  deferred.set(mirrored, () => {
    const art = fineSpriteArt(original);
    const canvas = document.createElement('canvas');
    canvas.width = art.canvas.width; canvas.height = art.canvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(art.canvas, 0, 0);
    registerFineSpriteArt(mirrored, canvas, art.density);
  });
}

type Palette = Readonly<Record<string, string>>;
type View = 'front' | 'side' | 'back';
const tones = new WeakMap<Palette, ReturnType<typeof makeTones>>();
function makeTones(p: Palette) {
  return {
    hairLight: mix(p.H, p.L, 0.72), hairGlint: mix(p.L, '#f4d8b0', 0.12), hairShade: mix(p.H, p.h, 0.65),
    skinLight: mix(p.S, p.Z, 0.55), skinShade: mix(p.S, p.s, 0.43), cheek: mix(p.S, p.B, 0.65),
    clothLight: mix(p.T, p.U, 0.65), clothShade: mix(p.T, p.t, 0.68),
    apronLight: mix(p.R, p.J, 0.68), apronShade: mix(p.R, p.r, 0.70),
    trouserLight: mix(p.P, '#bcc0ad', 0.25), trouserShade: mix(p.P, p.p, 0.62),
    leatherLight: mix(p.K, '#dfb783', 0.5), leatherShade: mix(p.K, p.k, 0.7),
    seam: mix(p.W, p.w, 0.45), eyeLight: mix(p.S, '#fff8df', 0.36),
  };
}

/**
 * Rebuild the final pose on a half-world-pixel grid. Source garment/hair masks
 * retain every saved identity and animation, while contour corners, hair locks,
 * eyes, cheek planes, cuffs, folds and shoe toes receive real fine geometry.
 * This deliberately does not use pixelSprite's density/material-edge overlay.
 */
export function registerFineCharacterArt(original: HTMLCanvasElement, rows: readonly string[], palette: Palette,
  view: View, outline: string): void {
  if (artwork.get(original)?.density === 2 || deferred.has(original)) return;
  // Head thumbnails, legacy exports and undisplayed poses pay no 2× cost.
  deferred.set(original, () => paintFineCharacterArt(original, rows, palette, view, outline));
}

function paintFineCharacterArt(original: HTMLCanvasElement, rows: readonly string[], palette: Palette,
  view: View, outline: string): void {
  const W = original.width * 2, H = original.height * 2;
  const sourceWidth = original.width - 2;
  const at = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < sourceWidth ? rows[y][x] ?? '.' : '.';
  const occupied = (x: number, y: number) => at(x, y) !== '.';
  const material = Array<string>(W * H).fill('');
  const permitted = new Uint8Array(W * H);
  const colors = Array<string>(W * H).fill('');
  let c = tones.get(palette);
  if (!c) { c = makeTones(palette); tones.set(palette, c); }

  // Keep the original transparent envelope. Within it the fine contour turns
  // at half-pixel intervals instead of tracing a staircase of 2×2 blocks.
  for (let sy = -1; sy <= rows.length; sy++) for (let sx = -1; sx <= sourceWidth; sx++) {
    const ch = at(sx, sy);
    const solid = ch !== '.';
    const neighbours = [occupied(sx, sy - 1), occupied(sx + 1, sy), occupied(sx, sy + 1), occupied(sx - 1, sy)];
    if (!solid && !neighbours.some(Boolean)) continue;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const x = (sx + 1) * 2 + dx, y = (sy + 1) * 2 + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      permitted[i] = 1;
      if (solid) material[i] = ch;
    }
    if (!solid || neighbours.filter(Boolean).length < 2) continue;
    const x = (sx + 1) * 2, y = (sy + 1) * 2;
    if (!neighbours[0] && !neighbours[3]) material[y * W + x] = '';
    if (!neighbours[0] && !neighbours[1]) material[y * W + x + 1] = '';
    if (!neighbours[2] && !neighbours[3]) material[(y + 1) * W + x] = '';
    if (!neighbours[2] && !neighbours[1]) material[(y + 1) * W + x + 1] = '';
  }
  const mat = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H ? material[y * W + x] : '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, ch = material[i];
    if (ch) { colors[i] = palette[ch] ?? '#ff00ff'; continue; }
    if (!permitted[i]) continue;
    // Manhattan-distance outline retains the old envelope and foot baseline,
    // with fine diagonal corners rather than filling every old outline cell.
    if (mat(x - 1, y) || mat(x + 1, y) || mat(x, y - 1) || mat(x, y + 1) ||
      mat(x - 2, y) || mat(x + 2, y) || mat(x, y - 2) || mat(x, y + 2) ||
      mat(x - 1, y - 1) || mat(x + 1, y - 1) || mat(x - 1, y + 1) || mat(x + 1, y + 1)) colors[i] = outline;
  }

  // All authored marks are clipped to their semantic material, so glasses,
  // scarves, satchels and different hair shapes survive the detail pass.
  const put = (x: number, y: number, color: string, mask: string) => {
    x = Math.round(x); y = Math.round(y);
    const ch = mat(x, y);
    if (ch && mask.includes(ch)) colors[y * W + x] = color;
  };
  const stroke = (x: number, y: number, dx: number, dy: number, length: number, color: string, mask: string) => {
    for (let i = 0; i < length; i++) put(x + dx * i, y + dy * i, color, mask);
  };
  const local = (n: number) => 2 + n * 2;

  // Curving, interrupted hair locks follow the silhouette of each hairstyle.
  // Their position depends on the pose's mask, never on time or gait phase.
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < Math.min(H, 32); y++) for (let x = 0; x < W; x++) {
    if (!'HhL'.includes(mat(x, y)) || !mat(x, y)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (maxX >= minX) for (let lock = 0; lock < 5; lock++) {
    const start = minX + Math.round((maxX - minX) * (0.12 + lock * 0.18));
    const length = Math.min(12, maxY - minY - 1);
    for (let t = 0; t < length; t++) {
      const bend = Math.floor(t / 4) * (lock < 2 ? -1 : 1);
      if ((t + lock) % 7 === 6) continue;
      put(start + bend, minY + 2 + t, lock < 3 ? c.hairLight : c.hairShade, 'HhL');
      if (lock === 1 && t < 4) put(start + bend + 1, minY + 2 + t, c.hairGlint, 'HhL');
    }
  }

  // Face planes are deliberately broad; only the nose, eyelids and cheek
  // glints use single fine pixels. The eye's surrounding cells become skin.
  for (let sy = 0; sy < Math.min(14, rows.length); sy++) for (let sx = 0; sx < sourceWidth; sx++) {
    const ch = at(sx, sy), x = local(sx), y = local(sy);
    if (ch === 'E' && at(sx, sy - 1) !== 'E') {
      let height = 1;
      while (height < 4 && at(sx, sy + height) === 'E') height++;
      for (let yy = 0; yy < height * 2; yy++) for (let xx = 0; xx < 2; xx++) put(x + xx, y + yy, palette.S, 'E');
      stroke(x + 1, y, 0, 1, height * 2 - 1, palette.E, 'E');
      put(x, y, c.eyeLight, 'E');
      put(x + 1, y + height * 2 - 1, c.skinShade, 'E');
    }
    if ('SsZ'.includes(ch) && 'HhL'.includes(at(sx, sy - 1))) {
      put(x, y, c.skinShade, 'SsZ'); put(x + 1, y, c.skinShade, 'SsZ');
    }
    if (ch === 'B') {
      put(x, y, c.cheek, 'B'); put(x + 1, y, c.cheek, 'B');
      put(x, y + 1, c.skinLight, 'B'); put(x + 1, y + 1, palette.S, 'B');
    }
    if (ch === 'm') {
      put(x, y, palette.S, 'm'); put(x + 1, y + 1, c.skinShade, 'm');
    }
  }
  if (view !== 'back') {
    const noseX = local(view === 'side' ? 12 : 8);
    stroke(noseX, local(9), 0, 1, 3, c.skinLight, 'SsZ');
    put(noseX + 1, local(10), c.skinShade, 'SsZ');
    stroke(local(view === 'side' ? 10 : 6), local(11.5), 1, 0, 4, c.skinLight, 'SsZ');
  }

  // Tailored half-pixel creases, collar stitches and apron folds, registered
  // to torso anatomy rather than adding a highlight to every colored cell.
  const cloth = 'TtUV', apron = 'RrJQ';
  if (view === 'side') {
    stroke(local(6), local(15.5), 0.5, 1, 5, c.clothLight, cloth);
    stroke(local(9.5), local(17), 0, 1, 6, c.clothShade, cloth);
    stroke(local(10), local(18), 0, 1, 6, c.apronLight, apron);
    stroke(local(10.5), local(20), 1, 0, 3, c.apronShade, apron);
  } else {
    stroke(local(5), local(15.5), 1, 0.5, 4, c.clothLight, cloth);
    stroke(local(10.5), local(16), -0.5, 1, 5, c.clothShade, cloth);
    stroke(local(5), local(18), 0.5, 1, 5, c.clothShade, cloth);
    stroke(local(6), local(20), 1, 0, 5, c.clothLight, cloth);
    stroke(local(5.5), local(17.5), 0, 1, 7, c.apronLight, apron);
    stroke(local(8.5), local(18.5), 0.5, 1, 5, c.apronShade, apron);
    stroke(local(6.5), local(19.5), 1, 0, 4, c.apronLight, apron);
  }
  for (let sy = 14; sy < Math.min(26, rows.length); sy++) for (let sx = 0; sx < sourceWidth; sx++) {
    const ch = at(sx, sy), x = local(sx), y = local(sy);
    if ('SsZ'.includes(ch) && cloth.includes(at(sx, sy - 1))) {
      stroke(x, y - 1, 1, 0, 2, c.seam, cloth); // cuff, immediately above wrist
      put(x, y, c.skinLight, 'SsZ');
    }
    if (sy >= 22 && ch === 'P' && at(sx - 1, sy) !== 'P') stroke(x + 1, y, 0, 1, 2, c.trouserLight, 'Pp');
    if (sy >= 22 && ch === 'p') put(x + 1, y + 1, c.trouserShade, 'Pp');
    if (sy >= 22 && 'Kk'.includes(ch)) {
      // Leather toes get a small, thin highlight and a separate lower sole.
      if (!'Kk'.includes(at(sx, sy - 1))) stroke(x, y, 1, 0, 2, c.leatherLight, 'Kk');
      if (!'Kk'.includes(at(sx, sy + 1))) stroke(x, y + 1, 1, 0, 2, c.leatherShade, 'Kk');
    }
    if (sy >= 22 && ch === 'W') {
      put(x, y + 1, c.leatherLight, 'W'); put(x + 1, y + 1, palette.K, 'W');
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // Coalesce fine horizontal runs. The output remains native, opaque pixel
  // clusters with transparent surroundings; no blur or resampling is involved.
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) {
    const color = colors[y * W + x];
    if (!color) { x++; continue; }
    let end = x + 1;
    while (end < W && colors[y * W + end] === color) end++;
    ctx.fillStyle = color; ctx.fillRect(x, y, end - x, 1); x = end;
  }
  registerFineSpriteArt(original, canvas);
}
