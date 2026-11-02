import { mix } from './color';
import type { LocationId } from '../game/locations';
import { paintPixelWindowVillage } from './pixel-window-village';

type Ctx = CanvasRenderingContext2D;
export type BranchScenery = Exclude<LocationId, 'town'>;

// Authored in the same 46 × 38 world-pixel window space as the village view.
// The upper part stays mostly open so the caller's sky, sun, clouds and stars show.
const DESIGN_W = 46;
const DESIGN_H = 38;

type Rect = (dx: number, dy: number, rw: number, rh: number, color: string) => void;

function painter(ctx: Ctx, x: number, y: number, w: number, h: number): Rect {
  const half = (value: number) => Math.round(value * 2) / 2;
  return (dx, dy, rw, rh, color) => {
    const left = Math.max(0, Math.min(w, half(dx * w / DESIGN_W)));
    const top = Math.max(0, Math.min(h, half(dy * h / DESIGN_H)));
    const right = Math.max(0, Math.min(w, half((dx + rw) * w / DESIGN_W)));
    const bottom = Math.max(0, Math.min(h, half((dy + rh) * h / DESIGN_H)));
    if (right <= left || bottom <= top) return;
    ctx.fillStyle = color;
    ctx.fillRect(x + left, y + top, right - left, bottom - top);
  };
}

/** A stepped triangle (mountain or fir tier) from its peak down to `baseY`. */
function triangle(r: Rect, cx: number, peakY: number, halfW: number, baseY: number, lit: string, shade: string, cap?: { color: string; rows: number }) {
  for (let row = peakY; row < baseY; row += 0.5) {
    const width = Math.max(0.5, halfW * (row - peakY + 0.5) / (baseY - peakY));
    const capped = cap && row < peakY + cap.rows;
    r(cx - width, row, width, 0.5, capped ? cap.color : lit);
    r(cx, row, width, 0.5, capped ? mix(cap.color, shade, 0.25) : shade);
  }
}

/**
 * The view from a branch's windows. Pass the whole glass rectangle; `t` animates
 * boats, smoke, trams, lights and windmill sails. Hard-edged half-pixel rectangles
 * only, like the village view; no canvas state is left changed.
 */
export function paintLocationScenery(ctx: Ctx, x: number, y: number, w: number, h: number, darkness: number, t: number, id: BranchScenery): void {
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return;
  const dark = Number.isFinite(darkness) ? Math.max(0, Math.min(1, darkness)) : 0;
  const tone = (day: string, night: string) => mix(day, night, dark);
  const time = Number.isFinite(t) ? t : 0;
  const r = painter(ctx, x, y, w, h);
  if (id === 'seaside') seaside(r, tone, dark, time);
  else if (id === 'forest') forest(r, tone, dark, time);
  else if (id === 'city') city(r, tone, dark, time);
  else flowers(r, tone, time);
}

type Tone = (day: string, night: string) => string;

