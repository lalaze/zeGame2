// The bundled fonts have every letter the Godot project shows: Latin in Nunito, Chinese in Noto Sans SC.
// Does not need the Godot binary.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { collectRequiredChars, isCjkCodepoint, isLatinCodepoint, readTtfCodepoints } from './godot-fonts.mjs';

const GODOT = resolve(import.meta.dirname, '../godot');

it('has Latin in Nunito (including é), Chinese in Noto, and every letter of the project', () => {
  for (const licence of ['OFL-Nunito.txt', 'OFL-NotoSansSC.txt']) expect(existsSync(join(GODOT, 'fonts', licence))).toBe(true);
  const nunito = readTtfCodepoints(readFileSync(join(GODOT, 'fonts/nunito-latin.ttf'))), noto = readTtfCodepoints(readFileSync(join(GODOT, 'fonts/noto-sans-sc.ttf')));
  expect(nunito.has('é'.codePointAt(0)!)).toBe(true);
  const required = [...collectRequiredChars(GODOT)];
  expect(required.length).toBeGreaterThan(1500);
  const missing = required.filter((ch) => {
    const cp = ch.codePointAt(0)!;
    return isLatinCodepoint(cp) ? !nunito.has(cp) : isCjkCodepoint(cp) ? !noto.has(cp) : !nunito.has(cp) && !noto.has(cp);
  });
  expect(missing).toEqual([]);
});

it('has the words of the page', () => {
  for (const locale of ['zh', 'en']) expect(readFileSync(join(GODOT, `data/locale-${locale}.json`), 'utf8')).toBe(readFileSync(resolve(GODOT, `../src/locales/${locale}.json`), 'utf8'));
});
