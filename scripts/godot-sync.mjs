// Syncs floor-sample-v1 art (full + half-size presets), TS-derived JSON data,
// and deterministic subsetted Nunito + Noto Sans SC fonts into `godot/`.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import subsetFont from 'subset-font';
import {
  buildGameData,
  buildI18nData,
  buildLayoutData,
  collectNunitoChars,
  collectRequiredChars,
  isCjkCodepoint,
  readTsSources,
  readTtfCodepoints,
} from './godot-data-export.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SRC_ART = join(ROOT, 'assets/generated/floor-sample-v1/build');
const GODOT_DIR = join(ROOT, 'godot');
const DATA_DIR = join(GODOT_DIR, 'data');
const FULL_ART = join(GODOT_DIR, 'art/full');
const HALF_ART = join(GODOT_DIR, 'art/half');
const FONTS_DIR = join(GODOT_DIR, 'fonts');
const FONT_CACHE = join(GODOT_DIR, '.font-cache');

const NOTO_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf';
const NOTO_OFL_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt';
const NUNITO_SRC = join(ROOT, 'node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2');
const NUNITO_LICENSE = join(ROOT, 'node_modules/@fontsource-variable/nunito/LICENSE');

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function writeJson(path, obj) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function copyIfNewer(src, dst) {
  ensureDir(dirname(dst));
  if (existsSync(dst)) {
    const s = statSync(src);
    const d = statSync(dst);
    if (d.mtimeMs >= s.mtimeMs && d.size === s.size) return false;
  }
  copyFileSync(src, dst);
  return true;
}

async function loadTsModules() {
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const [data, economy, state, clock, traffic, sim, customerCast, gameLayout, layout, decorLayers, floorsUpgrades] = await Promise.all([
      server.ssrLoadModule('/src/game/data.ts'),
      server.ssrLoadModule('/src/game/economy.ts'),
      server.ssrLoadModule('/src/game/state.ts'),
      server.ssrLoadModule('/src/game/business-clock.ts'),
      server.ssrLoadModule('/src/game/traffic.ts'),
      server.ssrLoadModule('/src/game/sim.ts'),
      server.ssrLoadModule('/src/game/customer-cast.ts'),
      server.ssrLoadModule('/src/game/layout.ts'),
      server.ssrLoadModule('/src/render/floors/floors-layout.ts'),
      server.ssrLoadModule('/src/render/floors/floors-decor-layers.ts'),
      server.ssrLoadModule('/src/render/floors/floors-upgrades.ts'),
    ]);
    return { data, economy, state, clock, traffic, sim, customerCast, gameLayout, layout, decorLayers, floorsUpgrades };
  } finally {
    await server.close();
  }
}