function seaside(r: Rect, tone: Tone, dark: number, t: number) {
  const p = {
    seaFar: tone('#86bfd0', '#1e3b55'), sea: tone('#5e9fbb', '#173250'), seaDeep: tone('#4b88a6', '#122a45'),
    foam: tone('#eef8f4', '#71909f'), island: tone('#9fbcaa', '#2a4548'), islandLight: tone('#b8cfb6', '#35524f'),
    sand: tone('#efdca9', '#4c4b50'), sandShade: tone('#d8c088', '#3d3d45'), rock: tone('#8f8c86', '#2d323a'),
    rockLight: tone('#aaa69d', '#3a404a'), tower: tone('#f5f0e4', '#8a93a3'), towerSide: tone('#d9d2c2', '#6c7586'),
    stripe: tone('#c75a4b', '#5c3d4a'), trunk: tone('#9c7b52', '#3c3530'), trunkLight: tone('#b8955f', '#4a4038'),
    leaf: tone('#5f9b4c', '#1f4136'), leafLight: tone('#88bd5d', '#2e5645'), leafDeep: tone('#457a3d', '#17332b'),
    hull: tone('#7c4b36', '#3a2a2a'), sail: tone('#fbf6ea', '#9aa3b2'), umbrella: tone('#d9604f', '#5e3a45'),
    towel: tone('#7fb6c9', '#2c4a5e'),
  };
  // Sea to the horizon, with a far island.
  r(0, 21, 46, 10, p.seaFar);
  r(0, 25, 46, 6, p.sea);
  r(0, 28.5, 46, 2, p.seaDeep);
  r(0, 21, 46, 0.5, p.foam);
  r(3, 19.5, 10, 1.5, p.island);
  r(5, 18.5, 5.5, 1, p.island);
  r(6, 18, 2.5, 0.5, p.islandLight);
  // A sailboat drifts across the bay.
  const bx = (t * 1.2) % 62 - 9;
  r(bx, 22.5, 5, 1, p.hull);
  r(bx + 0.5, 23.5, 4, 0.5, p.hull);
  r(bx + 2, 17.5, 0.5, 5, p.hull);
  r(bx + 2.5, 18, 0.5, 4, p.sail);
  r(bx + 3, 19, 0.5, 3, p.sail);
  r(bx + 3.5, 20, 0.5, 2, p.sail);
  r(bx + 1, 20.5, 1, 1.5, p.sail);
  // Glints on the water take turns.
  [[8, 23], [17, 26], [24, 22.5], [29, 27.5], [14, 29], [3, 26.5], [31, 24]].forEach(([gx, gy], i) => {
    if ((Math.floor(t * 2) + i) % 3 !== 0) r(gx, gy, 1.5, 0.5, p.foam);
  });
  // The lighthouse on its rocks.
  r(32, 24, 13, 4.5, p.rock);
  r(34, 22.5, 9, 1.5, p.rock);
  r(35, 22.5, 3, 0.5, p.rockLight);
  r(33, 24, 3, 0.5, p.rockLight);
  r(37, 13, 3, 9.5, p.tower);
  r(36.5, 17, 4, 5.5, p.tower);
  r(39.5, 13, 0.5, 9.5, p.towerSide);
  r(40, 17, 0.5, 5.5, p.towerSide);
  r(37, 15, 3, 1.5, p.stripe);
  r(36.5, 19.5, 4, 1.5, p.stripe);
  r(36, 12.5, 5, 0.5, p.rock);
  const lamp = dark > 0.3 ? '#ffe9a0' : tone('#9fc4cf', '#9fc4cf');
  r(37.5, 11, 2, 1.5, lamp);
  r(37, 10.5, 3, 0.5, p.stripe);
  r(38, 10, 1, 0.5, p.stripe);
  if (dark > 0.4) {
    // The beam sweeps out to sea and back.
    const left = Math.floor(t * 0.8) % 2 === 0;
    for (let i = 0; i < 8; i++) r(left ? 36.5 - (i + 1) * 3 : 40 + i * 3, 11.25 - i * 0.25, 3, 0.5 + i * 0.12, mix('#ffe9a0', '#1e3b55', 0.35 + i * 0.07));
  }
  // Beach, foam line and a striped umbrella.
  r(0, 30.5, 46, 0.5, p.foam);
  for (const fx of [4, 13, 22, 35]) r(fx, 31, 3, 0.5, p.foam);
  r(0, 31, 46, 7, p.sand);
  for (const [sx, sy, sw] of [[3, 34, 3], [12, 36, 2], [19, 33, 2.5], [33, 35, 3], [41, 33.5, 2]]) r(sx, sy, sw, 0.5, p.sandShade);
  r(26, 30, 0.5, 7, p.trunk);
  r(21.5, 29.5, 9.5, 1, p.umbrella);
  r(23, 28.5, 6.5, 1, p.sail);
  r(24.5, 28, 3.5, 0.5, p.umbrella);
  r(28, 35, 5.5, 1.5, p.towel);
  r(28, 35, 5.5, 0.5, p.foam);
  // A leaning palm frames the left of the view.
  for (let i = 0; i < 11; i++) r(5 + i * 0.35, 22 + i * 1.5, 1.5, 1.6, i % 3 === 0 ? p.trunkLight : p.trunk);
  r(-1, 21, 6, 1, p.leaf); r(-2, 22, 2.5, 1, p.leafDeep);
  r(6, 20.5, 6.5, 1, p.leaf); r(11.5, 21.5, 2.5, 1, p.leafDeep);
  r(3.5, 19, 4, 1, p.leafLight); r(4.5, 18, 2, 1, p.leaf);
  r(1, 23, 3.5, 1, p.leafDeep); r(8, 22.5, 3.5, 1, p.leafDeep);
  r(1, 21, 2, 0.5, p.leafLight); r(8, 20.5, 3, 0.5, p.leafLight);
  r(5, 22, 1, 1, p.hull); r(6.5, 22, 1, 1, p.hull);
}

