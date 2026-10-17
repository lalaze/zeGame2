/**
 * Pixel-art conversion for the café team's generated poses (owner, barista, server, cook).
 *
 * The sources are soft paintings roughly five times the world size. Shrinking them
 * directly (or recolouring them pixel by pixel) leaves speckled hair, stray skin and
 * hair tints on clothes and faces, and a ragged contour. Instead each painted pixel is
 * labelled with a material, the labels are voted straight onto the 2× world grid, and
 * every material is drawn with the three shades of its master-palette ramp
 * (docs/art-grid/palette.json) inside one clean warm contour.
 *
 * No DOM: the runtime, unit tests and Node scripts share these functions.
 */

export type Point = { x: number; y: number };
export type PoseAnchors = { hip?: Point; hand?: Point; neck?: Point; floor?: Point };
export type TeamRole = 'owner' | 'barista' | 'server' | 'cook';
/** Straight (non-premultiplied) RGBA, alpha already cut to 0 below 100. */
export type PoseImage = { data: Uint8ClampedArray; width: number; height: number; anchors: PoseAnchors };
export type Rgb = readonly [number, number, number];
export type Ramp = readonly [Rgb, Rgb, Rgb];

export const MATERIAL = { clear: 0, skin: 1, hair: 2, cloth: 3, pants: 4, ink: 5, feature: 6, other: 7 } as const;
/** Face details keep their own small colours instead of a three-shade ramp. */
export const FEATURE = { eye: 0, glint: 1, blush: 2, mouth: 3 } as const;

/** One pose's labels; independent of the look, so every outfit reuses it. */
export type PoseSegmentation = {
  width: number; height: number;
  /** MATERIAL per source pixel. */
  material: Uint8Array;
  /** Shade 0–2 for ramp materials, FEATURE kind for features, palette index for others. */
  tone: Uint8Array;
};

export type TeamColours = { skin: Ramp; hair: Ramp; cloth: Ramp; pants: Ramp };
/** Where the pose lands: target pixel = offset + source pixel × scale. */
export type Placement = { x: number; y: number; scale: number };

// ---------------------------------------------------------------- colour

/** The ramp builder of scripts/pixel-conform.mjs: shadows cooler and deeper, highlights warmer. */
export function shadeRamp(base: Rgb): Ramp {
  const toward = (target: Rgb, amount: number) => base.map((v, k) => Math.round(v + (target[k] - v) * amount)) as unknown as Rgb;
  return [toward([70, 40, 60], 0.42), base, toward([255, 236, 196], 0.38)];
}
export const hexRgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;

const INK_LINE: Rgb = [41, 23, 17]; // ink #291711: contour and seams
const INK_EYE: Rgb = [32, 17, 12]; // ink #20110c
const GLINT: Rgb = [251, 242, 217]; // porcelain #fbf2d9

/**
 * Colours for everything that is not recoloured (shirts, shoes, buttons, chairs, caps):
 * the character-relevant master-palette ramps. Snapping the painting to these before the
 * vote turns soft gradients into a few flat shades.
 */
export const OTHER_PALETTE: readonly Rgb[] = [
  '#160704', '#20110c', '#291711', // ink
  '#42251a', '#55301f', '#703d23', '#8a4a25', '#ae602b', '#d57c33', // walnut
  '#61311d', '#81401f', '#ae602e', '#c0824f', '#dfa261', '#f6c87b', // oak
  '#374e3d', '#455f45', '#59764e', '#738e53', '#9aae5c', // sage
  '#a48e75', '#c8ad90', '#e8d1b3', '#fbf2d9', // porcelain
  '#6f3a17', '#a15b1f', '#e99835', '#f3bd6a', '#fde083', // brass
  '#72361a', '#9b481b', '#d07955', '#f09756', // terracotta
  '#8c2b20', '#b54634', '#e26443', '#fb8e61', // gingham reds
  '#776b71', '#888485', '#9a9c98', '#adaba0', '#c0baa9', // steel
].map(hexRgb);

