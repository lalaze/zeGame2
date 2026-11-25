// The letters of the Godot project: which ones it needs, and which a font file has.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** True for printable ASCII and Latin-1/Extended-A/B letters & marks (including é). */
export function isLatinCodepoint(cp) {
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xc0 && cp <= 0x24f && cp !== 0xd7 && cp !== 0xf7) return true;
  return false;
}

/** True for CJK Unified Ideographs, CJK punctuation, and Fullwidth forms. */
export function isCjkCodepoint(cp) {
  return (
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}

/** Every letter the project can show by itself: its locale files, its data, and what its scripts say. */
export function collectRequiredChars(godotDir) {
  const chars = new Set('¥$×·…—–“”‘’、，。：；！？（）《》【】％＋−→←↑↓★☆♥✓∞°•');
  for (let cp = 0x20; cp < 0x7f; cp++) chars.add(String.fromCharCode(cp));
  for (const dir of ['app', 'core', 'data', 'ui', 'view']) {
    for (const f of readdirSync(join(godotDir, dir))) {
      if (!/\.(gd|json)$/.test(f)) continue;
      for (const ch of readFileSync(join(godotDir, dir, f), 'utf8')) if (ch.codePointAt(0) > 0x7f) chars.add(ch);
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

/** The Latin letters and signs among them, which Nunito draws. */
export function collectNunitoChars(required) {
  const chars = new Set('¥×·…—–“”‘’°•');
  for (let cp = 0x20; cp < 0x7f; cp++) chars.add(String.fromCharCode(cp));
  for (const ch of required) if (isLatinCodepoint(ch.codePointAt(0))) chars.add(ch);
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

/**
 * Pure-JS TrueType cmap parser (supports format 4 BMP and format 12 full Unicode).
 * Returns a Set<number> of Unicode codepoints mapped to non-zero glyph IDs.
 */
export function readTtfCodepoints(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const numTables = view.getUint16(4, false);
  let cmapOffset = -1;
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const tag = String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
    if (tag === 'cmap') {
      cmapOffset = view.getUint32(off + 8, false);
      break;
    }
  }
  if (cmapOffset < 0) throw new Error('TTF missing cmap table');
  const numSubtables = view.getUint16(cmapOffset + 2, false);
  const codepoints = new Set();
  for (let i = 0; i < numSubtables; i++) {
    const rec = cmapOffset + 4 + i * 8;
    const platformId = view.getUint16(rec, false);
    const subOffset = cmapOffset + view.getUint32(rec + 4, false);
    if (platformId !== 0 && platformId !== 3) continue;
    const format = view.getUint16(subOffset, false);
    if (format === 4) {
      const segCount = view.getUint16(subOffset + 6, false) / 2;
      const endCountOff = subOffset + 14;
      const startCountOff = endCountOff + segCount * 2 + 2;
      const idDeltaOff = startCountOff + segCount * 2;
      const idRangeOff = idDeltaOff + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const endCode = view.getUint16(endCountOff + s * 2, false);
        const startCode = view.getUint16(startCountOff + s * 2, false);
        if (startCode === 0xffff && endCode === 0xffff) break;
        const idDelta = view.getInt16(idDeltaOff + s * 2, false);
        const rangeOffset = view.getUint16(idRangeOff + s * 2, false);
        for (let cp = startCode; cp <= endCode; cp++) {
          let gid = 0;
          if (rangeOffset === 0) {
            gid = (cp + idDelta) & 0xffff;
          } else {
            const glyphIdxOff = idRangeOff + s * 2 + rangeOffset + (cp - startCode) * 2;
            const rawGid = view.getUint16(glyphIdxOff, false);
            if (rawGid !== 0) gid = (rawGid + idDelta) & 0xffff;
          }
          if (gid !== 0) codepoints.add(cp);
        }
      }
    } else if (format === 12) {
      const numGroups = view.getUint32(subOffset + 12, false);
      for (let g = 0; g < numGroups; g++) {
        const gOff = subOffset + 16 + g * 12;
        const startChar = view.getUint32(gOff, false);
        const endChar = view.getUint32(gOff + 4, false);
        const startGid = view.getUint32(gOff + 8, false);
        for (let cp = startChar; cp <= endChar; cp++) {
          if (startGid + (cp - startChar) !== 0) codepoints.add(cp);
        }
      }
    }
  }
  return codepoints;
}
