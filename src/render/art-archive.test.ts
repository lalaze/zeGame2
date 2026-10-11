import { describe, expect, it } from 'vitest';
import { artArchive } from './art-archive';

describe('current artwork ZIP export', () => {
  it('stores matching files, offsets, UTF-8 names, and standard CRC-32', () => {
    const files = [
      { name: 'customer/0/down-0.png', bytes: new TextEncoder().encode('123456789') },
      { name: '房间/main.png', bytes: new Uint8Array([0, 255, 12]) },
    ];
    const bytes = artArchive(files), view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(files.length);
    let central = view.getUint32(end + 16, true);
    for (const [i, file] of files.entries()) {
      expect(view.getUint32(central, true)).toBe(0x02014b50);
      const local = view.getUint32(central + 42, true);
      expect(view.getUint32(local, true)).toBe(0x04034b50);
      expect(view.getUint16(local + 6, true)).toBe(0x0800);
      expect(view.getUint16(local + 8, true)).toBe(0);
      if (i === 0) expect(view.getUint32(local + 14, true)).toBe(0xcbf43926);
      expect(view.getUint32(local + 14, true)).toBe(view.getUint32(central + 16, true));
      const length = view.getUint16(local + 26, true);
      expect(new TextDecoder().decode(bytes.subarray(local + 30, local + 30 + length))).toBe(file.name);
      expect(bytes.subarray(local + 30 + length, local + 30 + length + file.bytes.length)).toEqual(file.bytes);
      central += 46 + view.getUint16(central + 28, true);
    }
    expect(central).toBe(end);
    expect(artArchive(files)).toEqual(bytes);
  });

  it('writes an empty archive with a valid end record', () => {
    const bytes = artArchive([]);
    expect(bytes.length).toBe(22);
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x06054b50);
  });
});
