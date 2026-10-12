/** Restore exact audit JSON from tracked gzip files without replacing changed evidence. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../docs/long-task/', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'COMPRESSED-EVIDENCE.json'), 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const verifyOnly = process.argv.includes('--verify-only');
const validated = manifest.files.map((entry) => {
  if (!/^results\/[a-z0-9-]+\.json$/.test(entry.file) || entry.gzipFile !== `${entry.file}.gz`) throw new Error('Unsafe evidence path');
  const packed = readFileSync(resolve(root, entry.gzipFile));
  if (packed.length !== entry.gzipBytes || sha(packed) !== entry.gzipSha256) throw new Error(`Compressed checksum mismatch: ${entry.file}`);
  const bytes = gunzipSync(packed);
  if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) throw new Error(`Raw checksum mismatch: ${entry.file}`);
  const path = resolve(root, entry.file);
  if (existsSync(path) && sha(readFileSync(path)) !== entry.sha256) throw new Error(`Refusing to overwrite modified evidence: ${entry.file}`);
  return { path, bytes };
});
// Validate the complete set before writing any file.
if (!verifyOnly) for (const { path, bytes } of validated) if (!existsSync(path)) writeFileSync(path, bytes, { flag: 'wx' });
console.log(`${verifyOnly ? 'Verified' : 'Restored/verified'} ${validated.length} exact audit evidence files.`);