function forest(r: Rect, tone: Tone, dark: number, t: number) {
  const p = {
    far: tone('#aebfd1', '#2c3a53'), farShade: tone('#93a6be', '#232f46'), snow: tone('#f5f7f5', '#8f99ab'),
    ridge: tone('#80a08c', '#22373b'), ridgeShade: tone('#6c8c7b', '#1c2f33'), hill: tone('#7ba35e', '#21402f'),
    hillLight: tone('#93b96a', '#2a4c37'), pine: tone('#3f6c4a', '#14302a'), pineLight: tone('#5d8b55', '#1f4234'),
    pineDeep: tone('#2e533b', '#0f241f'), trunk: tone('#6b4d36', '#2a2224'), cabin: tone('#9c6b46', '#3c2d2a'),
    cabinShade: tone('#7f5639', '#30252a'), roof: tone('#6d4b3b', '#2a2229'), roofSnow: tone('#f0f2ee', '#7d8698'),
    smoke: tone('#e9e9e6', '#6a7080'), ground: tone('#5f8a4a', '#1b3426'),
  };
  // Snow-capped peaks behind a blue ridge.
  triangle(r, 13, 9, 13, 27, p.far, p.farShade, { color: p.snow, rows: 3.5 });
  triangle(r, 32, 7, 15, 27, p.far, p.farShade, { color: p.snow, rows: 4.5 });
  triangle(r, 45, 13, 9, 27, p.far, p.farShade, { color: p.snow, rows: 2.5 });
  r(0, 24, 46, 6, p.ridge);
  for (const [rx, ry, rw] of [[0, 22.5, 8], [7, 23, 9], [19, 22, 10], [30, 23, 8], [39, 22.5, 7]]) r(rx, ry, rw, 1.5, p.ridge);
  r(0, 27, 46, 1, p.ridgeShade);
  r(0, 28, 46, 10, p.hill);
  for (const [hx, hy, hw] of [[4, 29, 6], [20, 28.5, 8], [33, 29.5, 6]]) r(hx, hy, hw, 0.5, p.hillLight);
  // A log cabin with a smoking chimney and a warm window at night.
  r(25, 28.5, 9, 5.5, p.cabin);
  for (let ly = 29.5; ly < 34; ly += 1.5) r(25, ly, 9, 0.5, p.cabinShade);
  triangle(r, 29.5, 24.5, 6, 28.5, p.roof, p.roof, { color: p.roofSnow, rows: 1.5 });
  r(31.5, 24, 1.5, 3, p.cabinShade);
  r(26.5, 30, 2, 2, dark > 0.35 ? '#ffd98a' : tone('#8aaab0', '#8aaab0'));
  r(30.5, 31, 1.5, 3, p.roof);
  for (let i = 0; i < 4; i++) {
    const rise = (t * 1.5 + i * 2) % 8;
    r(32 + Math.sin(rise) * 0.6 + rise * 0.3, 23 - rise, 1.5 - rise * 0.1, 1, p.smoke);
  }
  // Firs, near and far.
  const fir = (cx: number, top: number, height: number, near: boolean) => {
    const tier = height / 3;
    r(cx - 0.25, top + height, 0.75, 1.5, p.trunk);
    for (let k = 0; k < 3; k++) {
      const peak = top + k * tier * 0.8;
      triangle(r, cx, peak, (1.4 + k * 0.9) * height / 9, peak + tier * 1.3, near ? p.pineLight : p.pine, near ? p.pine : p.pineDeep);
    }
  };
  for (const [fx, ft, fh] of [[17, 22, 7], [21, 23.5, 6], [37, 22.5, 6.5], [41, 21.5, 7.5], [11, 23, 6]]) fir(fx, ft, fh, false);
  for (const [fx, ft, fh] of [[3, 18, 17], [8, 23, 12], [43, 17, 18], [37.5, 25, 10]]) fir(fx, ft, fh, true);
  r(0, 37, 46, 1, p.ground);
}

