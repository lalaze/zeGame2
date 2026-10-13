/** Transparent, source-authored botanicals on a native half-world-pixel grid. */
type Point = readonly [number, number];
type Ctx = CanvasRenderingContext2D;

const LEAF = {
  ink: '#344832', shade: '#465e35', deep: '#5e773d', base: '#7c934b',
  light: '#a2b15e', sun: '#c0c879', vein: '#aeb76a', stem: '#697345',
};
const CLAY = {
  ink: '#5c3d2b', shade: '#914f32', base: '#ba6d41', light: '#d89155',
  rim: '#e5aa6d', soil: '#4e402c', soilLight: '#87714b',
};

function hash(a: number, seed: number): number {
  let value = Math.imul(a + 31, 374761393) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Small bounded raster, so leaf silhouettes never acquire antialiased edges. */
function art(ctx: Ctx, x: number, y: number, width: number, height: number, designW: number, designH: number) {
  const pixel = Math.max(0.5, width / 512, height / 512);
  const cols = Math.ceil(width / pixel), rows = Math.ceil(height / pixel);
  const pixels = Array<string>(cols * rows).fill('');
  const sx = width / pixel / designW, sy = height / pixel / designH;
  const put = (px: number, py: number, color: string) => {
    if (px >= 0 && py >= 0 && px < cols && py < rows) pixels[py * cols + px] = color;
  };
  const polygon = (points: readonly Point[], color: string) => {
    const vertices = points.map(([px, py]) => [px * sx, py * sy] as const);
    const first = Math.max(0, Math.floor(Math.min(...vertices.map(point => point[1]))));
    const end = Math.min(rows, Math.ceil(Math.max(...vertices.map(point => point[1]))));
    for (let py = first; py < end; py++) {
      const yy = py + 0.5, crossings: number[] = [];
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) {
          crossings.push(a[0] + (yy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const right = Math.min(cols, Math.ceil(crossings[i + 1] - 0.5));
        for (let px = Math.max(0, Math.ceil(crossings[i] - 0.5)); px < right; px++) put(px, py, color);
      }
    }
  };
  const line = (a: Point, b: Point, color: string) => {
    const ax = Math.round(a[0] * sx), ay = Math.round(a[1] * sy);
    const bx = Math.round(b[0] * sx), by = Math.round(b[1] * sy);
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let i = 0; i <= steps; i++) put(Math.round(ax + (bx - ax) * i / steps), Math.round(ay + (by - ay) * i / steps), color);
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: string) => {
    polygon(Array.from({ length: 16 }, (_, i) => [cx + Math.cos(i * Math.PI / 8) * rx, cy + Math.sin(i * Math.PI / 8) * ry]), color);
  };
  const finish = () => {
    ctx.save();
    for (let py = 0; py < rows; py++) for (let px = 0; px < cols;) {
      const color = pixels[py * cols + px];
      let end = px + 1;
      while (end < cols && pixels[py * cols + end] === color) end++;
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x + px * pixel, y + py * pixel, Math.min(width, end * pixel) - px * pixel, Math.min(pixel, height - py * pixel));
      }
      px = end;
    }
    ctx.restore();
  };
  return { polygon, line, ellipse, finish };
}
type Art = ReturnType<typeof art>;