const linear = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function oklab(r: number, g: number, b: number): Rgb {
  const R = linear(r), G = linear(g), B = linear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const OTHER_LAB = OTHER_PALETTE.map(c => oklab(...c));
const nearestCache = new Map<number, number>();
function nearestOther(r: number, g: number, b: number): number {
  const key = (r >> 2) << 12 | (g >> 2) << 6 | b >> 2;
  let best = nearestCache.get(key);
  if (best === undefined) {
    const lab = oklab(r, g, b);
    let distance = Infinity; best = 0;
    for (let k = 0; k < OTHER_LAB.length; k++) {
      const p = OTHER_LAB[k], d = (lab[0] - p[0]) ** 2 + (lab[1] - p[1]) ** 2 + (lab[2] - p[2]) ** 2;
      if (d < distance) { distance = d; best = k; }
    }
    nearestCache.set(key, best);
  }
  return best;
}
const luma = (r: number, g: number, b: number) => r * .299 + g * .587 + b * .114;

// ---------------------------------------------------------------- source labels

type Island = number[];
function islands(width: number, height: number, include: (n: number) => boolean, visit: (island: Island) => void): void {
  const seen = new Uint8Array(width * height);
  for (let n = 0; n < seen.length; n++) {
    if (seen[n] || !include(n)) continue;
    const island = [n]; seen[n] = 1;
    for (let k = 0; k < island.length; k++) {
      const at = island[k], x = at % width, y = (at - x) / width;
      for (const v of [x ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y ? at - width : -1, y < height - 1 ? at + width : -1])
        if (v >= 0 && !seen[v] && include(v)) { seen[v] = 1; island.push(v); }
    }
    visit(island);
  }
}

/** Source peach is separated into connected face/hand islands so hair glints never become skin. */
function skinMask(p: PoseImage, neckY: number, sit: boolean, back: boolean, capped: boolean): { mask: Uint8Array; face: Island } {
  const { data, width, height } = p, mask = new Uint8Array(width * height);
  const candidate = (n: number) => { const i = n * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    return data[i + 3] > 100 && r > (capped ? 175 : 205) && g > 120 && b > 65 && r - g > 28 && g - b > 24 && g / r > .53; };
  let face: Island = [];
  const hand = p.anchors.hand ?? { x: width * .80, y: height * .70 };
  islands(width, height, candidate, island => {
    const center = island.reduce((v, at) => ({ x: v.x + at % width, y: v.y + Math.floor(at / width) }), { x: 0, y: 0 });
    center.x /= island.length; center.y /= island.length;
    if (!back && center.y < neckY && center.y > height * .17 && center.x > width * .25 && center.x < width * .85 && island.length > face.length) face = island;
    const isHand = center.y > neckY && center.y < height * (sit ? .85 : .80) &&
      (sit ? ((center.x - hand.x) / (width * .25)) ** 2 + ((center.y - hand.y) / (height * .17)) ** 2 < 1 || (center.x > width * .42 && center.y < height * .70) : true);
    const mean = island.reduce((v, at) => { const i = at * 4; return [v[0] + data[i], v[1] + data[i + 1], v[2] + data[i + 2]]; }, [0, 0, 0]);
    const hasPeachCore = mean[1] / mean[0] > .65 && mean[1] / mean[0] < .84 && mean[2] / mean[0] > .35 && mean[2] / mean[0] < .65 && island.some(at => { const i = at * 4; return data[i] > (capped ? 205 : 235) && data[i + 1] > 150 && data[i + 2] > 95 && data[i] - data[i + 1] > 38; });
    const isEar = center.y > height * .20 && center.y < neckY - height * .055;
    const hasNeckCore = mean[1] / mean[0] > .53 && mean[1] / mean[0] < .70 && mean[2] / mean[0] > .30 && mean[2] / mean[0] < .50 && island.some(at => data[at * 4] > 235);
    const isNeck = center.y >= neckY - height * .08 && center.y < neckY + height * .055 && center.x > width * .35 && center.x < width * .70;
    if (((isHand || isEar) && hasPeachCore) || (isNeck && (hasPeachCore || hasNeckCore))) island.forEach(at => { mask[at] = 1; });
  });
  face.forEach(at => { mask[at] = 1; });
  return { mask, face };
}

/** Follow connected warm hair below the neck, including long locks and braids. */
function hairMask(p: PoseImage, skin: Uint8Array, neckY: number, sit: boolean, cook: boolean, capped: boolean): Uint8Array {
  const { data, width, height } = p, count = width * height, mask = new Uint8Array(count);
  const candidate = (n: number) => {
    if (skin[n]) return false;
    const i = n * 4, r = data[i], g = data[i + 1], b = data[i + 2], y = Math.floor(n / width), lum = luma(r, g, b);
    // The attendant's cream cap has warm shadows, but those are not hair.
    if (capped && (y < height * .15 || lum > 150 || r < g * 1.4)) return false;
    if (cook && (y < height * .22 || y > neckY + height * .03 || (y < height * .34 && r > 150 && r - g < 70 && g - b < 80))) return false;
    // Golden chair wood is much yellower than the source chestnut hair.
    if (sit && y > height * .30 && b / r < .25 && g / r > .48) return false;
    // Painted chestnut hair, glints included, stays below this; lighter warm paint is shirt shading.
    return data[i + 3] > 100 && r > g * 1.15 && g > b * 1.12 && r - g > 25 && lum > 40 && lum < 168 && b / r < .66;
  };
  const separated: Island[] = [];
  islands(width, height, candidate, island => {
    if (island.some(at => Math.floor(at / width) < neckY - height * .035)) island.forEach(at => { mask[at] = 1; });
    else if (!cook && island.every(at => Math.floor(at / width) < height * .78)) {
      const mean = island.reduce((v, at) => { const i = at * 4; return [v[0] + data[i], v[1] + data[i + 1], v[2] + data[i + 2]]; }, [0, 0, 0]);
      if (mean[0] > mean[1] * 1.38 && mean[2] < mean[0] * .53) separated.push(island);
    }
  });
  // Ribbons and dark outlines can separate braid tips from the main hair island.
  // Bridge only short gaps to chestnut islands, leaving the ribbon/wood unchanged.
  const radius = Math.max(3, Math.ceil(width * .045)), distance = new Uint8Array(count), queue: number[] = [];
  for (let n = 0; n < count; n++) if (mask[n]) { distance[n] = 1; queue.push(n); }
  for (let k = 0; k < queue.length; k++) {
    const at = queue[k]; if (distance[at] > radius) continue;
    const x = at % width, y = Math.floor(at / width);
    for (const v of [x ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y ? at - width : -1, y < height - 1 ? at + width : -1])
      if (v >= 0 && !distance[v]) { distance[v] = distance[at] + 1; queue.push(v); }
  }
  for (const island of separated) if (island.some(at => distance[at] > 0)) island.forEach(at => { mask[at] = 1; });
  return mask;
}

/** Darker than this is drawn line work: contours, seams, eyes and brows. */
const INK_LUMA = 52;
/** Painted contour ink within this many source pixels of the silhouette is redrawn as one clean world pixel. */
const CONTOUR_REACH = 6;
/** Share of hair, cloth and trousers drawn in their shadow and highlight shades. */
const SHADES: Record<number, [shadow: number, light: number]> = { 2: [.30, .08], 3: [.25, .10], 4: [.25, .08] };
/** Faces are painted almost flat: only clearly darker skin is shadow, clearly brighter is highlight. */
const SKIN_SHADOW = 24, SKIN_LIGHT = 22;
/** Passages this close to face skin do not count as leading out of the face (fringe tips touch eyes). */
const FACE_GAP = 3;

export type SegmentOptions = { role: TeamRole; sit: boolean; back: boolean };
type Box = { left: number; right: number; top: number; bottom: number };

/** Label every painted pixel. Pure and look-independent, so it is computed once per pose. */
export function segmentTeamPose(p: PoseImage, o: SegmentOptions): PoseSegmentation {
  const { data, width, height } = p, count = width * height;
  const capped = o.role === 'server' || o.role === 'barista', cook = o.role === 'cook';
  const neckY = p.anchors.neck?.y ?? height * (o.sit ? .44 : cook ? .48 : .46);
  const hipY = p.anchors.hip?.y ?? height * (o.sit ? .74 : .78);
  const neckX = p.anchors.neck?.x ?? width * (o.sit ? .55 : .50);
  const hand = p.anchors.hand ?? { x: width * .80, y: height * .70 };
  const { mask: skin, face } = skinMask(p, neckY, o.sit, o.back, capped);
  const hair = hairMask(p, skin, neckY, o.sit, cook, capped);
  const material = new Uint8Array(count), tone = new Uint8Array(count);
  for (let n = 0; n < count; n++) {
    const i = n * 4; if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2], x = n % width, y = (n - x) / width, lum = luma(r, g, b);
    // Furniture is authored into seated poses; it keeps its own (snapped) colours.
    const nearHand = ((x - hand.x) / (width * .18)) ** 2 + ((y - hand.y) / (height * .12)) ** 2 < 1;
    const furniture = o.sit && !nearHand && ((y > height * .31 && x < neckX - width * .17) || (y > hipY && x < width * .50));
    let m: number = MATERIAL.other;
    if (skin[n]) m = MATERIAL.skin;
    else if (hair[n]) m = MATERIAL.hair;
    else if (lum < INK_LUMA) m = MATERIAL.ink;
    else if (furniture) m = MATERIAL.other;
    else if (!cook && y > neckY - height * .04 && y < hipY + height * .07 && g > r * .85 && g > b * 1.18 && r < 185) m = MATERIAL.cloth;
    else if (cook && y > neckY - height * .025 && y < hipY + height * .07 && r > g * 1.15 && g > b * 1.12 && r > 95 && r - g > 32) m = MATERIAL.cloth;
    else if (y > hipY - height * .035 && y < height * (o.sit ? .90 : .91) && (!o.sit || x > width * .43) && r > g && g > b && g / r > .55 && b / r > .27) m = MATERIAL.pants;
    material[n] = m;
    if (m === MATERIAL.other) tone[n] = nearestOther(r, g, b);
  }
  const box = face.length >= 40 ? islandBox(face, width) : null;
  if (box) reclaimNeck(p, box, neckY, material);
  growSkin(p, material);
  if (box) faceDetails(p, face, box, material, tone);
  shadeTones(p, face, material, tone);
  absorbContour(width, height, material, tone);
  return { width, height, material, tone };
}

