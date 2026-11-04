#!/usr/bin/env node
/** Native pixel reserve packs: no game imports, registration, network or dependencies.
 * node scripts/build-reserve-library.mjs --pack=workshop
 * node scripts/build-reserve-library.mjs --all [--check]
 * node scripts/build-reserve-library.mjs --gallery
 * Sources are preflighted in memory before any output writes. Existing generated
 * outputs are protected by SHA-256 ownership records; hand-edited art is not lost.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { encodePng, decodePng } from './pixel-conform.mjs';
import { createPainter } from './build-seasonal-reserve-art.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets/generated');
const GENERATOR = 'scripts/build-reserve-library.mjs';
const SIZE = 96, COLUMNS = 12, CELL_W = 112, CELL_H = 116;
const palette = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/art-grid/palette.json'), 'utf8'));
const allowed = new Set(palette.colors.filter(c => !c.ramp.startsWith('team-')).map(c => parseInt(c.hex.slice(1), 16)));
export const SOURCES = {
  workshop: 'reserve-workshop-art.mjs', neighborhood: 'reserve-neighborhood-art.mjs',
  hobby: 'reserve-hobby-art.mjs', travel: 'reserve-travel-art.mjs',
};
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const json = data => JSON.stringify(data, null, 2) + '\n';
const assert = (ok, why) => { if (!ok) throw Error(why); };
const empty = (width, height) => ({ width, height, pixels: new Uint8ClampedArray(width * height * 4) });

export function safeArtifact(directory, relative) {
  assert(typeof relative === 'string' && relative.length > 0 && !relative.includes('\\') && !path.isAbsolute(relative) && !relative.split('/').some(p => p === '..' || p === '.' || !p), `Unsafe artifact path: ${relative}`);
  const absolute = path.resolve(directory, relative);
  assert(absolute.startsWith(path.resolve(directory) + path.sep), `Artifact escaped pack: ${relative}`);
  // Reject existing symlinks in the entire path, including pack root.
  for (let current = absolute; current !== ROOT && current !== path.dirname(current); current = path.dirname(current)) {
    if (fs.existsSync(current)) assert(!fs.lstatSync(current).isSymbolicLink(), `Symlink artifact path: ${current}`);
  }
  return absolute;
}
function packDirectory(id) {
  assert(/^[a-z]+-reserve-v1$/.test(id), `Invalid pack ID: ${id}`);
  return safeArtifact(ASSETS, id);
}
function blit(source, target, x0, y0, transparent = false) {
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const a = (y * source.width + x) * 4;
    if (transparent && !source.pixels[a + 3]) continue;
    const b = ((y + y0) * target.width + x + x0) * 4;
    target.pixels.set(source.pixels.subarray(a, a + 4), b);
  }
}
export function auditPixels(image, id, sprite = true) {
  assert(image.width > 0 && image.height > 0 && image.pixels.length === image.width * image.height * 4, `${id}: malformed image buffer`);
  if (sprite) assert(image.width === SIZE && image.height === SIZE, `${id}: must be native 96×96`);
  let minX = image.width, minY = image.height, maxX = -1, maxY = -1, opaque = 0;
  const colors = new Set();
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = (y * image.width + x) * 4;
    const rgb = image.pixels[i] * 65536 + image.pixels[i + 1] * 256 + image.pixels[i + 2], a = image.pixels[i + 3];
    if (!a) { assert(rgb === 0, `${id}: dirty transparent RGB at ${x},${y}`); continue; }
    assert(a === 255, `${id}: partial alpha at ${x},${y}`);
    assert(allowed.has(rgb), `${id}: off-palette #${rgb.toString(16).padStart(6, '0')} at ${x},${y}`);
    opaque++; colors.add(rgb); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  assert(opaque > 0, `${id}: empty image`);
  if (sprite) {
    assert(minX >= 3 && minY >= 3 && maxX <= 92 && maxY <= 92, `${id}: less than 3 transparent pixels around image (bounds ${minX},${minY}..${maxX},${maxY})`);
    assert(maxY < 90 && maxY >= 79, `${id}: bottom ${maxY} incompatible with stable baseline 90`);
    assert(opaque >= 250 && colors.size >= 6, `${id}: unexpectedly sparse or flat image`);
  }
  return { bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, opaquePixels: opaque, colors: colors.size, pixelSha256: sha256(image.pixels) };
}
export function pureRecolor(a, b) {
  if (a.width !== b.width || a.height !== b.height) return false;
  const forward = new Map(), reverse = new Map();
  let forwardConsistent = true, reverseConsistent = true;
  for (let i = 0; i < a.pixels.length; i += 4) {
    if (a.pixels[i + 3] !== b.pixels[i + 3]) return false;
    if (!a.pixels[i + 3]) continue;
    const ca = a.pixels[i] * 65536 + a.pixels[i + 1] * 256 + a.pixels[i + 2];
    const cb = b.pixels[i] * 65536 + b.pixels[i + 1] * 256 + b.pixels[i + 2];
    if (forward.has(ca) && forward.get(ca) !== cb) forwardConsistent = false;
    if (reverse.has(cb) && reverse.get(cb) !== ca) reverseConsistent = false;
    forward.set(ca, cb); reverse.set(cb, ca);
  }
  return forwardConsistent || reverseConsistent;
}
function silhouette(image) {
  return sha256(Uint8Array.from(image.pixels.filter((_, i) => i % 4 === 3)));
}
async function sourceFor(key) {
  assert(Object.hasOwn(SOURCES, key), `Unknown pack '${key}'`);
  const source = await import(new URL(SOURCES[key], import.meta.url));
  validateDefinition(source.PACK);
  assert(source.PACK.id === `${key}-reserve-v1`, `Source/pack ID mismatch: ${key}`);
  assert(typeof source.paintSprite === 'function', `No painter for ${key}`);
  return source;
}
export function validateDefinition(pack) {
  assert(pack && typeof pack.titleZh === 'string' && typeof pack.titleEn === 'string', 'Missing pack titles');
  assert(pack.catalog?.length === 48 && pack.variants?.length === 4 && pack.categories?.length === 6, `${pack.id}: expected 48 bases, 4 variants, 6 categories`);
  for (const field of ['catalog', 'variants']) {
    const ids = new Set();
    for (const entry of pack[field]) {
      assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) && !ids.has(entry.id), `${pack.id}: invalid/duplicate ${field} ID ${entry.id}`);
      assert(typeof entry.nameZh === 'string' && /[\u3400-\u9fff]/.test(entry.nameZh) && typeof entry.nameEn === 'string' && entry.nameEn.length > 1, `${entry.id}: missing bilingual name`);
      ids.add(entry.id);
    }
  }
  assert(new Set(pack.categories.map(c => c.id)).size === 6, `${pack.id}: duplicate categories`);
  for (const category of pack.categories) {
    assert(typeof category.id === 'string' && typeof category.nameZh === 'string' && typeof category.nameEn === 'string' && pack.catalog.filter(b => b.category === category.id).length === 8, `${pack.id}: category ${category.id} must contain 8 bases`);
  }
}
function drawPack(source) {
  const { PACK: pack, paintSprite } = source, images = [], sprites = [], records = [], hashes = new Map(), silhouettes = new Set();
  let variantPairs = 0;
  for (const base of pack.catalog) {
    const variants = [];
    for (const [v, variant] of pack.variants.entries()) {
      const id = `${base.id}-${variant.id}`, image = paintSprite(palette, base, v), audit = auditPixels(image, id);
      assert(!hashes.has(audit.pixelSha256), `${id}: duplicate PNG of ${hashes.get(audit.pixelSha256)}`);
      hashes.set(audit.pixelSha256, id); variants.push(image);
      const i = images.length;
      sprites.push({ id, nameZh: `${variant.nameZh}·${base.nameZh}`, nameEn: `${variant.nameEn} ${base.nameEn}`, category: base.category, season: variant.id, variant: variant.id, baseShape: base.id, tags: ['reserve', 'native-2x', pack.id, base.category, variant.id, ...(base.tags ?? [])], path: `sprites/${id}.png`, width: SIZE, height: SIZE, logicalWidth: 48, logicalHeight: 48, density: 2, anchor: { x: .5, y: 90 / SIZE }, atlas: { x: i % COLUMNS * SIZE, y: Math.floor(i / COLUMNS) * SIZE, width: SIZE, height: SIZE }, pixelSha256: audit.pixelSha256 });
      records.push({ id, ...audit }); images.push(image);
    }
    silhouettes.add(silhouette(variants[0]));
    for (let a = 0; a < variants.length; a++) for (let b = a + 1; b < variants.length; b++) {
      assert(!pureRecolor(variants[a], variants[b]), `${base.id}: ${pack.variants[a].id}/${pack.variants[b].id} only differ by recoloring`); variantPairs++;
    }
  }
  assert(silhouettes.size === 48, `${pack.id}: only ${silhouettes.size} different base silhouettes`);
  const rows = Math.ceil(images.length / COLUMNS), atlas = empty(COLUMNS * SIZE, rows * SIZE);
  images.forEach((image, i) => blit(image, atlas, i % COLUMNS * SIZE, Math.floor(i / COLUMNS) * SIZE));
  const contact = contactSheet(images);
  auditPixels(atlas, `${pack.id}/atlas`, false); auditPixels(contact, `${pack.id}/contact`, false);
  const manifest = { schemaVersion: 1, packId: pack.id, titleZh: pack.titleZh, titleEn: pack.titleEn, status: 'reserve', integrated: false, generator: GENERATOR, source: `scripts/${SOURCES[pack.id.replace('-reserve-v1', '')]}`, provenance: 'Original programmatically drawn pixel artwork; no external art or model-generated images.', density: 2, alpha: 'binary', palette: { source: 'docs/art-grid/palette.json' }, anchorConvention: 'Normalized coordinates; common baseline at art pixel (48,90). Canvas is a catalog frame, not a production placement contract.', counts: { sprites: sprites.length, baseShapes: pack.catalog.length, variantsPerBase: 4, categories: 6 }, categories: pack.categories.map(c => c.id), categoryLabels: pack.categories, seasons: pack.variants.map(v => v.id), variants: pack.variants, baseShapes: pack.catalog, atlas: { path: 'atlas.png', width: atlas.width, height: atlas.height, columns: COLUMNS, rows, cellWidth: SIZE, cellHeight: SIZE }, contactSheet: { path: 'contact-sheet.png', width: contact.width, height: contact.height, columns: COLUMNS, cellWidth: CELL_W, cellHeight: CELL_H, labels: '1-based manifest sprite ordinal; opaque inspection background' }, sprites };
  return { manifest, images, atlas, contact, records, variantPairs };
}
function contactSheet(images) {
  const sheet = createPainter(palette, COLUMNS * CELL_W, Math.ceil(images.length / COLUMNS) * CELL_H), { color: C, rect: R } = sheet;
  R(0, 0, sheet.width, sheet.height, C('porcelain', 2));
  const digits = ['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
  images.forEach((image, i) => {
    const x = i % COLUMNS * CELL_W, y = Math.floor(i / COLUMNS) * CELL_H;
    R(x + 3, y + 3, 106, 110, C('porcelain', 3));
    for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 12; xx++) if ((xx + yy) % 2 === 0) R(x + 8 + xx * 8, y + 5 + yy * 8, 8, 8, C('cloth-7', 2));
    blit(image, sheet, x + 8, y + 5, true);
    [...String(i + 1).padStart(3, '0')].forEach((d, k) => [...digits[+d]].forEach((v, j) => { if (v === '1') R(x + 44 + k * 8 + j % 3 * 2, y + 103 + Math.floor(j / 3) * 2, 2, 2, C('walnut', 0)); }));
  });
  return sheet;
}
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function ownedPaths(manifest) { return ['manifest.json', 'catalog.js', 'atlas.png', 'contact-sheet.png', 'verification-report.json', 'README.md', ...manifest.sprites.map(s => s.path)]; }
function protectExisting(out, manifest) {
  const indexFile = safeArtifact(out, 'generated-file-index.json'), wanted = ownedPaths(manifest);
  if (!fs.existsSync(indexFile)) {
    for (const relative of wanted) assert(!fs.existsSync(safeArtifact(out, relative)), `Refusing to overwrite unowned ${manifest.packId}/${relative}`);
    return;
  }
  const previous = readJson(indexFile);
  assert(previous.generator === GENERATOR && previous.packId === manifest.packId, 'Unrecognized ownership index');
  const previousPaths = new Set();
  for (const item of previous.files) {
    const file = safeArtifact(out, item.path); previousPaths.add(item.path);
    assert(fs.existsSync(file) && sha256(fs.readFileSync(file)) === item.sha256, `Changed/missing generated file ${manifest.packId}/${item.path}; preserve or restore before rebuilding`);
  }
  for (const relative of wanted) if (fs.existsSync(safeArtifact(out, relative))) assert(previousPaths.has(relative), `Unowned generated path ${relative}`);
}
function saveIndex(out, manifest) {
  const files = ownedPaths(manifest).filter(relative => fs.existsSync(safeArtifact(out, relative))).map(relative => {
    const bytes = fs.readFileSync(safeArtifact(out, relative)); return { path: relative, bytes: bytes.length, sha256: sha256(bytes) };
  });
  fs.writeFileSync(safeArtifact(out, 'generated-file-index.json'), json({ schemaVersion: 1, packId: manifest.packId, generator: GENERATOR, files }));
}
const catalogText = manifest => `// Generated offline reserve metadata.\nwindow.RESERVE_PACKS = window.RESERVE_PACKS || {};\nwindow.RESERVE_PACKS[${JSON.stringify(manifest.packId)}] = ${JSON.stringify(manifest)};\n`;
function packReadme(m) {
  const key = m.packId.replace('-reserve-v1', '');
  return `# ${m.titleZh} · ${m.titleEn}\n\n**备用素材，不是已经接入游戏的内容。** 共 ${m.counts.baseShapes} 种基础造型 × 4 个结构/内容变体 = ${m.counts.sprites} 张透明 PNG；不能称为 ${m.counts.sprites} 种独立基础设计。\n\n- [统一筛选画廊](../reserve-library/index.html?pack=${m.packId})\n- [总览图](contact-sheet.png) · [透明图集](atlas.png) · [清单](manifest.json) · [校验报告](verification-report.json)\n- 原创程序化像素绘制，非外部素材下载或生图模型输出。遵循[主色板](../../../docs/art-grid/palette.json)，96×96 原生美术像素、density 2、二值透明度，锚点 (48,90)。\n- 96×96 是统一目录画布，不代表所有物体在场景里同样大。正式使用前需根据人物、桌面或建筑比例重新适配并校准遮挡；大件家具的透视和材质仍需场景内复核。\n- 本目录不在 public，不影响游戏启动、存档、数值或离线缓存。\n\n## 重建\n\n\`\`\`sh\nnode scripts/build-reserve-library.mjs --pack=${key}\nnode scripts/build-reserve-library.mjs --pack=${key} --check\nnode scripts/build-reserve-library.mjs --gallery\n\`\`\`\n\n修改绘制源模块后再重建。生成器会拒绝覆盖被手改的产物；请先保留自定义修改。自检验证尺寸、色板、透明边距、重复图、非纯换色变体、图集逐像素一致和确定性，但不替代人工审美验收。\n`;
}
export async function buildPack(key) {
  const source = await sourceFor(key), prepared = drawPack(source), { manifest, images, atlas, contact } = prepared;
  const out = packDirectory(manifest.packId); protectExisting(out, manifest); fs.mkdirSync(out, { recursive: true });
  images.forEach((image, i) => encodePng(safeArtifact(out, manifest.sprites[i].path), image));
  encodePng(safeArtifact(out, 'atlas.png'), atlas); encodePng(safeArtifact(out, 'contact-sheet.png'), contact);
  fs.writeFileSync(safeArtifact(out, 'manifest.json'), json(manifest)); fs.writeFileSync(safeArtifact(out, 'catalog.js'), catalogText(manifest));
  fs.writeFileSync(safeArtifact(out, 'README.md'), packReadme(manifest));
  saveIndex(out, manifest);
  const report = await checkPack(key, prepared);
  fs.writeFileSync(safeArtifact(out, 'verification-report.json'), json(report)); saveIndex(out, manifest);
  return report;
}
export async function checkPack(key, prepared) {
  const expected = prepared ?? drawPack(await sourceFor(key)), out = packDirectory(expected.manifest.packId);
  const manifest = readJson(safeArtifact(out, 'manifest.json'));
  assert(json(manifest) === json(expected.manifest), `${key}: manifest drift from current source`);
  assert(fs.readFileSync(safeArtifact(out, 'catalog.js'), 'utf8') === catalogText(manifest), `${key}: offline catalog drift`);
  const atlas = decodePng(safeArtifact(out, 'atlas.png')), contact = decodePng(safeArtifact(out, 'contact-sheet.png'));
  assert(atlas.width === expected.atlas.width && atlas.height === expected.atlas.height && sha256(atlas.pixels) === sha256(expected.atlas.pixels), `${key}: atlas differs from rendered source`);
  assert(contact.width === expected.contact.width && contact.height === expected.contact.height && sha256(contact.pixels) === sha256(expected.contact.pixels), `${key}: contact sheet differs from source`);
  let compared = 0;
  manifest.sprites.forEach((s, i) => {
    const image = decodePng(safeArtifact(out, s.path)); auditPixels(image, s.id);
    assert(sha256(image.pixels) === s.pixelSha256 && sha256(image.pixels) === sha256(expected.images[i].pixels), `${s.id}: file/source mismatch`);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const a = (y * SIZE + x) * 4, b = ((y + s.atlas.y) * atlas.width + x + s.atlas.x) * 4;
      for (let c = 0; c < 4; c++) assert(image.pixels[a + c] === atlas.pixels[b + c], `${s.id}: atlas readback mismatch`);
      compared++;
    }
  });
  return { schemaVersion: 1, packId: manifest.packId, status: 'passed', counts: { ...manifest.counts, distinctBaseSilhouettes: 48, nonRecolorVariantPairs: expected.variantPairs, atlasPixelsCompared: compared }, checks: { sourcePreflight: true, dimensions: true, nativeDensity2: true, binaryAlpha: true, masterPalette: true, transparentPadding3: true, noExactDuplicates: true, noPureRecolorVariants: true, distinctBaseSilhouettes: true, stableAnchors: true, safePaths: true, deterministicSourceRendering: true, pngDecode: true, atlasReadback: true, contactSheetReadback: true, offlineCatalog: true, reserveNotIntegrated: true }, sprites: expected.records, limitations: ['Programmatic checks do not replace visual review.', 'Catalog framing is not an in-game size contract.', 'No game integration, economics or save changes.'] };
}
export function buildLibrary() {
  const ids = ['seasonal-reserve-v1', ...Object.keys(SOURCES).map(key => `${key}-reserve-v1`)];
  const packs = [], globalIds = new Set(), globalHashes = new Map(), sprites = [], decoded = new Map();
  for (const id of ids) {
    const directory = packDirectory(id), file = safeArtifact(directory, 'manifest.json');
    if (!fs.existsSync(file)) continue;
    const m = readJson(file);
    assert(m.packId === id && m.status === 'reserve' && m.integrated === false, `Non-reserve pack ${id}`);
    const report = readJson(safeArtifact(directory, 'verification-report.json'));
    assert(report.status === 'passed', `${id} has not passed validation`);
    const titleZh = m.titleZh ?? '四季咖啡馆', titleEn = m.titleEn ?? 'Seasonal Café';
    packs.push({ id, titleZh, titleEn, sprites: m.sprites.length, baseShapes: m.counts.baseShapes, path: `../${id}`, categories: m.categories, categoryLabels: m.categoryLabels ?? [], atlas: `../${id}/atlas.png`, contactSheet: `../${id}/contact-sheet.png`, manifest: `../${id}/manifest.json`, readme: `../${id}/README.md` });
    for (const sprite of m.sprites) {
      assert(!globalIds.has(sprite.id), `Cross-pack duplicate ID ${sprite.id}`); globalIds.add(sprite.id);
      const image = decodePng(safeArtifact(directory, sprite.path)), hash = sha256(image.pixels);
      assert(hash === sprite.pixelSha256, `${sprite.id}: manifest/PNG hash mismatch`);
      assert(!globalHashes.has(hash), `Cross-pack duplicate image ${sprite.id}/${globalHashes.get(hash)}`); globalHashes.set(hash, sprite.id); decoded.set(sprite.id, image);
      sprites.push({ ...sprite, packId: id, packTitleZh: titleZh, path: `../${id}/${sprite.path}` });
    }
  }
  assert(packs.length > 0, 'No generated packs to index');
  const library = { schemaVersion: 1, status: 'reserve', integrated: false, counts: { packs: packs.length, sprites: sprites.length, baseShapes: packs.reduce((n, p) => n + p.baseShapes, 0) }, packs, sprites };
  const out = safeArtifact(ASSETS, 'reserve-library'); fs.mkdirSync(out, { recursive: true });
  // Metadata only: the hand-maintained index.html and README are never replaced.
  fs.writeFileSync(safeArtifact(out, 'manifest.json'), json(library));
  fs.writeFileSync(safeArtifact(out, 'catalog.js'), `// Generated local-only library.\nwindow.RESERVE_LIBRARY = ${JSON.stringify(library)};\n`);
  fs.writeFileSync(safeArtifact(out, 'verification-report.json'), json({ status: 'passed', ...library.counts, uniqueIds: globalIds.size, uniquePixelHashes: globalHashes.size, note: 'Cross-pack exact-duplicate and manifest/decoded-PNG checks; not a visual-quality verdict.' }));
  const overview = [];
  for (const pack of packs) for (const category of pack.categories) {
    const candidates = sprites.filter(s => s.packId === pack.id && s.category === category);
    const bases = [...new Set(candidates.map(s => s.baseShape))].slice(0, 2);
    for (const base of bases) {
      const variants = candidates.filter(s => s.baseShape === base);
      overview.push(variants[overview.length % variants.length]);
    }
  }
  encodePng(safeArtifact(out, 'overview.png'), contactSheet(overview.map(s => decoded.get(s.id))));
  fs.writeFileSync(safeArtifact(out, 'overview.json'), json({ note: 'Two representative base shapes per category; ordinal labels match this list, not the complete library.', sprites: overview.map((s, i) => ({ ordinal: i + 1, id: s.id, nameZh: s.nameZh, path: s.path, packId: s.packId })) }));
  return library.counts;
}
async function main() {
  const args = process.argv.slice(2), requested = args.find(a => a.startsWith('--pack='))?.slice(7);
  assert(args.every(a => ['--all', '--check', '--gallery'].includes(a) || a.startsWith('--pack=')), 'Unknown argument');
  assert(!(args.includes('--all') && requested), 'Use either --all or --pack');
  assert(requested || args.includes('--all') || args.includes('--gallery'), 'Usage: --pack=workshop|neighborhood|hobby|travel | --all | --gallery [--check]');
  if (requested || args.includes('--all')) {
    for (const key of requested ? [requested] : Object.keys(SOURCES)) {
      const report = args.includes('--check') ? await checkPack(key) : await buildPack(key);
      console.log(JSON.stringify({ mode: args.includes('--check') ? 'check' : 'build', packId: report.packId, status: report.status, ...report.counts }));
    }
  }
  if (args.includes('--gallery')) console.log(JSON.stringify({ mode: 'gallery', ...buildLibrary() }));
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main().catch(error => { console.error(error.stack ?? error); process.exitCode = 1; });