function city(r: Rect, tone: Tone, dark: number, t: number) {
  const p = {
    far: tone('#bac7d6', '#2e3b53'), farShade: tone('#a6b4c7', '#27334a'), mid: tone('#909fb4', '#253048'),
    midShade: tone('#7a8aa1', '#1e283c'), near: tone('#717f94', '#1b2335'), nearShade: tone('#5f6c80', '#151c2c'),
    brick: tone('#b5735a', '#47313a'), brickShade: tone('#9a5f4b', '#3a2831'), glass: tone('#cfe0ea', '#33405a'),
    lit: '#ffd98a', antenna: tone('#5a6274', '#3c4252'), street: tone('#7d8087', '#2a2d36'),
    sidewalk: tone('#bdb6a8', '#3f4049'), mark: tone('#f1e7c4', '#6d6a5e'), tram: tone('#d9a441', '#6b5a3a'),
    tramShade: tone('#b9852f', '#54472f'), post: tone('#4b4f5a', '#2a2d36'), tree: tone('#5f9150', '#1d3a2c'),
  };
  // A deterministic pattern decides which windows glow at night.
  const lit = (i: number, j: number) => ((i * 7 + j * 13 + i * j) % 5) < 2;
  const windows = (bx: number, top: number, bw: number, bottom: number, step: number, seed: number) => {
    let j = 0;
    for (let wy = top + 1; wy < bottom - 1; wy += step, j++) for (let i = 0, wx = bx + 0.5; wx < bx + bw - 0.5; wx += 1.5, i++) {
      r(wx, wy, 0.5, 1, dark > 0.35 && lit(i + seed, j) ? p.lit : p.glass);
    }
  };
  // The far skyline and a tall tower with a blinking light.
  for (const [bx, top, bw] of [[0, 17, 5], [4, 13, 4], [9, 19, 6], [15, 11, 5], [24, 15, 4], [28, 9, 5], [34, 16, 6], [40, 12, 6]]) {
    r(bx, top, bw, 30 - top, p.far);
    r(bx + bw - 1, top, 1, 30 - top, p.farShade);
  }
  r(30.25, 4, 0.5, 5, p.antenna);
  if (Math.floor(t * 1.5) % 2 === 0) r(30, 3.5, 1, 0.5, '#ff5a4a');
  // Middle blocks with window grids.
  for (const [bx, top, bw, seed] of [[1, 20, 7, 1], [11, 17, 6, 4], [21, 21, 6, 2], [31, 18, 7, 3]]) {
    r(bx, top, bw, 32 - top, p.mid);
    r(bx + bw - 1, top, 1, 32 - top, p.midShade);
    r(bx - 0.5, top - 0.5, bw + 1, 0.5, p.midShade);
    windows(bx, top, bw - 1, 32, 2, seed);
  }
  // Near brick buildings frame both sides.
  r(-1, 14, 7, 20, p.brick);
  r(5, 14, 1, 20, p.brickShade);
  windows(-1, 14, 6, 33, 2.5, 7);
  r(39, 16, 8, 18, p.brick);
  r(39, 16, 1, 18, p.brickShade);
  windows(40, 16, 6, 33, 2.5, 5);
  r(-1, 13.5, 7.5, 0.5, p.brickShade);
  r(38.5, 15.5, 8.5, 0.5, p.brickShade);
  // A tram runs along the avenue.
  const tx = (t * 4) % 90 - 25;
  r(tx, 29, 15, 4.5, p.tram);
  r(tx, 32.5, 15, 1, p.tramShade);
  for (let wx = tx + 1; wx < tx + 14; wx += 2.5) r(wx, 29.75, 1.5, 1.5, dark > 0.35 ? p.lit : p.glass);
  r(tx + 7, 27, 0.5, 2, p.post);
  r(tx + 5, 26.5, 4.5, 0.5, p.post);
  // Street, sidewalk and lamps.
  r(0, 33.5, 46, 4.5, p.street);
  for (let mx = 1; mx < 46; mx += 6) r(mx, 35.5, 3, 0.5, p.mark);
  r(0, 33, 46, 0.5, p.sidewalk);
  r(0, 37.5, 46, 0.5, p.sidewalk);
  for (const lx of [12, 30]) {
    r(lx, 24, 0.5, 9, p.post);
    r(lx - 0.5, 23.5, 2, 0.5, p.post);
    r(lx + 0.5, 24, 1, 0.5, dark > 0.3 ? '#ffe7a0' : p.glass);
  }
  for (const [tx2, ty] of [[20, 29], [36, 29.5]]) {
    r(tx2, ty + 1.5, 0.5, 2.5, p.post);
    r(tx2 - 1.5, ty - 0.5, 3.5, 2, p.tree);
  }
}

