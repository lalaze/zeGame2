// Generates the app icons (SVG + PNG) from a pixel map. Run with `npm run icons`.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ART = [
  '.....s...s......',
  '....s...s.......',
  '.....s...s......',
  '................',
  '..wwwwwwwwwww...',
  '..wcccccccccwww.',
  '..wwwwwwwwwww.w.',
  '..wwwwpwpwwww.w.',
  '..wwwwpppwwwww..',
  '..wwwwwpwwwww...',
  '...wwwwwwwww....',
  '....wwwwwww.....',
  '.dddddddddddddd.',
];
const COLORS = { s: '#fbf5ea', w: '#fbf5ea', c: '#6b3e26', p: '#ef5d7a', d: '#d9cbb8', o: '#3a2418', b: '#c98f5e' };
const SIZE = 18;

// Center the art on the canvas and add a dark outline around it.
const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill('b'));
const ox = 1;
const oy = 3;
ART.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && (grid[y + oy][x + ox] = ch)));
const isArt = (x, y) => grid[y]?.[x] !== undefined && grid[y][x] !== 'b' && grid[y][x] !== 'o';
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (grid[y][x] !== 'b') continue;
    if (grid[y][x] === 'b' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isArt(x + dx, y + dy))) {
      grid[y][x] = 'o';
    }
  }
}
// Steam stays soft: no outline around the wisps.
ART.slice(0, 3).forEach((row, y) =>
  [...row].forEach((ch, x) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const gx = x + ox + dx;
      const gy = y + oy + dy;
      if (ch === 's' && grid[gy][gx] === 'o' && gy < oy + 3) grid[gy][gx] = 'b';
    }
  }),
);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">`;
svg += `<rect width="${SIZE}" height="${SIZE}" rx="3" fill="${COLORS.b}"/>`;
grid.forEach((row, y) =>
  row.forEach((ch, x) => {
    if (ch !== 'b') svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${COLORS[ch]}"/>`;
  }),
);
svg += '</svg>\n';
writeFileSync('public/icon.svg', svg);

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(px) {
  const scale = Math.floor(px / SIZE);
  const pad = Math.floor((px - scale * SIZE) / 2);
  const raw = Buffer.alloc((px * 4 + 1) * px);
  for (let y = 0; y < px; y++) {
    raw[y * (px * 4 + 1)] = 0;
    for (let x = 0; x < px; x++) {
      const gx = Math.min(SIZE - 1, Math.max(0, Math.floor((x - pad) / scale)));
      const gy = Math.min(SIZE - 1, Math.max(0, Math.floor((y - pad) / scale)));
      const [r, g, b] = hex(COLORS[grid[gy][gx]]);
      const i = y * (px * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const px of [192, 512]) writeFileSync(`public/icon-${px}.png`, png(px));
console.log('icons written to public/');
