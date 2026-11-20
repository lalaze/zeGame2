// Shared by tests and offline canvases: art under public/ ships as WebP (once GIF), and its
// PNG master lives in assets/art-masters (see scripts/convert-art-webp.mjs).
import fs from 'node:fs';
import path from 'node:path';

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
