// Keeps assets/generated/PACKS.json, the table of what ships under public/art and what rebuilds
// it, in step with the repo: every pack and source folder is listed, and loadedBy is true.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const table = JSON.parse(readFileSync('assets/generated/PACKS.json', 'utf8'));
const entries = Object.entries(table.shipped);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const code = walk('src').filter((file) => /\.(ts|css|json)$/.test(file) && !/\.test\./.test(file))
  .map((file) => [file, readFileSync(file, 'utf8')]);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A pack folder is named as a path segment (`cozy-menu-v2/…`), a file by its whole name. */
const mentions = (pack) => {
  const name = path.posix.basename(pack);
  return new RegExp(`(^|[^A-Za-z0-9-])${escape(name)}${statSync(`public/${pack}`).isDirectory() ? '(/|[\'"`])' : '([^A-Za-z0-9-]|$)'}`);
};

describe('assets/generated/PACKS.json', () => {
  it('lists every pack under public/art, and nothing else', () => {
    const onDisk = [...readdirSync('public/art/generated').map((name) => `art/generated/${name}`),
      ...readdirSync('public/art').filter((name) => name !== 'generated' && !name.startsWith('.')).map((name) => `art/${name}`)];
    expect(entries.map(([pack]) => pack).sort()).toEqual(onDisk.sort());
  });

  it('gives every pack a known status and the commands that status implies', () => {
    for (const [pack, row] of entries) {
      expect(Object.keys(table.statuses), pack).toContain(row.status);
      if (['regenerate', 'rebuild', 'broken'].includes(row.status)) expect(row.build?.length, `${pack} needs build`).toBeGreaterThan(0);
      if (row.status === 'regenerate') expect(row.generate, `${pack} needs generate`).toBeTruthy();
      for (const command of [row.generate, ...(row.build ?? []), ...(row.check ?? [])].filter(Boolean)) {
        const script = command.split(' ').find((word) => /\.(mjs|cjs|py)$/.test(word));
        if (script) expect(existsSync(script), `${pack}: ${script}`).toBe(true);
      }
    }
  });

  it('names source folders that exist, and accounts for every folder in assets/generated', () => {
    const sources = new Set(entries.flatMap(([, row]) => row.sources));
    for (const folder of [...sources, ...Object.keys(table.otherFolders)]) expect(existsSync(folder), folder).toBe(true);
    const folders = readdirSync('assets/generated', { withFileTypes: true }).filter((entry) => entry.isDirectory())
      .map((entry) => `assets/generated/${entry.name}`);
    expect(folders.filter((folder) => !sources.has(folder) && !(folder in table.otherFolders))).toEqual([]);
  });

  it('says which source files load each pack', () => {
    for (const [pack, row] of entries) {
      const pattern = mentions(pack);
      for (const file of row.loadedBy) {
        expect(existsSync(file), `${pack}: ${file}`).toBe(true);
        expect(pattern.test(readFileSync(file, 'utf8')), `${file} no longer loads ${pack}`).toBe(true);
      }
      if (row.status === 'unused') expect(code.filter(([, text]) => pattern.test(text)).map(([file]) => file), `${pack} is loaded`).toEqual([]);
      else if (row.status !== 'preview') expect(row.loadedBy.length, `${pack} has a status that needs a loader`).toBeGreaterThan(0);
    }
  });
});