function islandBox(island: Island, width: number): Box {
  const box = { left: Infinity, right: -1, top: Infinity, bottom: -1 };
  for (const at of island) {
    const x = at % width, y = (at - x) / width;
    box.left = Math.min(box.left, x); box.right = Math.max(box.right, x); box.top = Math.min(box.top, y); box.bottom = Math.max(box.bottom, y);
  }
  return box;
}

/** Warm shadow under the chin passes for chestnut hair; below the face it is neck. */
function reclaimNeck(p: PoseImage, face: Box, neckY: number, material: Uint8Array): void {
  const { data, width, height } = p, middle = (face.left + face.right) / 2, half = (face.right - face.left) * .32;
  const top = Math.round(face.bottom - (face.bottom - face.top) * .12), bottom = Math.min(height - 1, Math.round(neckY + height * .07));
  for (let y = Math.max(0, top); y <= bottom; y++) for (let x = Math.max(0, Math.round(middle - half)); x <= Math.min(width - 1, Math.round(middle + half)); x++) {
    const n = y * width + x, i = n * 4;
    if (material[n] === MATERIAL.hair && luma(data[i], data[i + 1], data[i + 2]) > 80) material[n] = MATERIAL.skin;
  }
}

/** Saturated orange shading around hands, ears and neck is skin, not loose clothing colour. */
function growSkin(p: PoseImage, material: Uint8Array): void {
  const { data, width, height } = p, depth = new Uint8Array(material.length), queue: number[] = [];
  const warm = (n: number) => { const i = n * 4, r = data[i], g = data[i + 1], b = data[i + 2], lum = luma(r, g, b);
    return r > 140 && r - g > 45 && r - b > 95 && g >= b - 4 && lum > 70 && lum < 215; };
  for (let n = 0; n < material.length; n++) if (material[n] === MATERIAL.skin) { depth[n] = 1; queue.push(n); }
  for (let k = 0; k < queue.length; k++) {
    const at = queue[k], x = at % width, y = (at - x) / width;
    if (depth[at] > 5) continue;
    for (const v of [x ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y ? at - width : -1, y < height - 1 ? at + width : -1])
      if (v >= 0 && !depth[v] && material[v] === MATERIAL.other && warm(v)) { depth[v] = depth[at] + 1; material[v] = MATERIAL.skin; queue.push(v); }
  }
}