function flowers(r: Rect, tone: Tone, t: number) {
  const p = {
    far: tone('#b8d491', '#2c4a3c'), farShade: tone('#a3c47e', '#264236'), hill: tone('#9cc46f', '#24412f'),
    field: tone('#86b55a', '#1f3b2a'), fieldDeep: tone('#6f9c48', '#193224'),
    pink: tone('#f2a1b8', '#5a3a4c'), yellow: tone('#f6d76b', '#5b5236'), purple: tone('#b79be0', '#3d3656'),
    white: tone('#fbf4ea', '#6e7280'), mill: tone('#efe4cf', '#646a78'), millShade: tone('#d6c8ae', '#525868'),
    roof: tone('#b8674f', '#4b3a44'), sail: tone('#f6efe2', '#8a8f9c'), frame: tone('#8a6a4f', '#3a3236'),
    fence: tone('#c9a87b', '#403a36'), tree: tone('#6f9a54', '#1f3a2d'), treeLight: tone('#8fb563', '#28473a'),
  };
  // Rolling hills and a lone tree.
  r(0, 23, 46, 8, p.far);
  for (const [hx, hy, hw] of [[0, 21.5, 12], [10, 22, 14], [26, 21, 12], [37, 22.5, 9]]) r(hx, hy, hw, 1.5, p.far);
  r(0, 26, 46, 0.5, p.farShade);
  r(0, 26.5, 46, 3, p.hill);
  r(7, 19, 4, 3, p.tree); r(8, 18, 2, 1, p.treeLight); r(8.75, 22, 0.5, 1.5, p.frame);
  // The windmill turns: its sails swap between upright and slanted.
  r(32.5, 17.5, 6, 10, p.mill);
  r(37.5, 17.5, 1, 10, p.millShade);
  r(32, 21, 7, 6.5, p.mill);
  r(38, 21, 1, 6.5, p.millShade);
  triangle(r, 35.5, 14, 3.5, 17.5, p.roof, p.roof);
  r(34.75, 24.5, 1.5, 3, p.frame);
  r(33.5, 20, 1, 1, p.frame);
  const hx = 35.5, hy = 16;
  if (Math.floor(t * 1.5) % 2 === 0) {
    r(hx - 0.25, hy - 7, 0.5, 14, p.frame);
    r(hx - 7, hy - 0.25, 14, 0.5, p.frame);
    r(hx + 0.25, hy - 7, 1.25, 6, p.sail); r(hx - 1.5, hy + 1, 1.25, 6, p.sail);
    r(hx - 7, hy + 0.25, 6, 1.25, p.sail); r(hx + 1, hy - 1.5, 6, 1.25, p.sail);
  } else {
    for (let i = 1; i <= 5; i++) {
      r(hx + i - 0.5, hy - i - 0.5, 1, 1, p.sail); r(hx - i - 0.5, hy + i - 0.5, 1, 1, p.sail);
      r(hx - i - 0.5, hy - i - 0.5, 1, 1, p.sail); r(hx + i - 0.5, hy + i - 0.5, 1, 1, p.sail);
    }
  }
  r(hx - 0.5, hy - 0.5, 1, 1, p.frame);
  // Stripes of flowers widening toward the window, each with a ragged top of blooms
  // and a few leaves showing through.
  const colors = [p.pink, p.yellow, p.purple, p.white];
  let row = 0;
  for (let fy = 28.5, band = 1.2; fy < 38; fy += band + 0.5, band += 0.5, row++) {
    const color = colors[row % colors.length];
    r(0, fy - 0.5, 46, 0.5, p.fieldDeep);
    r(0, fy, 46, band, color);
    for (let fx = (row * 2) % 3; fx < 46; fx += 2) r(fx, fy - 0.5, 1, 0.5, color);
    for (let fx = (row * 3) % 5; fx < 46; fx += 3 + row) r(fx, fy + band - 0.5, 0.5, 0.5, p.field);
  }
  // A low fence along the near edge.
  r(0, 36.5, 46, 0.5, p.fence);
  for (let px = 1; px < 46; px += 6) r(px, 35.5, 0.5, 2.5, p.fence);
}

/**
 * A small framed picture of a location's view for the branch map: sky, sun or
 * moon, and the scenery the café windows will show there.
 */
export function paintLocationPreview(canvas: HTMLCanvasElement, id: LocationId, darkness = 0, t = 0): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.imageSmoothingEnabled = false;
  const sky = darkness > 0.5 ? ['#1b2440', '#26314f', '#34405e'] : ['#9fd2ee', '#bfe3f2', '#e2f2ee'];
  sky.forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(0, Math.floor(i * h / 3), w, Math.ceil(h / 3) + 1); });
  ctx.fillStyle = darkness > 0.5 ? '#f3efd2' : '#fff1b0';
  ctx.fillRect(Math.round(w * 0.72), Math.round(h * 0.1), Math.round(w * 0.08), Math.round(w * 0.08));
  if (id === 'town') paintPixelWindowVillage(ctx, 0, 0, w, h, darkness);
  else paintLocationScenery(ctx, 0, 0, w, h, darkness, t, id);
}
