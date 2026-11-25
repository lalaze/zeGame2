// Syncs the building's art (full and half size), the rules' data and the words from TypeScript,
// and deterministic subsets of Nunito and Noto Sans SC into `godot/`.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import subsetFont from 'subset-font';
import { collectNunitoChars, collectRequiredChars, isCjkCodepoint, readTtfCodepoints } from './godot-fonts.mjs';
import { exportRulesJson } from './godot-rules-export.mjs';

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

/** What only the screens show (the street, the branch map, the lists' thumbnails): full size only. */
const SCREENS = ['street/', 'map/', 'thumbs/'];

/** The app's icons: in the game, on the phone's home screen, and what Android cuts to its own shape. */
const APP_ICONS = [['icon-512.png', 'app-icon.png'], ['icon-192.png', 'app-icon-192.png'], ['icon-maskable-512.png', 'app-icon-maskable.png']];

/** The picture while the app starts, as PNG: the engine shows it before it can read WebP. */
function syncLoadingPicture() {
  const from = join(SRC_ART, 'app/loading.webp'), to = join(FULL_ART, 'app-loading.png');
  if (existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) return;
  execFileSync('uv', ['run', '--with', 'pillow', 'python', '-c', 'import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert("RGBA").save(sys.argv[2], "PNG")', from, to]);
}

/** Every picture under build/ the game draws, full size and half size, and every manifest (always in full-size pixels). */
function syncArtFiles() {
  const listed = readdirSync(SRC_ART, { recursive: true }).map((f) => String(f).replaceAll('\\', '/')).sort();
  const pictures = listed.filter((f) => f.endsWith('.webp')), manifests = listed.filter((f) => f.endsWith('.json'));
  const json = (f) => JSON.parse(readFileSync(join(SRC_ART, f), 'utf8'));
  const sheets = json('sheets.json'), staff = json('staff/staff.json'), cats = json('cats/cats.json');
  /** The cells of a strip, and how many rows of them (a mask has two). */
  const cells = (f) => {
    const key = f.slice(0, -5), style = staff.styles[key.replace(/^staff\/|-mask$/g, '')] ?? staff.cooks[key.replace(/^staff\/|-mask$/g, '')];
    if (key.startsWith('staff/') && style) return { ...style, rows: key.endsWith('-mask') ? 2 : 1 };
    if (key.startsWith('cats/') && cats.cats[key.slice(5)]) return { ...cats.cats[key.slice(5)], frames: cats.frames.length, rows: 1 };
    return sheets[key] ? { ...sheets[key], rows: 1 } : null;
  };
  let copied = 0;
  for (const [from, to] of APP_ICONS) if (copyIfNewer(join(SRC_ART, 'app', from), join(FULL_ART, to))) copied++;
  syncLoadingPicture();
  for (const f of pictures) if (copyIfNewer(join(SRC_ART, f), join(FULL_ART, f))) copied++;
  for (const f of manifests) copyIfNewer(join(SRC_ART, f), join(GODOT_DIR, 'art/data', f));
  const jobs = pictures.flatMap((f) => {
    if (SCREENS.some((x) => f.startsWith(x))) return [];
    const src = join(SRC_ART, f), dst = join(HALF_ART, f), strip = cells(f);
    if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) return [];
    return [{ src, dst, strip: strip && { fw: strip.frameWidth, fh: strip.frameHeight, frames: strip.frames, rows: strip.rows } }];
  });
  if (jobs.length > 0) {
    const script = `
import json, os, sys
from PIL import Image

for job in json.loads(sys.stdin.read()):
    os.makedirs(os.path.dirname(job["dst"]), exist_ok=True)
    im = Image.open(job["src"]).convert("RGBA")
    strip = job["strip"]
    if strip:
        fw, fh = strip["fw"], strip["fh"]
        # As floor(x + 0.5), the way Godot rounds the cells.
        nw, nh = max(1, (fw + 1) // 2), max(1, (fh + 1) // 2)
        out = Image.new("RGBA", (nw * strip["frames"], nh * strip["rows"]), (0, 0, 0, 0))
        for row in range(strip["rows"]):
            for i in range(strip["frames"]):
                cell = im.crop((i * fw, row * fh, (i + 1) * fw, (row + 1) * fh))
                out.paste(cell.resize((nw, nh), Image.Resampling.LANCZOS), (i * nw, row * nh))
    else:
        out = im.resize((max(1, round(im.width / 2)), max(1, round(im.height / 2))), Image.Resampling.LANCZOS)
    out.save(job["dst"], "WEBP", quality=92, method=4)
`;
    execFileSync('uv', ['run', '--with', 'pillow', 'python', '-c', script], { input: JSON.stringify(jobs), encoding: 'utf8' });
  }
  console.log(`godot/art synced: ${pictures.length} pictures (${copied} updated), ${jobs.length} halved, ${manifests.length} manifests`);
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

async function syncFonts() {
  ensureDir(FONTS_DIR);
  const requiredText = collectRequiredChars(GODOT_DIR);
  const nunitoChars = collectNunitoChars(requiredText);
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
  await exportRulesJson(ROOT);
  console.log('godot/data/rules.json exported from TS sources');
  for (const locale of ['zh', 'en']) copyFileSync(join(ROOT, `src/locales/${locale}.json`), join(DATA_DIR, `locale-${locale}.json`));
  await syncFonts();
  syncArtFiles();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
