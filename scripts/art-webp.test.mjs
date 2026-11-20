import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COZY_FURNITURE_ASSETS, COZY_FURNITURE_CATALOG } from '../src/render/cozy-furniture-assets';
import { imageSize } from './art-files.mjs';

const rows = JSON.parse(readFileSync('assets/art-masters/webp.json', 'utf8'));
const webp = (file) => file.replace(/\.png$/, '.webp');
const runtimeArt = JSON.parse(readFileSync('scripts/runtime-art.json', 'utf8'));

describe('runtime art shipped as lossless WebP', () => {
  it('ships every opening and on-demand file as one lossless WebP the size of its PNG master', () => {
    const lazy = readdirSync('public/art/generated/cozy-team-v9').filter((name) => name.endsWith('.webp'))
      .map((name) => `art/generated/cozy-team-v9/${name.replace(/\.webp$/, '.png')}`);
    expect(new Set(rows.map((row) => row.file))).toEqual(new Set([...runtimeArt, ...lazy]));
    for (const { file } of rows) {
      const shipped = readFileSync(`public/${webp(file)}`), master = readFileSync(`assets/art-masters/${file}`);
      for (const ext of ['.png', '.gif']) expect(existsSync(`public/${file.replace(/\.png$/, ext)}`), file + ext).toBe(false);
      // VP8L is the lossless bitstream; an animation would start with VP8X and carry ANIM.
      expect(shipped.toString('latin1', 12, 16), file).toBe('VP8L');
      expect(imageSize(shipped), file).toEqual(imageSize(master));
    }
  });

  it('leaves nothing pointing at a GIF or PNG that became WebP', () => {
    const moved = rows.flatMap((row) => [row.file.replace(/\.png$/, `.${row.from}`).replace('art/generated/', '').replace(/^art\//, '')]);
    const sources = ['assets/generated/runtime-catalog-v1/runtime.json', 'src/render/cozy-world-assets.ts', 'src/render/cozy-menu-assets.ts',
      'src/render/cozy-furniture-assets.ts', 'src/render/cozy-service-assets.ts', 'src/render/cozy-signature-registration.ts', 'src/render/generated-main-art.ts',
      'src/render/street-art.ts', 'src/ui/streets.css']
      .map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(moved.filter((file) => sources.includes(`/${file}`) || sources.includes(`"${file}"`) || sources.includes(`'${file}'`))).toEqual([]);
    for (const [pack, list] of [['cozy-cast-v9', 'characters'], ['cozy-dining-v5', 'characters'], ['cozy-cats-v2', 'breeds']]) {
      const manifest = JSON.parse(readFileSync(`public/art/generated/${pack}/manifest.json`, 'utf8'));
      for (const { file, cycle } of manifest[list]) for (const name of [file, cycle?.file].filter(Boolean)) {
        expect(name, name).toMatch(/\.webp$/);
        expect(existsSync(`public/art/generated/${pack}/${name}`), name).toBe(true);
      }
    }
    const team = JSON.parse(readFileSync('public/art/generated/cozy-team-v9/manifest.json', 'utf8'));
    const teamFiles = JSON.stringify(team).match(/"[^"]+\.(png|gif|webp)"/g).map((name) => JSON.parse(name));
    expect(teamFiles.length).toBeGreaterThan(30);
    for (const name of teamFiles) expect(existsSync(`public/art/generated/cozy-team-v9/${name}`), name).toBe(true);
  });

  it('ships the gingham table as furniture, at its catalogued size, and none of the retired packs', () => {
    const asset = COZY_FURNITURE_ASSETS['furniture-gingham_table'];
    expect(asset).toBe('cozy-furniture-v2/furniture-gingham_table.webp');
    expect(imageSize(readFileSync(`public/art/generated/${asset}`))).toEqual(COZY_FURNITURE_CATALOG.gingham_table.size);
    for (const pack of ['cozy-cast-v4', 'cozy-cast-v6', 'cozy-owner-v5', 'cozy-owner-v6', 'reference-characters-v1', 'cafe-attendant-v1', 'cozy-dining-set-v2', 'cozy-dining-table-v1']) {
      expect(existsSync(`public/art/generated/${pack}`), pack).toBe(false);
    }
  });
});
