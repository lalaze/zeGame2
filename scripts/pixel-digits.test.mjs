import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fontverter from 'fontverter';
import subsetFont from 'subset-font';
import { DIGITS, PIXEL, buildPixelDigits } from './pixel-digits.mjs';

const SOURCE = 'node_modules/@fontsource/fusion-pixel-12px-proportional-sc/files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff2';

function table(sfnt, name) {
  for (let i = 0; i < sfnt.readUInt16BE(4); i++) {
    const at = 12 + i * 16;
    if (sfnt.toString('ascii', at, at + 4) === name) return sfnt.subarray(sfnt.readUInt32BE(at + 8), sfnt.readUInt32BE(at + 8) + sfnt.readUInt32BE(at + 12));
  }
  throw Error(`missing ${name}`);
}
/** [advance, lsb] for each glyph from hmtx. */
function metrics(sfnt) {
  const hmtx = table(sfnt, 'hmtx'), long = table(sfnt, 'hhea').readUInt16BE(34), glyphs = table(sfnt, 'maxp').readUInt16BE(4);
  return Array.from({ length: glyphs }, (_, g) => [hmtx.readUInt16BE(Math.min(g, long - 1) * 4),
    hmtx.readInt16BE(g < long ? g * 4 + 2 : long * 4 + (g - long) * 2)]);
}
const checksum = (buf) => { let sum = 0; for (let i = 0; i + 3 < buf.length; i += 4) sum = (sum + buf.readUInt32BE(i)) >>> 0; return sum; };

describe('Pixel Digits font', () => {
  it('moves every digit right by one design pixel and widens it by one, leaving a pixel on each side', async () => {
    const source = readFileSync(SOURCE);
    const original = Buffer.from(await subsetFont(source, DIGITS, { targetFormat: 'truetype' }));
    const padded = await fontverter.convert(await buildPixelDigits(source), 'sfnt');
    const before = metrics(original), after = metrics(padded);
    expect(after).toHaveLength(before.length);
    expect(after[0]).toEqual(before[0]); // .notdef untouched
    for (let g = 1; g < before.length; g++) expect(after[g]).toEqual([before[g][0] + PIXEL, before[g][1] + PIXEL]);
    // Fusion Pixel's digits started flush left (600 units wide, one pixel spare on the right).
    expect(before.slice(1).every(([advance, lsb]) => advance === 6 * PIXEL && lsb === 0)).toBe(true);
    expect(table(padded, 'head').readUInt16BE(18)).toBe(1200);
  });

  it('writes a well-formed sfnt with a valid whole-font checksum', async () => {
    const padded = await fontverter.convert(await buildPixelDigits(readFileSync(SOURCE)), 'sfnt');
    expect(padded.toString('ascii', 0, 4)).toBe('OTTO');
    expect(checksum(Buffer.concat([padded, Buffer.alloc((4 - (padded.length % 4)) % 4)]))).toBe(0xb1b0afba);
  });
});
