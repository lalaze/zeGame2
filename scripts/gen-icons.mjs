// Generates the app icons (SVG + PNG) from a pixel map. Run with `npm run icons`.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// A little maker's mark: cream ceramic, sage bean and a brass-rim timber tile.
// Drawn natively on a 24px grid, matching the interface and the room materials.
const COLORS = { o: '#39281f', w: '#865332', W: '#c98c4d', h: '#ebbd7d', d: '#543425',
  b: '#627451', B: '#3d503a', c: '#f4e6c7', C: '#fff5dc', s: '#c7b28b',
  g: '#c8a15e', G: '#f0ce85', k: '#866344' };
const SIZE = 24;
const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill('o'));
const r = (x, y, w, h, color) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = color;
};
r(1, 1, 22, 22, 'w'); r(1, 1, 22, 1, 'h'); r(1, 2, 1, 20, 'W');
r(2, 22, 21, 1, 'd'); r(22, 2, 1, 20, 'd');
r(3, 3, 18, 18, 'k'); r(4, 4, 16, 16, 'b'); r(4, 4, 16, 1, 'g');
r(4, 5, 1, 14, 'g'); r(5, 19, 15, 1, 'B'); r(19, 5, 1, 14, 'B');
// Four brass corner pins have a one-pixel upper-left gleam.
for (const [x, y] of [[2, 2], [20, 2], [2, 20], [20, 20]]) { r(x, y, 2, 2, 'g'); r(x, y, 1, 1, 'G'); }
// Steam, deliberately sparse and without a dark outline.
r(9, 5, 1, 1, 'C'); r(8, 6, 1, 1, 'c'); r(9, 7, 1, 1, 's');
r(13, 5, 1, 1, 'C'); r(12, 6, 1, 1, 'c'); r(13, 7, 1, 1, 's');
// Ceramic cup, dark roast opening, handle, bean stamp, foot and saucer.
r(5, 8, 12, 8, 'o'); r(6, 16, 10, 1, 'o');
r(17, 9, 3, 6, 'o'); r(17, 10, 2, 4, 'c'); r(17, 11, 1, 2, 'b');
r(6, 9, 10, 6, 'c'); r(7, 15, 8, 1, 's');
r(6, 9, 10, 1, 'C'); r(7, 10, 8, 1, 'd'); r(6, 10, 1, 4, 'C');
r(10, 11, 3, 3, 'b'); r(9, 12, 1, 2, 'B'); r(12, 12, 1, 2, 'B'); r(11, 11, 1, 1, 'C'); r(10, 13, 1, 1, 'C');
r(4, 17, 15, 1, 'o'); r(5, 18, 13, 1, 'o'); r(5, 17, 13, 1, 'C'); r(7, 18, 9, 1, 's');

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">`;
svg += `<rect width="${SIZE}" height="${SIZE}" fill="${COLORS.o}"/>`;
grid.forEach((row, y) =>
  row.forEach((ch, x) => {
    svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${COLORS[ch]}"/>`;
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
