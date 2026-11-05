// Shared by tests and offline canvases: art under public/ may be a GIF whose original PNG
// lives in assets/art-masters (see scripts/convert-art-gif.mjs).
import fs from 'node:fs';
import path from 'node:path';

/** The PNG a public file was encoded from, or the file itself if it was never converted. */
export function artMaster(file) {
  const master = path.posix.normalize(file).replace(/^(.*\/)?public\//, '$1assets/art-masters/').replace(/\.gif$/, '.png');
  return fs.existsSync(master) ? master : file;
}

/** [width, height] from a PNG or GIF header. */
export function imageSize(bytes) {
  if (bytes.toString('latin1', 0, 6) === 'GIF89a') return [bytes.readUInt16LE(6), bytes.readUInt16LE(8)];
  if (bytes.toString('latin1', 1, 4) === 'PNG') return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  throw new Error('Not a PNG or GIF');
}