/** Eyes and mouth are what the face island encloses; cheeks are its reddest patches below the eyes. */
function faceDetails(p: PoseImage, face: Island, box: Box, material: Uint8Array, tone: Uint8Array): void {
  const { data, width } = p, { left, right, top, bottom } = box;
  const inFace = new Uint8Array(material.length);
  for (const at of face) inFace[at] = 1;
  // Flood in from around the face, but never through passages hugging the skin: a fringe
  // tip can touch an eye. Then let the flood regrow that far, so the hairline rejoins it.
  const pad = FACE_GAP + 2, w = right - left + 1 + 2 * pad, h = bottom - top + 1 + 2 * pad, ox = left - pad, oy = top - pad;
  const local = (x: number, y: number) => (y - oy) * w + (x - ox);
  const skinAt = (x: number, y: number) => { const sx = x + ox, sy = y + oy; return sx >= 0 && sy >= 0 && sx < width && sy * width + sx < material.length && inFace[sy * width + sx] === 1; };
  const near = new Uint8Array(w * h), queue: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (skinAt(x, y)) { near[y * w + x] = 1; queue.push(y * w + x); }
  const step = (at: number) => { const x = at % w, y = (at - x) / w; return [x ? at - 1 : -1, x < w - 1 ? at + 1 : -1, y ? at - w : -1, y < h - 1 ? at + w : -1]; };
  for (let k = 0; k < queue.length; k++) { const at = queue[k]; if (near[at] > FACE_GAP) continue; for (const v of step(at)) if (v >= 0 && !near[v]) { near[v] = near[at] + 1; queue.push(v); } }
  const outside = new Uint8Array(w * h); queue.length = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((!x || !y || x === w - 1 || y === h - 1) && !near[y * w + x]) { outside[y * w + x] = 1; queue.push(y * w + x); }
  for (let k = 0; k < queue.length; k++) for (const v of step(queue[k])) if (v >= 0 && !outside[v] && !near[v]) { outside[v] = 1; queue.push(v); }
  for (let round = 0, edge = [...queue]; round < FACE_GAP; round++) {
    const next: number[] = [];
    for (const at of edge) for (const v of step(at)) if (v >= 0 && !outside[v] && near[v] !== 1) { outside[v] = 1; next.push(v); }
    edge = next;
  }
  const enclosed = (n: number) => { const x = n % width, y = (n - x) / width; return x >= left && x <= right && y >= top && y <= bottom && !inFace[n] && !outside[local(x, y)] && data[n * 4 + 3] > 0; };
  const eyes: Box[] = [];
  islands(width, (material.length / width) | 0, enclosed, island => {
    const lums = island.map(at => luma(data[at * 4], data[at * 4 + 1], data[at * 4 + 2]));
    const darkest = Math.min(...lums);
    const redness = island.reduce((a, at) => a + data[at * 4] - data[at * 4 + 1], 0) / island.length;
    const kind = darkest < 80 ? FEATURE.eye : redness > 30 ? FEATURE.mouth : -1;
    if (kind === FEATURE.eye && island.length > 20) eyes.push(islandBox(island, width));
    island.forEach((at, k) => {
      if (kind < 0) { material[at] = MATERIAL.skin; return; }
      material[at] = MATERIAL.feature; tone[at] = kind === FEATURE.eye && lums[k] > 205 ? FEATURE.glint : kind;
    });
  });
  // Cheeks: the face's reddest, darker patches in a band just below each eye.
  const reds: number[] = [], lums: number[] = [];
  for (const at of face) { const i = at * 4; reds.push(data[i] - data[i + 1]); lums.push(luma(data[i], data[i + 1], data[i + 2])); }
  const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1];
  const red = median(reds), light = median(lums), faceHeight = bottom - top;
  for (const eye of eyes) {
    const reach = (eye.right - eye.left) * .9;
    for (let y = eye.bottom - Math.round(faceHeight * .02); y <= eye.bottom + faceHeight * .22; y++) for (let x = Math.round(eye.left - reach); x <= eye.right + reach; x++) {
      const n = y * width + x, i = n * 4;
      if (x < 0 || x >= width || !inFace[n] || material[n] !== MATERIAL.skin) continue;
      if (data[i] - data[i + 1] - red > 26 && luma(data[i], data[i + 1], data[i + 2]) < light - 12) { material[n] = MATERIAL.feature; tone[n] = FEATURE.blush; }
    }
  }
}