function syncArtFiles(equippedDecor) {
  const sheets = JSON.parse(readFileSync(join(SRC_ART, 'sheets.json'), 'utf8'));
  const decorManifest = JSON.parse(readFileSync(join(SRC_ART, 'decor/decor.json'), 'utf8'));
  const frameManifest = JSON.parse(readFileSync(join(SRC_ART, 'frame/frame.json'), 'utf8'));
  const piecesManifest = JSON.parse(readFileSync(join(SRC_ART, 'upgrades/pieces.json'), 'utf8'));
  const fxManifest = JSON.parse(readFileSync(join(SRC_ART, 'fx/fx.json'), 'utf8'));
  const itemsManifest = JSON.parse(readFileSync(join(SRC_ART, 'fx/items.json'), 'utf8'));
  const iconsManifest = JSON.parse(readFileSync(join(SRC_ART, 'icons/icons.json'), 'utf8'));

  const regularImages = new Set();
  const stripImages = new Map();

  const wantedSheets = [
    'owner',
    'barista',
    'cook-chef',
    'cook-scarf',
    'guest-beret',
    'guest-beret-moves',
    'guest-hoodie',
    'guest-hoodie-moves',
    'guest-cardigan',
    'guest-cardigan-moves',
    'guest-curls',
    'guest-curls-moves',
  ];
  for (let i = 0; i < 36; i++) {
    const id = `cast-${String(i).padStart(2, '0')}`;
    wantedSheets.push(id, `${id}-moves`);
  }
  const exportedSheets = {};
  for (const key of wantedSheets) {
    const meta = sheets[key];
    if (!meta) throw new Error(`Missing sheet metadata for ${key}`);
    exportedSheets[key] = meta;
    stripImages.set(`${key}.webp`, { key, ...meta });
  }

  for (const name of [
    'attic',
    'sky',
    'pillar',
    'beam',
    'street',
    'soil',
    'awning',
    'door-left',
    'door-right',
    'step',
    'side-window',
    'stairs-hall',
    'stairs-rail',
  ]) {
    regularImages.add(`frame/${name}.webp`);
  }

  for (const floorKind of ['1f', '2f']) {
    const entry = decorManifest[floorKind];
    for (const p of [...entry.back, ...entry.front]) regularImages.add(p);
    for (const [slot, items] of Object.entries(entry.slots)) {
      const chosen = equippedDecor[slot];
      if (chosen && items[chosen]) regularImages.add(items[chosen]);
    }
  }

  regularImages.add('upgrades/basement-bare.webp');
  regularImages.add('upgrades/pieces.webp');
  regularImages.add('fx/fx.webp');
  regularImages.add('fx/items.webp');

  for (const file of readdirSync(join(SRC_ART, 'icons')).sort()) {
    if ((file.startsWith('item-') || file.startsWith('ing-')) && file.endsWith('.webp')) {
      regularImages.add(`icons/${file}`);
    }
  }

  let copied = 0;
  if (copyIfNewer(join(SRC_ART, 'app/icon-512.png'), join(FULL_ART, 'app-icon.png'))) copied++;
  for (const rel of [...regularImages, ...stripImages.keys()]) {
    if (copyIfNewer(join(SRC_ART, rel), join(FULL_ART, rel))) copied++;
  }
  writeJson(join(FULL_ART, 'sheets.json'), exportedSheets);
  writeJson(join(FULL_ART, 'decor/decor.json'), decorManifest);
  writeJson(join(FULL_ART, 'frame/frame.json'), frameManifest);
  writeJson(join(FULL_ART, 'upgrades/pieces.json'), piecesManifest);
  writeJson(join(FULL_ART, 'fx/fx.json'), fxManifest);
  writeJson(join(FULL_ART, 'fx/items.json'), itemsManifest);
  writeJson(join(FULL_ART, 'icons/icons.json'), iconsManifest);
  writeJson(join(FULL_ART, 'preset.json'), { preset: 'full', scale: 1.0 });

  const halfSheets = {};
  const resizeJobs = [];
  for (const [rel, meta] of stripImages.entries()) {
    const newFw = Math.max(1, Math.round(meta.frameWidth / 2));
    const newFh = Math.max(1, Math.round(meta.frameHeight / 2));
    halfSheets[meta.key] = { frameWidth: newFw, frameHeight: newFh, frames: meta.frames };
    const src = join(SRC_ART, rel);
    const dst = join(HALF_ART, rel);
    if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs) {
      resizeJobs.push({
        type: 'strip',
        src,
        dst,
        fw: meta.frameWidth,
        fh: meta.frameHeight,
        frames: meta.frames,
        newFw,
        newFh,
      });
    }
  }
  for (const rel of regularImages) {
    const src = join(SRC_ART, rel);
    const dst = join(HALF_ART, rel);
    if (!existsSync(dst) || statSync(dst).mtimeMs < statSync(src).mtimeMs) {
      resizeJobs.push({ type: 'image', src, dst });
    }
  }

  const scaleObj = (o) => {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number') out[k] = Math.round(v / 2);
      else if (Array.isArray(v)) out[k] = v.map((n) => (typeof n === 'number' ? Math.round(n / 2) : n));
      else if (v && typeof v === 'object') out[k] = scaleObj(v);
      else out[k] = v;
    }
    return out;
  };
  writeJson(join(HALF_ART, 'sheets.json'), halfSheets);
  writeJson(join(HALF_ART, 'decor/decor.json'), decorManifest);
  writeJson(join(HALF_ART, 'frame/frame.json'), scaleObj(frameManifest));
  writeJson(join(HALF_ART, 'upgrades/pieces.json'), scaleObj(piecesManifest));
  writeJson(join(HALF_ART, 'fx/fx.json'), scaleObj(fxManifest));
  writeJson(join(HALF_ART, 'fx/items.json'), scaleObj(itemsManifest));
  writeJson(join(HALF_ART, 'icons/icons.json'), iconsManifest);
  writeJson(join(HALF_ART, 'preset.json'), { preset: 'half', scale: 0.5 });

  if (resizeJobs.length > 0) {
    const pyScript = `
import json, os, sys
from PIL import Image

jobs = json.loads(sys.stdin.read())
for job in jobs:
    os.makedirs(os.path.dirname(job["dst"]), exist_ok=True)
    im = Image.open(job["src"]).convert("RGBA")
    if job["type"] == "strip":
        fw, fh, frames = job["fw"], job["fh"], job["frames"]
        nfw, nfh = job["newFw"], job["newFh"]
        out = Image.new("RGBA", (nfw * frames, nfh), (0, 0, 0, 0))
        for i in range(frames):
            cell = im.crop((i * fw, 0, (i + 1) * fw, fh))
            cell = cell.resize((nfw, nfh), Image.Resampling.LANCZOS)
            out.paste(cell, (i * nfw, 0))
        out.save(job["dst"], "WEBP", quality=92, method=4)
    else:
        nw = max(1, round(im.width / 2))
        nh = max(1, round(im.height / 2))
        out = im.resize((nw, nh), Image.Resampling.LANCZOS)
        out.save(job["dst"], "WEBP", quality=92, method=4)
print(f"Resized {len(jobs)} half-preset WebP files")
`;
    const out = execFileSync('uv', ['run', '--with', 'pillow', 'python', '-c', pyScript], {
      input: JSON.stringify(resizeJobs),
      encoding: 'utf8',
    });
    process.stdout.write(out);
  }

  console.log(
    `godot/art synced: ${regularImages.size + stripImages.size} full (${copied} updated), ${resizeJobs.length} half generated`,
  );
}

