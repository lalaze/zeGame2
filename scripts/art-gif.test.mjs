import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COZY_FURNITURE_ASSETS, COZY_FURNITURE_CATALOG } from '../src/render/cozy-furniture-assets';
import { imageSize } from './art-files.mjs';

const rows = JSON.parse(readFileSync('assets/art-masters/conversion.json', 'utf8'));
const converted = rows.filter((row) => row.status === 'gif');
const gif = (file) => file.replace(/\.png$/, '.gif');

describe('runtime art converted to GIF', () => {
  it('ships each converted file as one single-frame GIF the size of its PNG master', () => {
    expect(converted.length).toBeGreaterThan(0);
    for (const { file } of converted) {
      const shipped = readFileSync(`public/${gif(file)}`), master = readFileSync(`assets/art-masters/${file}`);
      expect(existsSync(`public/${file}`), file).toBe(false);
      expect(imageSize(shipped), file).toEqual(imageSize(master));
      // Graphic control + image separator: more than one image block would be an animation.
      expect(shipped.toString('latin1').match(/\x21\xf9\x04[\s\S]{5}\x2c/g)?.length ?? 1, file).toBe(1);
    }
  });

  it('keeps PNGs for art GIF would damage, including every member of a glass set', () => {
    for (const row of rows.filter((row) => row.status !== 'gif')) {
      expect(existsSync(`public/${row.file}`), row.file).toBe(true);
      expect(existsSync(`public/${gif(row.file)}`), row.file).toBe(false);
    }
    const status = Object.fromEntries(rows.map((row) => [row.file.replace('art/generated/', ''), row.status]));
    expect(status['cozy-world-v2/service-jars.png']).toBe('soft-alpha');
    expect(status['cozy-world-v2/display.png']).toBe('soft-alpha');
    expect(status['cozy-idle-v1/till-jar-1.png']).toBe('glass-set');
    expect(status['cozy-signature-v2/cup-coffee.png']).toBe('glass-set');
    expect(status['cozy-team-v7/hair-0-short-v1.png']).toBe('recolour-pipeline');
  });

  it('leaves nothing pointing at a PNG that moved', () => {
    const moved = converted.map((row) => row.file.replace('art/generated/', ''));
    const sources = ['assets/generated/runtime-catalog-v1/runtime.json', 'src/render/cozy-world-assets.ts', 'src/render/cozy-menu-assets.ts',
      'src/render/cozy-furniture-assets.ts', 'src/render/cozy-service-assets.ts', 'src/render/cozy-signature-registration.ts', 'src/render/generated-main-art.ts']
      .map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(moved.filter((file) => sources.includes(`/${file}`) || sources.includes(`"${file}"`) || sources.includes(`'${file}'`))).toEqual([]);
    for (const [pack, list] of [['cozy-cast-v8', 'characters'], ['cozy-dining-v4', 'characters'], ['cozy-cats-v2', 'breeds']]) {
      const manifest = JSON.parse(readFileSync(`public/art/generated/${pack}/manifest.json`, 'utf8'));
      for (const { file } of manifest[list]) expect(existsSync(`public/art/generated/${pack}/${file}`), file).toBe(true);
    }
  });

  it('ships the gingham table as furniture, at its catalogued size, and none of the retired packs', () => {
    const asset = COZY_FURNITURE_ASSETS['furniture-gingham_table'];
    expect(asset).toBe('cozy-furniture-v2/furniture-gingham_table.gif');
    expect(imageSize(readFileSync(`public/art/generated/${asset}`))).toEqual(COZY_FURNITURE_CATALOG.gingham_table.size);
    for (const pack of ['cozy-cast-v4', 'cozy-cast-v6', 'cozy-owner-v5', 'cozy-owner-v6', 'reference-characters-v1', 'cafe-attendant-v1', 'cozy-dining-set-v2', 'cozy-dining-table-v1']) {
      expect(existsSync(`public/art/generated/${pack}`), pack).toBe(false);
    }
  });
});