/** Split each recoloured material into shadow / base / highlight by its own brightness. */
function shadeTones(p: PoseImage, face: Island, material: Uint8Array, tone: Uint8Array): void {
  const { data } = p, lum = (n: number) => luma(data[n * 4], data[n * 4 + 1], data[n * 4 + 2]);
  // Skin follows the face's own base tone, so cheeks and jaw stay one flat colour.
  const reference = face.length ? face : [...material.keys()].filter(n => material[n] === MATERIAL.skin);
  if (reference.length) {
    const sorted = reference.map(lum).sort((a, b) => a - b), base = sorted[sorted.length >> 1];
    for (let n = 0; n < material.length; n++) if (material[n] === MATERIAL.skin) { const v = lum(n); tone[n] = v < base - SKIN_SHADOW ? 0 : v > base + SKIN_LIGHT ? 2 : 1; }
  }
  for (const m of [MATERIAL.hair, MATERIAL.cloth, MATERIAL.pants]) {
    const histogram = new Uint32Array(256); let total = 0;
    for (let n = 0; n < material.length; n++) if (material[n] === m) { histogram[Math.round(lum(n))]++; total++; }
    if (!total) continue;
    const [shadow, highlight] = SHADES[m];
    let low = 0, high = 255;
    for (let v = 0, seen = 0; v < 256; v++) { seen += histogram[v]; if (seen >= total * shadow) { low = v; break; } }
    for (let v = 255, seen = 0; v >= 0; v--) { seen += histogram[v]; if (seen >= total * highlight) { high = v; break; } }
    for (let n = 0; n < material.length; n++) if (material[n] === m) { const v = lum(n); tone[n] = v < low ? 0 : v > high ? 2 : 1; }
  }
}

