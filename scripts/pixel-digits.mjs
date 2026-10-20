// Builds the "Pixel Digits" web font: Fusion Pixel's digits (OFL 1.1), whose 5 is
// clearly not an S. Fusion Pixel puts a digit's one pixel of spacing on the right,
// so beside Pixelify Sans letters a number crowded the word before it ("Taste4.5").
// Each digit moves right by one design pixel and widens by one, leaving a pixel on
// each side (700 units, about Pixelify's own digit width). Glyph shapes are unchanged.
import subsetFont from 'subset-font';
import fontverter from 'fontverter';

export const DIGITS = '0123456789';
/** One pixel of the 12px design grid, in font units (1200 units per em). */
export const PIXEL = 100;

const tag = (buf, at) => buf.toString('ascii', at, at + 4);

function tables(sfnt) {
  const out = new Map();
  for (let i = 0; i < sfnt.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    out.set(tag(sfnt, at), sfnt.subarray(sfnt.readUInt32BE(at + 8), sfnt.readUInt32BE(at + 8) + sfnt.readUInt32BE(at + 12)));
  }
  return out;
}

function checksum(buf) {
  const padded = Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4)]);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
}

/** Reassembles an sfnt from its tables, with fresh offsets and checksums. */
function assemble(flavor, map) {
  const names = [...map.keys()].sort();
  const n = names.length, header = Buffer.alloc(12 + n * 16);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(n, 4);
  let pow = 1; while (pow * 2 <= n) pow *= 2;
  header.writeUInt16BE(pow * 16, 6);
  header.writeUInt16BE(Math.log2(pow), 8);
  header.writeUInt16BE(n * 16 - pow * 16, 10);
  const head = Buffer.from(map.get('head'));
  head.writeUInt32BE(0, 8);
  map.set('head', head);
  const bodies = []; let offset = header.length;
  names.forEach((name, i) => {
    const data = map.get(name), at = 12 + i * 16;
    header.write(name, at, 'ascii');
    header.writeUInt32BE(checksum(data), at + 4);
    header.writeUInt32BE(offset, at + 8);
    header.writeUInt32BE(data.length, at + 12);
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
    bodies.push(padded); offset += padded.length;
  });
  const font = Buffer.concat([header, ...bodies]);
  const headAt = header.readUInt32BE(12 + names.indexOf('head') * 16 + 8);
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headAt + 8);
  return font;
}

function readIndex(cff, at) {
  const count = cff.readUInt16BE(at);
  if (!count) return { items: [], end: at + 2 };
  const size = cff[at + 2], offset = (i) => cff.readUIntBE(at + 3 + i * size, size);
  const base = at + 3 + (count + 1) * size - 1;
  const items = Array.from({ length: count }, (_, i) => cff.subarray(base + offset(i), base + offset(i + 1)));
  return { items, end: base + offset(count) };
}

function writeIndex(items) {
  const total = items.reduce((sum, item) => sum + item.length, 1);
  const size = total < 0x100 ? 1 : total < 0x10000 ? 2 : total < 0x1000000 ? 3 : 4;
  const head = Buffer.alloc(3 + (items.length + 1) * size);
  head.writeUInt16BE(items.length, 0); head[2] = size;
  let offset = 1;
  items.forEach((item, i) => { head.writeUIntBE(offset, 3 + i * size, size); offset += item.length; });
  head.writeUIntBE(offset, 3 + items.length * size, size);
  return Buffer.concat([head, ...items]);
}

/** Top DICT operators with their operand positions, so 5-byte offsets can be patched in place. */
function readDict(buf) {
  const ops = new Map(); let operands = [];
  for (let i = 0; i < buf.length;) {
    const b = buf[i];
    if (b <= 21) { const op = b === 12 ? 1200 + buf[i + 1] : b; i += b === 12 ? 2 : 1; ops.set(op, operands); operands = []; }
    else if (b === 28) { operands.push({ value: buf.readInt16BE(i + 1), at: i, size: 3 }); i += 3; }
    else if (b === 29) { operands.push({ value: buf.readInt32BE(i + 1), at: i, size: 5 }); i += 5; }
    else if (b === 30) { const at = i++; while ((buf[i] & 15) !== 15 && (buf[i] >> 4) !== 15) i++; i++; operands.push({ value: NaN, at, size: i - at }); }
    else if (b <= 246) { operands.push({ value: b - 139, at: i, size: 1 }); i++; }
    else if (b <= 250) { operands.push({ value: (b - 247) * 256 + buf[i + 1] + 108, at: i, size: 2 }); i += 2; }
    else { operands.push({ value: -(b - 251) * 256 - buf[i + 1] - 108, at: i, size: 2 }); i += 2; }
  }
  return ops;
}