/** Pointed ovate leaves have a cupped edge, directional facet and midrib. */
function leaf(a: Art, base: Point, tip: Point, breadth: number, shade: number): void {
  const dx = tip[0] - base[0], dy = tip[1] - base[1], length = Math.hypot(dx, dy);
  if (length < 0.01) return;
  let nx = -dy / length, ny = dx / length;
  // The light-catching leaf half always faces up/left, independent of angle.
  if (nx + ny > 0) { nx = -nx; ny = -ny; }
  const p = (along: number, across = 0): Point => [base[0] + dx * along + nx * breadth * across, base[1] + dy * along + ny * breadth * across];
  a.polygon([p(0), p(.2, .65), p(.48, 1), p(.78, .65), p(1), p(.75, -.55), p(.42, -.82), p(.15, -.48)], LEAF.ink);
  a.polygon([p(.08), p(.26, .53), p(.5, .77), p(.78, .45), p(.94), p(.7, -.42), p(.4, -.58)], shade ? LEAF.deep : LEAF.base);
  a.polygon([p(.12), p(.31, .4), p(.52, .68), p(.78, .35), p(.94), p(.55, .08)], shade > 1 ? LEAF.base : LEAF.light);
  a.line(p(.08), p(.91), shade > 1 ? LEAF.base : LEAF.vein);
  if (length > 8) {
    a.line(p(.35), p(.56, .5), shade ? LEAF.base : LEAF.sun);
    a.line(p(.56), p(.73, -.36), shade ? LEAF.shade : LEAF.deep);
  }
}

/** Warm tapered earthenware, with visible soil and a separate rolled front lip. */
function pot(a: Art, cx: number, top: number, width: number, height: number): void {
  const r = width / 2, bottom = top + height;
  a.polygon([[cx-r,top],[cx+r,top],[cx+r*.68,bottom-1],[cx+r*.45,bottom],[cx-r*.5,bottom],[cx-r*.75,bottom-2]], CLAY.ink);
  a.polygon([[cx-r+.8,top+1],[cx+r-.8,top+1],[cx+r*.58,bottom-1.5],[cx-r*.55,bottom-1.5]], CLAY.base);
  a.polygon([[cx-r+.8,top+2],[cx-r*.46,top+2],[cx-r*.35,bottom-2],[cx-r*.55,bottom-2]], CLAY.light);
  a.polygon([[cx+r*.42,top+2],[cx+r-.8,top+1],[cx+r*.58,bottom-1.5],[cx+r*.2,bottom-1.5]], CLAY.shade);
  a.line([cx-r*.25,top+5],[cx-r*.2,bottom-3], '#c67a49');
  a.ellipse(cx, top+.7, r+.7, 2.5, CLAY.ink);
  a.ellipse(cx, top+.2, r, 2, CLAY.rim);
  a.ellipse(cx, top+.1, r-1.2, 1.3, CLAY.soil);
  for (const dx of [-.55, -.2, .35, .56]) a.line([cx+dx*r,top],[cx+dx*r+.2,top], CLAY.soilLight);
  a.polygon([[cx-r,top+1],[cx-r*.6,top+2.4],[cx+r*.6,top+2.4],[cx+r,top+1],[cx+r-.5,top+3],[cx-r+.5,top+3]], CLAY.light);
  a.line([cx-r*.64,top+2.1],[cx+r*.3,top+2.1], CLAY.rim);
}

function valid(x: number, y: number, width: number, height: number): boolean {
  return [x, y, width, height, x + width, y + height].every(Number.isFinite) && width > 0 && height > 0;
}

/**
 * Broad-leaf door plant. (x,y) is the TOP LEFT of a strictly bounded, transparent
 * rectangle; its bottom edge is (x + width/2, y + height). Use 16×23 world to
 * retain the existing entrance fig's envelope (32×46 native backing pixels).
 * No shadows, background, projection or simulation state is baked into this art.
 */
