import { LOCATIONS } from '../game/locations';

/** The branch map is painted at this size and scaled up crisply by CSS. */
export const MAP_W = 160;
export const MAP_H = 100;

/** Where the sea begins on each row of the map (the coast runs down to the bottom right). */
const coastX = (y: number) => y < 34 ? MAP_W + 1 : 168 - (y - 34) * 1.1 + Math.round(Math.sin(y * 0.7) * 1.5);

/**
 * A little pixel map of the region: the old town in the middle, snowy woods to the
 * northwest, the city to the northeast, the coast to the southeast and flower fields
 * to the southwest, joined by country roads. Location pins are HTML, laid over it.
 */
export function paintBranchMap(canvas: HTMLCanvasElement): void {
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const r = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // Meadow with a little texture.
  r(0, 0, MAP_W, MAP_H, '#b6d18b');
  for (let y = 2; y < MAP_H; y += 5) for (let x = (y * 3) % 7; x < MAP_W; x += 9) r(x, y, 2, 1, '#a6c57c');

  // The coast: sand, surf, shallows and the open sea.
  for (let y = 34; y < MAP_H; y++) {
    const c = coastX(y);
    r(c - 4, y, 4, 1, '#ecd9a6');
    r(c, y, MAP_W - c, 1, '#7fbfd6');
    r(c, y, 2, 1, '#eef8f4');
    r(c + 2, y, 4, 1, '#a5d6df');
  }
  for (const [wx, wy] of [[140, 60], [150, 75], [132, 88], [152, 92], [145, 47]]) r(wx, wy, 4, 1, '#cfeaf0');
  // Lighthouse on the shore.
  r(118, 64, 3, 7, '#f5f0e4'); r(118, 66, 3, 1, '#c75a4b'); r(118, 69, 3, 1, '#c75a4b'); r(118, 63, 3, 1, '#c75a4b'); r(119, 62, 1, 1, '#ffe9a0');

  // Snowy peaks and fir woods.
  const peak = (cx: number, top: number, half: number, base: number) => {
    for (let y = top; y < base; y++) {
      const w = Math.max(1, Math.round(half * (y - top + 1) / (base - top)));
      r(cx - w, y, w, 1, y < top + 3 ? '#f5f7f5' : '#9fb0c4');
      r(cx, y, w, 1, y < top + 3 ? '#dfe5ea' : '#8597ae');
    }
  };
  peak(16, 3, 12, 22); peak(36, 6, 10, 22); peak(8, 10, 8, 24);
  for (const [fx, fy] of [[6, 26], [12, 30], [20, 27], [26, 32], [34, 26], [40, 30], [16, 35], [46, 25]]) {
    r(fx, fy, 1, 4, '#3f6c4a'); r(fx - 1, fy + 1, 3, 2, '#3f6c4a'); r(fx - 2, fy + 3, 5, 1, '#2e533b'); r(fx, fy + 4, 1, 1, '#6b4d36');
  }

  // The city: blocks and avenues.
  r(108, 6, 46, 30, '#c9c6bd');
  for (let bx = 110; bx < 152; bx += 7) for (let by = 8; by < 34; by += 7) {
    const tall = (bx + by) % 3 === 0;
    r(bx, by, 5, 5, tall ? '#7f8ea4' : '#9aa8bb');
    r(bx, by, 5, 1, tall ? '#a9b6c8' : '#bcc7d4');
    r(bx + 1, by + 2, 1, 1, '#e8eef2'); r(bx + 3, by + 2, 1, 1, '#e8eef2');
  }
  r(128, 2, 3, 6, '#6f7d92'); r(129, 0, 1, 2, '#5a6274');

  // Flower fields in stripes, with a windmill.
  const colors = ['#f2a1b8', '#f6d76b', '#b79be0', '#fbf4ea'];
  for (let i = 0; i < 9; i++) r(8, 62 + i * 3.4, 46, 2, colors[i % colors.length]);
  r(46, 56, 4, 8, '#efe4cf'); r(45, 55, 6, 1, '#b8674f'); r(47, 54, 2, 1, '#b8674f');
  r(47.5, 49, 1, 12, '#8a6a4f'); r(42, 54.5, 12, 1, '#8a6a4f');

  // Country roads from the old town to each place.
  const town = LOCATIONS.find((l) => l.id === 'town')!.pin;
  const tx = town[0] * MAP_W, ty = town[1] * MAP_H;
  for (const location of LOCATIONS) {
    if (location.id === 'town') continue;
    const [px, py] = [location.pin[0] * MAP_W, location.pin[1] * MAP_H];
    const steps = Math.ceil(Math.hypot(px - tx, py - ty));
    for (let s = 0; s <= steps; s++) {
      const f = s / steps, bend = Math.sin(f * Math.PI) * 6;
      const x = tx + (px - tx) * f + bend * (py > ty ? 1 : -1), y = ty + (py - ty) * f;
      if (s % 3 !== 2) r(x, y, 2, 2, '#dcc38f');
    }
  }

  // The old town: a cluster of roofs around a little square.
  r(tx - 10, ty - 7, 20, 14, '#e6d7b4');
  for (const [hx, hy, roof] of [[-9, -6, '#b8674f'], [-3, -7, '#c47a52'], [3, -6, '#a65a49'], [-8, 1, '#c47a52'], [4, 1, '#b8674f']] as const) {
    r(tx + hx, ty + hy, 5, 4, '#f1e6cc'); r(tx + hx - 0.5, ty + hy - 1, 6, 2, roof); r(tx + hx + 2, ty + hy + 2, 1, 2, '#8a6a4f');
  }
  r(tx - 1, ty - 1, 3, 3, '#8fb3c2');
}
