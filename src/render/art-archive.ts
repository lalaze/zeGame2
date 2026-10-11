export interface ArchiveFile { name: string; bytes: Uint8Array }

/** Uncompressed ZIP: PNGs are already compressed. Keeps the gallery export offline
 * and dependency-free, with UTF-8 names and standard CRC-32 integrity checks. */
export function artArchive(files: readonly ArchiveFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [], entries: Uint8Array[] = [];
  let offset = 0;
  const header = (size: number) => {
    const bytes = new Uint8Array(size);
    return { bytes, view: new DataView(bytes.buffer) };
  };
  for (const file of files) {
    const name = encoder.encode(file.name);
    let crc = 0xffffffff;
    for (const byte of file.bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = header(30 + name.length);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(12, 0x0021, true); // 1980-01-01, deterministic DOS date.
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, file.bytes.length, true);
    local.view.setUint32(22, file.bytes.length, true);
    local.view.setUint16(26, name.length, true);
    local.bytes.set(name, 30);
    parts.push(local.bytes, file.bytes);
    const central = header(46 + name.length);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.bytes.set(local.bytes.subarray(4, 30), 6);
    central.view.setUint32(42, offset, true);
    central.bytes.set(name, 46);
    entries.push(central.bytes);
    offset += local.bytes.length + file.bytes.length;
  }
  const centralSize = entries.reduce((n, entry) => n + entry.length, 0);
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, offset, true);
  const archive = new Uint8Array(offset + centralSize + end.bytes.length);
  let cursor = 0;
  for (const part of [...parts, ...entries, end.bytes]) { archive.set(part, cursor); cursor += part.length; }
  return archive;
}