/** Painted contour ink becomes the neighbouring material; a clean contour is drawn on the grid. */
function absorbContour(width: number, height: number, material: Uint8Array, tone: Uint8Array): void {
  const count = width * height, reach = new Uint8Array(count), queue: number[] = [];
  const neighbours = (at: number) => { const x = at % width, y = (at - x) / width;
    return [x ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y ? at - width : -1, y < height - 1 ? at + width : -1]; };
  for (let n = 0; n < count; n++) if (material[n]) {
    const x = n % width, y = (n - x) / width;
    if (!x || !y || x === width - 1 || y === height - 1 || neighbours(n).some(v => v >= 0 && !material[v])) { reach[n] = 1; queue.push(n); }
  }
  for (let k = 0; k < queue.length; k++) {
    const at = queue[k]; if (reach[at] >= CONTOUR_REACH) continue;
    for (const v of neighbours(at)) if (v >= 0 && material[v] && !reach[v]) { reach[v] = reach[at] + 1; queue.push(v); }
  }
  const fill: number[] = [];
  for (let n = 0; n < count; n++) if (material[n] === MATERIAL.ink && reach[n]) fill.push(n);
  const claimed = new Uint8Array(count), grow: number[] = [];
  for (const n of fill) claimed[n] = 1;
  for (const n of fill) for (const v of neighbours(n)) if (v >= 0 && material[v] && !claimed[v] && material[v] !== MATERIAL.ink) { claimed[v] = 2; grow.push(v); }
  for (let k = 0; k < grow.length; k++) {
    const at = grow[k];
    for (const v of neighbours(at)) if (v >= 0 && claimed[v] === 1) { claimed[v] = 2; material[v] = material[at]; tone[v] = tone[at]; grow.push(v); }
  }
}

