// Shared by tests and offline canvases: art under public/ ships as WebP (once GIF), and its
// PNG master lives in assets/art-masters (see scripts/convert-art-webp.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Art that left git (source crops, rejected takes, retired packs, QA screenshots and video) keeps
 * its repo-relative path in this folder; see assets/ART-LIBRARY.md. ZEGAME_ART_LIBRARY points elsewhere.
 */
export const ART_LIBRARY = process.env.ZEGAME_ART_LIBRARY || '/Volumes/data/zeGame2-library';
/** False on a machine without the library, where checks against moved source art are skipped. */
export const hasArtLibrary = fs.existsSync(ART_LIBRARY);
/**
 * Whether the bulk-candidates source crops of catalog-v1 are in the library. They were deleted on
 * 2026-11-23 (assets/ART-LIBRARY.md); restored from git history, the checks against them run again.
 */
export const hasSourceCrops = fs.existsSync(path.join(ART_LIBRARY, 'assets/generated/bulk-candidates'));
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** The absolute path of a repo file (repo-relative or absolute), or of its art-library copy once it left git. */
export function librarySource(file) {
  const absolute = path.resolve(ROOT, file);
  return fs.existsSync(absolute) ? absolute : path.join(ART_LIBRARY, path.relative(ROOT, absolute));
}

/** The PNG a public file was encoded from, or the file itself if it was never converted. */
export function artMaster(file) {
  const master = path.posix.normalize(file).replace(/^(.*\/)?public\//, '$1assets/art-masters/').replace(/\.(gif|webp)$/, '.png');
  return fs.existsSync(master) ? master : file;
}

/** [width, height] from a PNG, GIF or WebP header. */
export function imageSize(bytes) {
  if (bytes.toString('latin1', 0, 6) === 'GIF89a') return [bytes.readUInt16LE(6), bytes.readUInt16LE(8)];
  if (bytes.toString('latin1', 1, 4) === 'PNG') return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = bytes.toString('latin1', 12, 16);
    if (chunk === 'VP8L') { const bits = bytes.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]; }
    if (chunk === 'VP8X') return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
    if (chunk === 'VP8 ') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
  throw new Error('Not a PNG, GIF or WebP');
}
