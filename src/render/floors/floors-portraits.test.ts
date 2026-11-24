// @vitest-environment happy-dom
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_CAST } from '../../game/customer-cast';
import type { Look } from '../../game/state';
import type { StaffLooks } from './floors-looks';
import { castSheet, floorsPortraitArt } from './floors-portraits';

const BUILD = 'assets/generated/floor-sample-v1/build';
const look: Look = { skin: 0, hair: 1, hairStyle: 2, shirt: 3, pants: 1 };

afterEach(() => vi.unstubAllGlobals());

describe('floors portraits', () => {
  it('paints staff from the staff looks', async () => {
    const canvas = document.createElement('canvas');
    const front = vi.fn(() => Promise.resolve(canvas));
    const art = floorsPortraitArt('/build/', { front } as unknown as StaffLooks);
    await expect(art({ look })).resolves.toBe(canvas);
    expect(front).toHaveBeenCalledWith(look);
  });

  it('has no portrait for an id that is not a guest', () => {
    const art = floorsPortraitArt('/build/', {} as StaffLooks);
    expect(art({ guest: -1 })).toBeUndefined();
    expect(art({ guest: 1.5 })).toBeUndefined();
  });

  it('fails for a guest without a painted sheet, and asks again the next time', async () => {
    const fetched = vi.fn(async () => ({ ok: true, json: async () => ({ 'cast-00': { frameWidth: 10, frameHeight: 20 } }) }));
    vi.stubGlobal('fetch', fetched);
    const art = floorsPortraitArt('/build/', {} as StaffLooks);
    await expect(art({ guest: 77 })).rejects.toThrow('No floors sheet for guest 77');
    await expect(art({ guest: 77 })).rejects.toThrow();
    // The sheet index itself is fetched once.
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(fetched).toHaveBeenCalledWith('/build/sheets.json');
  });

  it('fails when the sheet index cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await expect(floorsPortraitArt('/build/', {} as StaffLooks)({ guest: 0 })).rejects.toThrow();
  });

  it('has a painted sheet with a front pose for every guest of the cast', () => {
    const sheets = JSON.parse(readFileSync(`${BUILD}/sheets.json`, 'utf8')) as Record<string, { frameWidth: number; frames: number }>;
    CUSTOMER_CAST.forEach((_, id) => {
      expect(sheets[castSheet(id)]?.frames, castSheet(id)).toBe(8);
      expect(existsSync(`${BUILD}/${castSheet(id)}.webp`), castSheet(id)).toBe(true);
    });
  });
});