// ---------------------------------------------------------------- world grid

/** Vote weight per material: thin line work and face details survive the ~5:1 reduction. */
const PRIORITY = [0, 1, 1, 1, 1, 1.7, 1, 1];
/** Per face detail: eyes and the thin mouth line are boosted, soft cheeks shrink to their core. */
const FEATURE_PRIORITY = [2.2, 2, .55, 3.2];
const TONES = 64;

export type GridPose = { width: number; height: number; material: Uint8Array; tone: Uint8Array };

/**
 * Each world pixel takes the material covering most of its source footprint (or stays
 * clear), then that material's most common shade. Nothing is averaged into new colours.
 */
export function voteTeamPose(seg: PoseSegmentation, place: Placement, width: number, height: number): GridPose {
  const material = new Uint8Array(width * height), tone = new Uint8Array(width * height);
  const weight = new Float64Array(PRIORITY.length), toneWeight = new Float64Array(PRIORITY.length * TONES), touched: number[] = [];
  const inverse = 1 / place.scale;
  for (let ty = 0; ty < height; ty++) {
    const top = (ty - place.y) * inverse, bottom = top + inverse, y0 = Math.max(0, top), y1 = Math.min(seg.height, bottom);
    if (y1 <= y0) continue;
    for (let tx = 0; tx < width; tx++) {
      const left = (tx - place.x) * inverse, right = left + inverse, x0 = Math.max(0, left), x1 = Math.min(seg.width, right);
      if (x1 <= x0) continue;
      // Footprint outside the source image is clear.
      let clear = inverse * inverse - (x1 - x0) * (y1 - y0), solid = 0;
      weight.fill(0); for (const k of touched) toneWeight[k] = 0; touched.length = 0;
      for (let sy = Math.floor(y0); sy < y1; sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < x1; sx++) {
          const w = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * wy, n = sy * seg.width + sx, m = seg.material[n];
          if (!m) { clear += w; continue; }
          const key = m * TONES + seg.tone[n], vote = m === MATERIAL.feature ? w * FEATURE_PRIORITY[seg.tone[n]] : w;
          if (!toneWeight[key]) touched.push(key);
          solid += w; weight[m] += vote; toneWeight[key] += vote;
        }
      }
      if (clear >= solid) continue;
      let m = 0;
      for (let k = 1; k < weight.length; k++) if (weight[k] * PRIORITY[k] > weight[m] * PRIORITY[m]) m = k;
      let t = 0;
      for (let k = 1; k < TONES; k++) if (toneWeight[m * TONES + k] > toneWeight[m * TONES + t]) t = k;
      material[ty * width + tx] = m; tone[ty * width + tx] = t;
    }
  }
  const grid = { width, height, material, tone };
  despeckle(grid); despeckle(grid);
  outline(grid);
  return grid;
}