function instantiateStaticFont(ttfPath, weight) {
  // Godot 4.7's headless font importer crashes on variable-font subset TTFs;
  // instantiating a clean static weight makes both fonts smaller, crash-free,
  // and byte-for-byte deterministic (recalcTimestamp=False + fixed head timestamps).
  const py = `
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
path, wght = sys.argv[1], int(sys.argv[2])
font = TTFont(path, recalcTimestamp=False)
if "fvar" in font:
    instantiateVariableFont(font, {"wght": wght}, inplace=True)
if "head" in font:
    font["head"].created = 0
    font["head"].modified = 0
font.save(path)
`;
  execFileSync('uv', ['run', '--with', 'fonttools', 'python', '-c', py, ttfPath, String(weight)], {
    stdio: 'pipe',
  });
}

async function syncFonts(i18nData) {
  ensureDir(FONTS_DIR);
  const requiredText = collectRequiredChars(i18nData);
  const nunitoChars = collectNunitoChars(i18nData);
  const nunitoOut = join(FONTS_DIR, 'nunito-latin.ttf');
  const notoOut = join(FONTS_DIR, 'noto-sans-sc.ttf');
  const nunitoOfl = join(FONTS_DIR, 'OFL-Nunito.txt');
  const notoOfl = join(FONTS_DIR, 'OFL-NotoSansSC.txt');

  // Always keep Nunito license & deterministic subset in sync from local node_modules.
  copyFileSync(NUNITO_LICENSE, nunitoOfl);
  const nunitoSubset = await subsetFont(readFileSync(NUNITO_SRC), nunitoChars, {
    targetFormat: 'truetype',
  });
  writeFileSync(nunitoOut, nunitoSubset);
  instantiateStaticFont(nunitoOut, 600);

  // Check if existing Noto Sans SC subset already covers every required CJK & fallback character.
  let needNoto = !existsSync(notoOut) || !existsSync(notoOfl) || process.argv.includes('--fonts');
  if (!needNoto) {
    const nunitoCps = readTtfCodepoints(readFileSync(nunitoOut));
    const notoCps = readTtfCodepoints(readFileSync(notoOut));
    const have = new Set([...nunitoCps, ...notoCps]);
    for (const ch of requiredText) {
      const cp = ch.codePointAt(0);
      if (isCjkCodepoint(cp) && !notoCps.has(cp)) {
        needNoto = true;
        break;
      }
      if (!have.has(cp)) {
        needNoto = true;
        break;
      }
    }
  }

  if (needNoto) {
    ensureDir(FONT_CACHE);
    const cachedNoto = join(FONT_CACHE, 'NotoSansSC.ttf');
    if (!existsSync(cachedNoto)) {
      console.log('Downloading Noto Sans SC (OFL) to cache...');
      execFileSync('curl', ['-fsSL', NOTO_URL, '-o', cachedNoto]);
    }
    if (!existsSync(notoOfl)) {
      execFileSync('curl', ['-fsSL', NOTO_OFL_URL, '-o', notoOfl]);
    }
    const notoSubset = await subsetFont(readFileSync(cachedNoto), requiredText, {
      targetFormat: 'truetype',
    });
    writeFileSync(notoOut, notoSubset);
    instantiateStaticFont(notoOut, 500);
  }

  console.log(
    `godot/fonts synced: nunito-latin.ttf (${(statSync(nunitoOut).size / 1024).toFixed(1)} KB, ${nunitoChars.length} chars), noto-sans-sc.ttf (${(statSync(notoOut).size / 1024).toFixed(1)} KB), ${requiredText.length} required chars`,
  );
}

async function main() {
  const mods = await loadTsModules();
  const sources = readTsSources(ROOT);
  const zhRaw = JSON.parse(readFileSync(join(ROOT, 'src/locales/zh.json'), 'utf8'));
  const enRaw = JSON.parse(readFileSync(join(ROOT, 'src/locales/en.json'), 'utf8'));

  const gameData = buildGameData(mods, sources);
  const layoutData = buildLayoutData(mods, sources);
  const i18nData = buildI18nData(mods, zhRaw, enRaw);

  writeJson(join(DATA_DIR, 'game.json'), gameData);
  writeJson(join(DATA_DIR, 'layout.json'), layoutData);
  writeJson(join(DATA_DIR, 'i18n.json'), i18nData);
  console.log('godot/data/*.json exported from TS sources');

  await syncFonts(i18nData);
  syncArtFiles(gameData.starterState.equippedDecor);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
