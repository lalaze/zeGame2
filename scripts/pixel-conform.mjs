#!/usr/bin/env node
// Put generated artwork on the café's single art grid (2 art px per room px) and the
// shared master palette, or verify that a PNG already is. See docs/art-grid/README.md.
//
//   node scripts/pixel-conform.mjs conform <in.png> --out=<out.png> (--width=N | --height=N | --room-width=N | --room-height=N)
//        [--crop=x,y,w,h] [--key=#rrggbb[:tolerance]] [--palette=docs/art-grid/palette.json | --no-palette] [--keep-alpha]
//   node scripts/pixel-conform.mjs check <png...> [--palette=...] [--keep-alpha]
//   node scripts/pixel-conform.mjs palette <reference.png...> --colors=48 --out=<palette.json>
//   node scripts/pixel-conform.mjs ramps docs/art-grid/palette-spec.json --out=docs/art-grid/palette.json --swatch=docs/art-grid/palette.png
//
// `conform` resamples with the same dominant-colour algorithm the game uses
// (src/render/pixel-resample.ts), then snaps every opaque pixel to the nearest palette
// colour (OKLab) and alpha to fully opaque or fully clear (glass: --keep-alpha).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { resampleRgba } from '../src/render/pixel-resample.ts';

const WORLD_ART_DENSITY = 2;
const DEFAULT_PALETTE = 'docs/art-grid/palette.json';