export function paintFinePottedPlant(ctx: Ctx, x: number, y: number, width: number, height: number, seed = 17): void {
  if (!valid(x, y, width, height)) return;
  const a = art(ctx, x, y, width, height, 48, 64), s = Number.isFinite(seed) ? seed | 0 : 17;
  pot(a, 24, 44, 21, 20);
  a.line([24, 45], [23, 13], '#5d653d');
  a.line([25, 44], [24, 22], '#8a9151');
  const leaves: readonly (readonly [number, number, number, number, number, number])[] = [
    [23,23,14,4,4.3,2], [24,22,29,2,4,1], [24,24,38,8,4.8,2],
    [22,29,7,13,5,2], [26,29,44,20,5,2], [22,33,4,26,4.5,2],
    [25,34,42,32,5,2], [23,40,12,40,4.5,2],
    [23,20,18,7,4,0], [24,22,34,12,4.5,0], [22,28,10,19,5,0],
    [23,31,17,16,4.6,1], [26,30,38,24,4.5,0], [24,34,28,19,4.5,0],
    [21,35,7,31,4.6,0], [25,39,37,36,4.5,0], [23,41,15,30,4.5,0],
    [25,43,31,31,4,1], [23,42,19,44,3.2,1],
  ];
  for (const [bx, by, tx, ty] of leaves) a.line([24, 44], [bx+(tx-bx)*.25, by+(ty-by)*.25], LEAF.stem);
  leaves.forEach(([bx,by,tx,ty,breadth,shade], i) => {
    const jitter = (hash(i, s)-.5)*1.6;
    leaf(a, [bx,by], [tx+jitter,ty+(hash(i+71,s)-.5)], breadth*(.93+hash(i+53,s)*.14), shade);
  });
  a.finish();
}

/**
 * Counter pot with three unequal trailing vines. Strict top-left bounds and a
 * transparent background; use 15×34 world for the existing counter envelope.
 * Pot sits in the upper third; top=y84 places its foot around the y96 counter.
 */
export function paintFineTrailingPlant(ctx: Ctx, x: number, y: number, width: number, height: number, seed = 29): void {
  if (!valid(x, y, width, height)) return;
  const a = art(ctx, x, y, width, height, 36, 80), s = Number.isFinite(seed) ? seed | 0 : 29;
  const canopy: readonly (readonly [number, number, number, number, number])[] = [
    [22,18,13,3,3.6], [24,18,29,2,4], [21,19,5,13,4.2],
    [24,19,34,11,4], [21,18,15,9,4], [24,20,27,8,4],
    [21,19,10,23,3.8], [24,20,32,24,3.4], [22,21,19,11,4],
  ];
  for (const [,,tx,ty] of canopy) a.line([23,18],[tx,ty],LEAF.stem);
  canopy.forEach(([bx,by,tx,ty,b],i) => leaf(a,[bx,by],[tx+(hash(i,s)-.5),ty],b,i<4?1:0));
  // The front vessel occludes the root cluster; soil stays readable between
  // the rim and the leaves, before vines spill over its near edge.
  pot(a, 23, 17, 16, 14);
  // Sparse, kinked stems remain visible between directional leaves. Different
  // lengths, spacing and angles avoid a repeated chain of round green beads.
  for (let vine = 0; vine < 3; vine++) {
    const startX = [11,18,6][vine], startY = [21,25,26][vine];
    const endY = [77,65,55][vine], nodes: Point[] = [];
    for (let i = 0; i < 8; i++) {
      const t = i/7;
      nodes.push([startX+Math.sin(t*5+vine)*1.8+(hash(i+vine*23,s)-.5),startY+(endY-startY)*t]);
      if (i) a.line(nodes[i-1], nodes[i], vine===1?LEAF.stem:LEAF.deep);
    }
    a.line([vine===2?14:20,18],nodes[0],LEAF.stem);
    for (let i = 1; i < nodes.length; i++) {
      const [nx,ny] = nodes[i], side = (i+vine)%2 ? -1 : 1;
      const length = 6.3+hash(i+vine*51,s)*2.7;
      const tip: Point = [nx+side*(length*.74), ny+(i%3===0?-2.5:3.6)];
      const base: Point = [nx,ny-.8];
      leaf(a,base,tip,2.9+hash(i+91,s)*.7,(i+vine)%3===0?1:0);
      if (i<4 && vine===0) leaf(a,[nx,ny+1],[nx-side*4.6,ny+4.8],2,1);
    }
  }
  a.finish();
}
