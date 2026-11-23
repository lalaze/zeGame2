// The GIF reduction in scripts/art-quantise.mjs must keep reproducing what ships: if a sharp or
// libimagequant update changes its output, rebuilding a quantised pack would quietly change the art.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SHARP = '/Users/lalaze/.nvm/versions/node/v22.23.2/lib/node_modules/sharp/lib/index.js';
const hasSharp = existsSync(SHARP);
const rows = JSON.parse(readFileSync('assets/art-masters/webp.json', 'utf8'));
const decisions = JSON.parse(readFileSync('assets/art-masters/conversion.json', 'utf8'));
const packOf = (file) => file.split('/').slice(0, 3).join('/');

describe.skipIf(!hasSharp)('GIF reduction of quantised packs', async () => {
  const { default: sharp } = await import(SHARP);
  const { QUANTISED_PACKS, inQuantisedPack, reduce, reducesNewFile } = await import('./art-quantise.mjs');
  const rgba = async (file) => {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
    return { data, width: info.width, height: info.height };
  };
  const shipped = (file) => rgba(`public/${file.replace(/\.png$/, '.webp')}`);
  const master = (file) => rgba(`assets/art-masters/${file}`);

  it('lists the packs whose masters are originals, as PACKS.json does', () => {
    const table = JSON.parse(readFileSync('assets/generated/PACKS.json', 'utf8'));
    expect([...QUANTISED_PACKS].sort()).toEqual(Object.keys(table.shipped).filter((pack) => table.shipped[pack].mastersDiffer).sort());
    expect(rows.filter((row) => row.quantised && !inQuantisedPack(row.file)).map((row) => row.file)).toEqual([]);
    for (const pack of QUANTISED_PACKS) expect(rows.some((row) => row.quantised && packOf(row.file) === pack), pack).toBe(true);
  });

  it('turns a master of every quantised pack into exactly the pixels that ship', async () => {
    for (const pack of QUANTISED_PACKS) {
      // The pack's largest file: it uses the whole palette, so any change in the quantiser shows.
      const { file } = rows.filter((row) => row.quantised && packOf(row.file) === pack).reduce((a, b) => (b.webp > a.webp ? b : a));
      const [reduced, expected] = await Promise.all([master(file).then(reduce), shipped(file)]);
      expect(reduced.data.equals(expected.data), file).toBe(true);
    }
  });

  it('ships the files of those packs that stayed full colour as their masters', async () => {
    for (const { file } of rows.filter((row) => inQuantisedPack(row.file) && !row.quantised)) {
      const [own, expected] = await Promise.all([master(file), shipped(file)]);
      expect(own.data.equals(expected.data), file).toBe(true);
    }
  });

  it('decides like the GIF step for a file new to a quantised pack', async () => {
    const sample = decisions.filter((row) => inQuantisedPack(row.file) && rows.some((shippedRow) => shippedRow.file === row.file));
    const checked = [...sample.filter((row) => row.status !== 'gif'),
      ...QUANTISED_PACKS.map((pack) => sample.find((row) => row.status === 'gif' && packOf(row.file) === pack))];
    for (const row of checked) {
      // The GIF step also kept files that would barely shrink; that was about bytes, so new ones are reduced.
      const expected = row.status === 'gif' || row.status === 'no-saving';
      expect(reducesNewFile(row.file, await master(row.file)), `${row.file} (${row.status})`).toBe(expected);
    }
  });
});