// ---------------------------------------------------------------- PNG codec
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = bytes => { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function decodePng(file) {
  const data = fs.readFileSync(file);
  if (!data.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${file}: not a PNG`);
  let offset = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null, transparency = null;
  const idat = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset), name = data.toString('ascii', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (name === 'PLTE') palette = body;
    else if (name === 'tRNS') transparency = body;
    else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
    offset += length + 12;
  }
  if (depth !== 8 || interlace) throw new Error(`${file}: only 8-bit non-interlaced PNGs are supported`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`${file}: unsupported colour type ${type}`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * channels;
  const pixels = new Uint8ClampedArray(width * height * 4), line = new Uint8Array(stride), previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0, b = previous[i], c = i >= channels ? previous[i - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      line[i] = (row[i] + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, i = x * channels;
      if (type === 6) pixels.set(line.subarray(i, i + 4), o);
      else if (type === 2) { pixels.set(line.subarray(i, i + 3), o); pixels[o + 3] = 255; }
      else if (type === 0) { pixels.fill(line[i], o, o + 3); pixels[o + 3] = 255; }
      else if (type === 4) { pixels.fill(line[i], o, o + 3); pixels[o + 3] = line[i + 1]; }
      else { const k = line[i]; pixels.set(palette.subarray(k * 3, k * 3 + 3), o); pixels[o + 3] = transparency && k < transparency.length ? transparency[k] : 255; }
    }
    previous.set(line);
  }
  return { width, height, pixels };
}

export function encodePng(file, { width, height, pixels }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const chunk = (name, body) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(body.length, 0); head.write(name, 4, 'ascii');
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, tail]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

// ---------------------------------------------------------------- colour
const linear = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function oklab(r, g, b) {
  const R = linear(r), G = linear(g), B = linear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
const unhex = text => [1, 3, 5].map(i => parseInt(text.slice(i, i + 2), 16));
const distance = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function loadPalette(file) {
  const colours = JSON.parse(fs.readFileSync(file, 'utf8')).colors.map(c => unhex(c.hex));
  return { colours, lab: colours.map(c => oklab(...c)), cache: new Map() };
}
function nearest(palette, r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  let index = palette.cache.get(key);
  if (index === undefined) {
    const lab = oklab(r, g, b);
    index = 0; let best = Infinity;
    palette.lab.forEach((p, i) => { const d = distance(lab, p); if (d < best) { best = d; index = i; } });
    palette.cache.set(key, index);
  }
  return index;
}

/** k-means++ in OKLab; each result is the real sample colour nearest its centre, darkest first. */
function clusterColours(samples, wanted, seed = 7) {
  const points = samples.map(rgb => ({ rgb, lab: oklab(...rgb) }));
  if (!points.length) return [];
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const centres = [points[Math.floor(random() * points.length)].lab];
  const closest = new Float64Array(points.length).fill(Infinity);
  while (centres.length < Math.min(wanted, points.length)) {
    let total = 0;
    points.forEach((p, i) => { closest[i] = Math.min(closest[i], distance(p.lab, centres.at(-1))); total += closest[i]; });
    let pick = random() * total, index = 0;
    while (pick > closest[index] && index < points.length - 1) pick -= closest[index++];
    centres.push(points[index].lab);
  }
  const owner = new Int32Array(points.length);
  for (let round = 0; round < 24; round++) {
    points.forEach((p, i) => { let best = Infinity; centres.forEach((c, k) => { const d = distance(p.lab, c); if (d < best) { best = d; owner[i] = k; } }); });
    const sums = centres.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => { const s = sums[owner[i]]; s[0] += p.lab[0]; s[1] += p.lab[1]; s[2] += p.lab[2]; s[3]++; });
    sums.forEach((s, k) => { if (s[3]) centres[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  return centres.map((c, k) => {
    let best = Infinity, colour = null, members = 0;
    points.forEach((p, i) => { if (owner[i] !== k) return; members++; const d = distance(p.lab, c); if (d < best) { best = d; colour = p.rgb; } });
    return colour && { rgb: colour, share: members / points.length, lightness: oklab(...colour)[0] };
  }).filter(Boolean).sort((a, b) => a.lightness - b.lightness);
}

/** Pixel-art ramp around a base colour: shadows cooler and deeper, highlights warmer. */
function shadeRamp(base, shades) {
  const [r, g, b] = base, out = [];
  for (let i = 0; i < shades; i++) {
    const t = shades === 1 ? 0 : i / (shades - 1) * 2 - 1; // -1 shadow … +1 highlight
    const mixTo = t < 0 ? [70, 40, 60] : [255, 236, 196];
    const amount = Math.abs(t) * (t < 0 ? 0.42 : 0.38);
    out.push([r, g, b].map((v, k) => Math.round(v + (mixTo[k] - v) * amount)));
  }
  return out;
}

// ---------------------------------------------------------------- commands
const args = process.argv.slice(2);
const option = (name, fallback) => { const hit = args.find(a => a === `--${name}` || a.startsWith(`--${name}=`)); return hit === undefined ? fallback : hit.includes('=') ? hit.split('=').slice(1).join('=') : true; };
const positional = args.filter(a => !a.startsWith('--'));
const command = positional.shift();

function conform() {
  const [input] = positional;
  const out = option('out');
  if (!input || !out) throw new Error('conform needs <in.png> and --out=<out.png>');
  let image = decodePng(input);
  const crop = option('crop');
  if (crop) {
    const [x, y, w, h] = String(crop).split(',').map(Number);
    const pixels = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) pixels.set(image.pixels.subarray(((y + row) * image.width + x) * 4, ((y + row) * image.width + x + w) * 4), row * w * 4);
    image = { width: w, height: h, pixels };
  }
  const key = option('key');
  if (key) {
    const [colour, tolerance = '24'] = String(key).split(':'), target = unhex(colour), limit = Number(tolerance) ** 2;
    for (let i = 0; i < image.pixels.length; i += 4) {
      const p = image.pixels;
      if ((p[i] - target[0]) ** 2 + (p[i + 1] - target[1]) ** 2 + (p[i + 2] - target[2]) ** 2 <= limit) p[i + 3] = 0;
    }
  }
  const roomWidth = option('room-width'), roomHeight = option('room-height');
  let width = Number(option('width', roomWidth ? Number(roomWidth) * WORLD_ART_DENSITY : 0));
  let height = Number(option('height', roomHeight ? Number(roomHeight) * WORLD_ART_DENSITY : 0));
  if (!width && !height) throw new Error('conform needs --width, --height, --room-width or --room-height');
  if (!width) width = Math.max(1, Math.round(image.width * height / image.height));
  if (!height) height = Math.max(1, Math.round(image.height * width / image.width));
  const pixels = resampleRgba(image.pixels, image.width, image.height, width, height);
  const keepAlpha = option('keep-alpha', false);
  const paletteFile = option('no-palette', false) ? null : option('palette', DEFAULT_PALETTE);
  const palette = paletteFile ? loadPalette(paletteFile) : null;
  let error = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (!keepAlpha) pixels[i + 3] = pixels[i + 3] >= 128 ? 255 : 0;
    if (!pixels[i + 3]) { pixels[i] = pixels[i + 1] = pixels[i + 2] = 0; continue; }
    if (!palette) continue;
    const k = nearest(palette, pixels[i], pixels[i + 1], pixels[i + 2]), c = palette.colours[k];
    error += Math.sqrt(distance(oklab(pixels[i], pixels[i + 1], pixels[i + 2]), palette.lab[k])); count++;
    pixels.set(c, i);
  }
  encodePng(out, { width, height, pixels });
  const used = new Set(); for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3]) used.add(hex([pixels[i], pixels[i + 1], pixels[i + 2]]));
  console.log(JSON.stringify({ out, source: [image.width, image.height], art: [width, height], room: [width / WORLD_ART_DENSITY, height / WORLD_ART_DENSITY],
    colours: used.size, palette: paletteFile, meanPaletteError: count ? +(error / count).toFixed(4) : 0 }));
}

function check() {
  if (!positional.length) throw new Error('check needs at least one PNG');
  const paletteFile = option('no-palette', false) ? null : option('palette', DEFAULT_PALETTE);
  const allowed = paletteFile ? new Set(loadPalette(paletteFile).colours.map(hex)) : null;
  const keepAlpha = option('keep-alpha', false);
  let failed = 0;
  for (const file of positional) {
    const { width, height, pixels } = decodePng(file), off = new Set();
    let partial = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const a = pixels[i + 3];
      if (!a) continue;
      if (a !== 255) partial++;
      const colour = hex([pixels[i], pixels[i + 1], pixels[i + 2]]);
      if (allowed && !allowed.has(colour)) off.add(colour);
    }
    const ok = !off.size && (keepAlpha || !partial);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${file} ${width}×${height} art px (${width / WORLD_ART_DENSITY}×${height / WORLD_ART_DENSITY} room px)` +
      (off.size ? ` · ${off.size} off-palette colours (${[...off].slice(0, 6).join(' ')}${off.size > 6 ? ' …' : ''})` : '') +
      (partial && !keepAlpha ? ` · ${partial} partially transparent pixels` : ''));
  }
  if (failed) process.exitCode = 1;
}