function neighbourList(grid: GridPose, at: number): number[] {
  const x = at % grid.width, y = (at - x) / grid.width;
  return [x ? at - 1 : -1, x < grid.width - 1 ? at + 1 : -1, y ? at - grid.width : -1, y < grid.height - 1 ? at + grid.width : -1];
}

/** Single pixels that match nothing around them join their surroundings. Face details stay. */
function despeckle(grid: GridPose): void {
  const { material, tone } = grid, nextMaterial = material.slice(), nextTone = tone.slice();
  for (let at = 0; at < material.length; at++) {
    const m = material[at];
    if (!m || m === MATERIAL.feature) continue;
    const around = neighbourList(grid, at).filter(v => v >= 0 && material[v]);
    if (around.every(v => material[v] !== m)) {
      // A lone pixel of another material: take the most common surrounding material and shade.
      const counts = new Map<number, number>();
      for (const v of around) if (material[v] !== MATERIAL.feature) counts.set(material[v] * TONES + tone[v], (counts.get(material[v] * TONES + tone[v]) ?? 0) + 1);
      let best = -1, score = 1;
      for (const [key, n] of counts) if (n > score || (n === score && best >= 0 && key < best)) { best = key; score = n; }
      if (best >= 0) { nextMaterial[at] = Math.floor(best / TONES); nextTone[at] = best % TONES; }
      continue;
    }
    const same = around.filter(v => material[v] === m);
    if (same.length < 2 || same.some(v => tone[v] === tone[at])) continue;
    const counts = new Map<number, number>();
    for (const v of same) counts.set(tone[v], (counts.get(tone[v]) ?? 0) + 1);
    let best = tone[at], score = 0;
    for (const [t, n] of counts) if (n > score || (n === score && t < best)) { best = t; score = n; }
    nextTone[at] = best;
  }
  material.set(nextMaterial); tone.set(nextTone);
}

/** One warm ink pixel wherever the figure meets transparency. */
function outline(grid: GridPose): void {
  const { material, tone, width, height } = grid, edge: number[] = [];
  for (let at = 0; at < material.length; at++) {
    if (!material[at]) continue;
    const x = at % width, y = (at - x) / width;
    if (!x || !y || x === width - 1 || y === height - 1 || neighbourList(grid, at).some(v => v >= 0 && !material[v])) edge.push(at);
  }
  for (const at of edge) { material[at] = MATERIAL.ink; tone[at] = 0; }
}

// ---------------------------------------------------------------- colours

const mixRgb = (a: Rgb, b: Rgb, amount: number): Rgb => a.map((v, k) => Math.round(v + (b[k] - v) * amount)) as unknown as Rgb;
const ROSE: Rgb = [214, 96, 96], LIP: Rgb = [140, 43, 32];

/** Paint a voted pose with one look's ramps; returns straight RGBA for the 2× world grid. */
export function paintTeamPose(grid: GridPose, colours: TeamColours): Uint8ClampedArray {
  const out = new Uint8ClampedArray(grid.width * grid.height * 4);
  const snap = (rgb: Rgb): Rgb => OTHER_PALETTE[nearestOther(...rgb)];
  const feature: Rgb[] = [INK_EYE, GLINT, snap(mixRgb(colours.skin[1], ROSE, .3)), snap(mixRgb(colours.skin[0], LIP, .5))];
  const ramps: (Ramp | null)[] = [null, colours.skin, colours.hair, colours.cloth, colours.pants];
  for (let at = 0; at < grid.material.length; at++) {
    const m = grid.material[at], t = grid.tone[at];
    if (!m) continue;
    const rgb = m <= MATERIAL.pants ? ramps[m]![Math.min(2, t)] : m === MATERIAL.ink ? INK_LINE
      : m === MATERIAL.feature ? feature[t] ?? INK_EYE : OTHER_PALETTE[t] ?? INK_LINE;
    out[at * 4] = rgb[0]; out[at * 4 + 1] = rgb[1]; out[at * 4 + 2] = rgb[2]; out[at * 4 + 3] = 255;
  }
  return out;
}
