// Verifies `godot/data/*.json` matches TS source modules (zero drift, zero hand-copied constants)
// and that Latin chars live in Nunito, CJK chars live in Noto Sans SC, and no GDScript string literal
// introduces a character outside the bundled font subsets.
// Does NOT require the Godot binary.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as data from '../src/game/data';
import * as economy from '../src/game/economy';
import * as state from '../src/game/state';
import * as clock from '../src/game/business-clock';
import * as traffic from '../src/game/traffic';
import * as sim from '../src/game/sim';
import * as customerCast from '../src/game/customer-cast';
import * as gameLayout from '../src/game/layout';
import * as layout from '../src/render/floors/floors-layout';
import * as decorLayers from '../src/render/floors/floors-decor-layers';
import * as floorsUpgrades from '../src/render/floors/floors-upgrades';
import {
  buildGameData,
  buildI18nData,
  buildLayoutData,
  collectGdScriptChars,
  collectRequiredChars,
  isCjkCodepoint,
  isLatinCodepoint,
  readTsSources,
  readTtfCodepoints,
} from './godot-data-export.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const GODOT_DATA = join(ROOT, 'godot/data');
const GODOT_FONTS = join(ROOT, 'godot/fonts');
const GODOT_SCRIPTS = join(ROOT, 'godot/scripts');

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('Godot B0 exported data and font subsets', () => {
  const mods = { data, economy, state, clock, traffic, sim, customerCast, gameLayout, layout, decorLayers, floorsUpgrades };
  const sources = readTsSources(ROOT);
  const zhRaw = readJson(join(ROOT, 'src/locales/zh.json'));
  const enRaw = readJson(join(ROOT, 'src/locales/en.json'));

  it('godot/data/game.json matches TS game data and extracted sim/economy/traffic constants with zero drift', () => {
    const exported = readJson(join(GODOT_DATA, 'game.json'));
    const expected = buildGameData(mods, sources);
    expect(exported).toEqual(expected);
  });

  it('godot/data/layout.json matches floors-layout.ts, floors-upgrades.ts, and floors-scene.ts with zero drift', () => {
    const exported = readJson(join(GODOT_DATA, 'layout.json'));
    const expected = buildLayoutData(mods, sources);
    expect(exported).toEqual(expected);
  });

  it('godot/data/i18n.json matches zh.json and en.json with zero drift', () => {
    const exported = readJson(join(GODOT_DATA, 'i18n.json'));
    const expected = buildI18nData(mods, zhRaw, enRaw);
    expect(exported).toEqual(expected);
  });

  it('bundled OFL fonts cover Latin in Nunito (including é), CJK in Noto, and all GDScript literals', () => {
    const nunitoPath = join(GODOT_FONTS, 'nunito-latin.ttf');
    const notoPath = join(GODOT_FONTS, 'noto-sans-sc.ttf');
    expect(existsSync(nunitoPath)).toBe(true);
    expect(existsSync(notoPath)).toBe(true);
    expect(existsSync(join(GODOT_FONTS, 'OFL-Nunito.txt'))).toBe(true);
    expect(existsSync(join(GODOT_FONTS, 'OFL-NotoSansSC.txt'))).toBe(true);

    const nunitoCps = readTtfCodepoints(readFileSync(nunitoPath));
    const notoCps = readTtfCodepoints(readFileSync(notoPath));
    const combined = new Set([...nunitoCps, ...notoCps]);

    // Explicitly verify é (U+00E9) is in Nunito (must not fall back to Noto).
    expect(nunitoCps.has('é'.codePointAt(0)!)).toBe(true);

    const i18n = readJson(join(GODOT_DATA, 'i18n.json'));
    const required = new Set([
      ...collectRequiredChars(i18n),
      ...collectGdScriptChars(GODOT_SCRIPTS),
    ]);

    const missingLatinInNunito: string[] = [];
    const missingCjkInNoto: string[] = [];
    const missingOther: string[] = [];

    for (const ch of required) {
      const cp = ch.codePointAt(0)!;
      if (isLatinCodepoint(cp)) {
        if (!nunitoCps.has(cp)) missingLatinInNunito.push(ch);
      } else if (isCjkCodepoint(cp)) {
        if (!notoCps.has(cp)) missingCjkInNoto.push(ch);
      } else if (!combined.has(cp)) {
        missingOther.push(ch);
      }
    }

    expect(missingLatinInNunito).toEqual([]);
    expect(missingCjkInNoto).toEqual([]);
    expect(missingOther).toEqual([]);
  });
});