function palette() {
  const out = option('out'), wanted = Number(option('colors', 48));
  if (!positional.length || !out) throw new Error('palette needs reference PNGs and --out');
  const samples = [];
  for (const file of positional) {
    const { pixels } = decodePng(file);
    for (let i = 0; i < pixels.length; i += 4 * 7) if (pixels[i + 3] > 200) samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  const points = samples.map(c => ({ rgb: c, lab: oklab(...c) }));
  // k-means++ in OKLab, deterministic seeding.
  let seed = 7; const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const centres = [points[Math.floor(random() * points.length)].lab];
  const closest = new Float64Array(points.length).fill(Infinity);
  while (centres.length < wanted) {
    let total = 0;
    points.forEach((p, i) => { closest[i] = Math.min(closest[i], distance(p.lab, centres.at(-1))); total += closest[i]; });
    let pick = random() * total, index = 0;
    while (pick > closest[index] && index < points.length - 1) pick -= closest[index++];
    centres.push(points[index].lab);
  }
  const owner = new Int32Array(points.length);
  for (let round = 0; round < 24; round++) {
    points.forEach((p, i) => { let best = Infinity; centres.forEach((c, k) => { const d = distance(p.lab, c); if (d < best) { best = d; owner[i] = k; } }); });
    const sums = centres.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => { const s = sums[owner[i]]; s[0] += p.lab[0]; s[1] += p.lab[1]; s[2] += p.lab[2]; s[3]++; });
    sums.forEach((s, k) => { if (s[3]) centres[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  // Each palette entry is the real reference colour nearest its cluster centre.
  const colours = centres.map((c, k) => {
    let best = Infinity, colour = null, members = 0;
    points.forEach((p, i) => { if (owner[i] !== k) return; members++; const d = distance(p.lab, c); if (d < best) { best = d; colour = p.rgb; } });
    return colour && { hex: hex(colour), share: +(members / points.length).toFixed(4), lightness: +oklab(...colour)[0].toFixed(3) };
  }).filter(Boolean);
  const unique = [...new Map(colours.map(c => [c.hex, c])).values()].sort((a, b) => a.lightness - b.lightness);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ source: positional, method: 'k-means in OKLab over opaque pixels; each entry is a real reference colour', colors: unique }, null, 2) + '\n');
  console.log(JSON.stringify({ out, colours: unique.length }));
}

/** Material filter for sampled ramps: OKLab hue range (degrees), chroma and lightness bounds. */
function accepts(rule, rgb) {
  const [l, a, b] = oklab(...rgb), chroma = Math.hypot(a, b), hue = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  if (rule.hue) { const [lo, hi] = rule.hue; if (lo <= hi ? hue < lo || hue > hi : hue < lo && hue > hi) return false; }
  return chroma >= (rule.minChroma ?? 0) && chroma <= (rule.maxChroma ?? 1) && l >= (rule.minLightness ?? 0) && l <= (rule.maxLightness ?? 1);
}

function ramps() {
  const [specFile] = positional, out = option('out'), swatch = option('swatch');
  if (!specFile || !out) throw new Error('ramps needs <palette-spec.json> and --out');
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const reference = decodePng(spec.reference), colours = [];
  for (const entry of spec.sampled) {
    const samples = [];
    for (const [x0, y0, x1, y1] of entry.boxes)
      for (let y = y0; y < Math.min(y1, reference.height); y += 2) for (let x = x0; x < Math.min(x1, reference.width); x += 2) {
        const i = (y * reference.width + x) * 4;
        if (reference.pixels[i + 3] < 200) continue;
        const rgb = [reference.pixels[i], reference.pixels[i + 1], reference.pixels[i + 2]];
        if (entry.darkest !== undefined && oklab(...rgb)[0] > entry.darkest + 0.2) continue;
        if (entry.accept && !entry.accept.some(rule => accepts(rule, rgb))) continue;
        samples.push(rgb);
      }
    const found = entry.darkest !== undefined ? clusterColours(samples, entry.shades * 3).slice(0, entry.shades) : clusterColours(samples, entry.shades);
    found.forEach((c, index) => colours.push({ hex: hex(c.rgb), ramp: entry.ramp, index, lightness: +c.lightness.toFixed(3) }));
  }
  for (const entry of spec.generated) entry.colors.forEach((base, option) =>
    shadeRamp(unhex(base), entry.shades).forEach((rgb, index) =>
      colours.push({ hex: hex(rgb), ramp: entry.colors.length > 1 ? `${entry.ramp}-${option}` : entry.ramp, index, lightness: +oklab(...rgb)[0].toFixed(3) })));
  const unique = [...new Map(colours.map(c => [c.hex, c])).values()];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ spec: specFile, reference: spec.reference, colors: unique }, null, 2) + '\n');
  if (swatch) {
    const byRamp = new Map(); for (const c of unique) { if (!byRamp.has(c.ramp)) byRamp.set(c.ramp, []); byRamp.get(c.ramp).push(c); }
    const cell = 16, width = cell * Math.max(...[...byRamp.values()].map(r => r.length)), height = cell * byRamp.size;
    const pixels = new Uint8ClampedArray(width * height * 4);
    [...byRamp.values()].forEach((ramp, row) => ramp.forEach((c, column) => {
      const rgb = unhex(c.hex);
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) pixels.set([...rgb, 255], ((row * cell + y) * width + column * cell + x) * 4);
    }));
    encodePng(swatch, { width, height, pixels });
  }
  console.log(JSON.stringify({ out, swatch: swatch || null, colours: unique.length, ramps: [...new Set(unique.map(c => c.ramp))].length }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    if (command === 'conform') conform();
    else if (command === 'check') check();
    else if (command === 'palette') palette();
    else if (command === 'ramps') ramps();
    else { console.error('usage: pixel-conform.mjs conform|check|palette|ramps … (see file header)'); process.exitCode = 2; }
  } catch (error) { console.error(String(error.message || error)); process.exitCode = 1; }
}