function encodeNumber(n) {
  if (n >= -107 && n <= 107) return [n + 139];
  if (n >= 108 && n <= 1131) return [((n - 108) >> 8) + 247, (n - 108) & 255];
  if (n <= -108 && n >= -1131) return [((-n - 108) >> 8) + 251, (-n - 108) & 255];
  return [28, (n >> 8) & 255, n & 255];
}

/** Shifts a Type 2 charstring right by `pad` and sets its width; the first operator must be a move. */
function padCharstring(cs, pad, width) {
  const operands = []; let i = 0;
  while (i < cs.length && !(cs[i] <= 31 && cs[i] !== 28)) {
    const b = cs[i];
    if (b === 28) { operands.push(cs.readInt16BE(i + 1)); i += 3; }
    else if (b <= 246) { operands.push(b - 139); i++; }
    else if (b <= 250) { operands.push((b - 247) * 256 + cs[i + 1] + 108); i += 2; }
    else if (b <= 254) { operands.push(-(b - 251) * 256 - cs[i + 1] - 108); i += 2; }
    else throw Error('Pixel digits: fixed-point charstring operand is not supported');
  }
  const op = cs[i], args = { 21: 2, 22: 1, 4: 1 }[op];
  if (args === undefined) throw Error(`Pixel digits: glyph starts with operator ${op}, expected a move`);
  if (operands.length !== args && operands.length !== args + 1) throw Error('Pixel digits: unexpected move operands');
  const move = operands.slice(operands.length - args);
  // rmoveto dx dy / hmoveto dx move right by pad; vmoveto dy becomes "pad dy rmoveto".
  const [next, nextOp] = op === 4 ? [[pad, move[0]], 21] : [[move[0] + pad, ...move.slice(1)], op];
  return Buffer.concat([Buffer.from([...encodeNumber(width), ...next.flatMap(encodeNumber), nextOp]), cs.subarray(i + 1)]);
}

/** Moves every glyph except .notdef right by `pad` font units and widens it by `pad`, in an sfnt with CFF outlines. */
export function padCffGlyphs(sfnt, pad = PIXEL) {
  const map = tables(sfnt);
  const cff = map.get('CFF ');
  if (!cff) throw Error('Pixel digits: expected CFF outlines');
  const top = readIndex(cff, readIndex(cff, cff[2]).end);
  const dict = readDict(top.items[0]);
  const [privateSize] = dict.get(18) ?? [{ value: 0 }];
  if (privateSize.value !== 0) throw Error('Pixel digits: a Private DICT (widths or subroutines) is not supported');
  const strings = readIndex(cff, top.end), globals = readIndex(cff, strings.end);
  if (globals.items.length) throw Error('Pixel digits: subroutines are not supported');
  const csOperand = dict.get(17)[0];
  if (csOperand.size !== 5) throw Error('Pixel digits: CharStrings offset is not a 5-byte integer');
  const old = readIndex(cff, csOperand.value);

  const hhea = Buffer.from(map.get('hhea')), hmtx = Buffer.from(map.get('hmtx'));
  const metrics = hhea.readUInt16BE(34), glyphs = old.items.length;
  const advance = (g) => hmtx.readUInt16BE(Math.min(g, metrics - 1) * 4);
  const widths = Array.from({ length: glyphs }, (_, g) => (g === 0 ? advance(0) : advance(g) + pad));
  const charstrings = old.items.map((cs, g) => (g === 0 ? cs : padCharstring(cs, pad, widths[g])));
  for (let g = 1; g < glyphs; g++) {
    if (g < metrics) hmtx.writeUInt16BE(widths[g], g * 4);
    const lsbAt = g < metrics ? g * 4 + 2 : metrics * 4 + (g - metrics) * 2;
    hmtx.writeInt16BE(hmtx.readInt16BE(lsbAt) + pad, lsbAt);
  }
  hhea.writeUInt16BE(Math.max(hhea.readUInt16BE(10), ...widths), 10);

  // CharStrings keep their start, so the Top DICT is untouched as long as nothing it points to follows them.
  for (const op of [15, 16]) for (const { value } of dict.get(op) ?? []) if (value > csOperand.value) throw Error('Pixel digits: data after CharStrings');
  const rebuilt = Buffer.concat([cff.subarray(0, csOperand.value), writeIndex(charstrings), cff.subarray(old.end)]);
  const head = Buffer.from(map.get('head'));
  head.writeInt16BE(head.readInt16BE(40) + pad, 40); // xMax: outlines moved right by pad
  map.set('CFF ', rebuilt); map.set('hmtx', hmtx); map.set('hhea', hhea); map.set('head', head);
  return assemble(sfnt.readUInt32BE(0), map);
}

/** Fusion Pixel source (woff2) → padded digits (woff2). */
export async function buildPixelDigits(source) {
  const sfnt = Buffer.from(await subsetFont(source, DIGITS, { targetFormat: 'truetype' }));
  return fontverter.convert(padCffGlyphs(sfnt), 'woff2');
}
