import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOK_RANGES, type Look } from '../../game/state';
import { TEAM_HAIRSTYLES } from '../cozy-team-art';
import { HAIRS, PANTS, SHIRTS, SKINS } from '../sprites';
import { imageSize } from '../../../scripts/art-files.mjs';
import { Recent, cookId, lookColours, lookId, lookStyle, normalLook, type StaffManifest } from './floors-looks';
import { STAFF_PARTS, hexRgb, paintStaff, repaint, shade, type StaffColours } from './staff-paint';

const PACK = 'assets/generated/floor-sample-v1';
const manifest = JSON.parse(readFileSync(`${PACK}/build/staff/staff.json`, 'utf8')) as StaffManifest;
const size = (file: string) => imageSize(readFileSync(file)) as [number, number];

describe('floors staff art', () => {
  it('lists the hairstyles in the game\'s save order, in the manifest and in the build script', () => {
    expect(manifest.order).toEqual([...TEAM_HAIRSTYLES]);
    expect(TEAM_HAIRSTYLES.length).toBe(LOOK_RANGES.hairStyle);
    const script = readFileSync('scripts/art-gen/floor-staff-build.py', 'utf8');
    const listed = script.match(/^STYLES = \[([\s\S]*?)\]/m)![1].match(/'(\w+)'/g)!.map(name => name.slice(1, -1));
    expect(listed).toEqual([...TEAM_HAIRSTYLES]);
  });

  it('has a strip, a mask of twice its height, key colours and a prompt for every hairstyle', () => {
    TEAM_HAIRSTYLES.forEach((name, index) => {
      const style = manifest.styles[name];
      expect(style, name).toBeTruthy();
      expect(size(`${PACK}/build/staff/${name}.webp`), name).toEqual([style.frameWidth * style.frames, style.frameHeight]);
      expect(size(`${PACK}/build/staff/${name}-mask.webp`), name).toEqual([style.frameWidth * style.frames, style.frameHeight * 2]);
      expect(style.frames, name).toBe(8);
      for (const part of STAFF_PARTS) {
        expect(style.key[part], `${name} ${part}`).toHaveLength(3);
        // Shading is measured against the key colour, so none of its channels may be near zero.
        for (const channel of style.key[part]) expect(channel, `${name} ${part}`).toBeGreaterThan(60);
      }
      expect(existsSync(`${PACK}/prompts/staff/${String(index).padStart(2, '0')}-${name}.txt`), name).toBe(true);
    });
    expect(existsSync(`${PACK}/prompts/staff/common.txt`)).toBe(true);
  });

  it('keeps every hairstyle\'s front pose in one picture, in cells that hold it', () => {
    const { cellWidth, cellHeight, cols, rows } = manifest.fronts;
    expect(cols * rows).toBeGreaterThanOrEqual(TEAM_HAIRSTYLES.length);
    expect(size(`${PACK}/build/staff/fronts.webp`)).toEqual([cols * cellWidth, rows * cellHeight]);
    expect(size(`${PACK}/build/staff/fronts-mask.webp`)).toEqual([cols * cellWidth, rows * cellHeight * 2]);
    const cells = TEAM_HAIRSTYLES.map(name => manifest.styles[name].front);
    expect([...cells].sort((a, b) => a - b)).toEqual(TEAM_HAIRSTYLES.map((_, index) => index));
    for (const name of TEAM_HAIRSTYLES) {
      expect(manifest.styles[name].frameWidth, name).toBeLessThanOrEqual(cellWidth);
      expect(manifest.styles[name].frameHeight, name).toBeLessThanOrEqual(cellHeight);
    }
  });

  it('has both cooks\' sheets and work poses, with a mask and hair and skin key colours', () => {
    for (const name of ['cook-chef', 'cook-chef-work', 'cook-scarf', 'cook-scarf-work']) {
      const strip = manifest.cooks?.[name];
      expect(strip, name).toBeTruthy();
      expect(size(`${PACK}/build/staff/${name}.webp`), name).toEqual([strip!.frameWidth * 8, strip!.frameHeight]);
      expect(size(`${PACK}/build/staff/${name}-mask.webp`), name).toEqual([strip!.frameWidth * 8, strip!.frameHeight * 2]);
      for (const part of ['hair', 'skin'] as const) for (const channel of strip!.key[part]) expect(channel, `${name} ${part}`).toBeGreaterThan(60);
    }
    expect(existsSync(`${PACK}/prompts/staff/cook-common.txt`)).toBe(true);
    expect(cookId({ skin: 5, hair: 7, hairStyle: 9, shirt: 1, pants: 1 })).toBe('1.1');
  });

  it('finds the hairstyle a saved look wears', () => {
    const look: Look = { skin: 1, hair: 2, hairStyle: 12, shirt: 3, pants: 0 };
    expect(lookStyle(manifest, look)?.name).toBe('beard');
    expect(lookStyle(manifest, { ...look, hairStyle: 12 + 32 })?.name).toBe('beard');
    expect(lookStyle({ ...manifest, styles: {} }, look)).toBeUndefined();
  });
});

describe('staff looks', () => {
  it('names each distinct look once, whatever range its numbers come in', () => {
    const look: Look = { skin: 5, hair: -1, hairStyle: 33, shirt: 8, pants: 4 };
    expect(normalLook(look, 32)).toEqual({ skin: 1, hair: 5, hairStyle: 1, shirt: 0, pants: 1 });
    expect(lookId(look)).toBe(lookId({ skin: 1, hair: 5, hairStyle: 1, shirt: 0, pants: 1 }));
    const ids = new Set<string>();
    for (let hairStyle = 0; hairStyle < 32; hairStyle++) for (let skin = 0; skin < 4; skin++) for (let hair = 0; hair < 6; hair++) {
      for (let shirt = 0; shirt < 8; shirt++) for (let pants = 0; pants < 3; pants++) ids.add(lookId({ skin, hair, hairStyle, shirt, pants }));
    }
    expect(ids.size).toBe(32 * 4 * 6 * 8 * 3);
  });

  it('paints a look in the game\'s own colours, the apron in what the game calls the shirt', () => {
    expect(lookColours({ skin: 3, hair: 2, hairStyle: 0, shirt: 7, pants: 1 })).toEqual({
      skin: hexRgb(SKINS[3]), hair: hexRgb(HAIRS[2]), apron: hexRgb(SHIRTS[7]), pants: hexRgb(PANTS[1]),
    });
    expect([SKINS.length, HAIRS.length, SHIRTS.length, PANTS.length]).toEqual([LOOK_RANGES.skin, LOOK_RANGES.hair, LOOK_RANGES.shirt, LOOK_RANGES.pants]);
  });

  it('keeps only the newest entries', () => {
    const dropped: string[] = [];
    const recent = new Recent<number>(2, key => dropped.push(key));
    recent.set('a', 1); recent.set('b', 2);
    expect(recent.get('a')).toBe(1);
    recent.set('c', 3);
    expect(dropped).toEqual(['b']);
    expect(recent.get('b')).toBeUndefined();
    expect([recent.get('a'), recent.get('c'), recent.size]).toEqual([1, 3, 2]);
  });
});

describe('staff repaint', () => {
  const key: StaffColours = { hair: [156, 127, 214], apron: [109, 184, 119], pants: [108, 158, 220], skin: [246, 210, 180] };
  const colours: StaffColours = { hair: [89, 66, 55], apron: [229, 215, 186], pants: [83, 99, 123], skin: [128, 83, 63] };

  it('reads hex colours', () => {
    expect(hexRgb('#f4cfad')).toEqual([244, 207, 173]);
  });

  it('gives the new colour at the key colour, darker below it and lighter above, never past white', () => {
    expect(shade(120, 1)).toBe(120);
    expect(shade(120, .5)).toBe(60);
    expect(shade(120, 0)).toBe(0);
    expect(shade(120, 1.5)).toBeGreaterThan(120);
    expect(shade(120, 50)).toBeLessThanOrEqual(255);
    expect(shade(255, 2)).toBe(255);
  });

  it('repaints the key colour as exactly the new colour and keeps painted shading', () => {
    expect(repaint(156, 127, 214, key.hair, colours.hair, .3).map(Math.round)).toEqual([89, 66, 55]);
    const shadow = repaint(116, 88, 176, key.hair, colours.hair, .3), light = repaint(185, 163, 230, key.hair, colours.hair, .3);
    for (let c = 0; c < 3; c++) {
      expect(shadow[c]).toBeLessThan(colours.hair[c]);
      expect(light[c]).toBeGreaterThan(colours.hair[c]);
    }
  });

  it('keeps a rosy cheek rosier than the skin around it on every skin', () => {
    for (const hex of SKINS) {
      const skin = hexRgb(hex), cheek = repaint(250, 176, 160, key.skin, skin, .9), plain = repaint(246, 210, 180, key.skin, skin, .9);
      expect(cheek[0] / cheek[1]).toBeGreaterThan(plain[0] / plain[1] * 1.1);
    }
  });

  it('repaints each part by its share of the pixel and leaves everything else alone', () => {
    // Five pixels: hair, apron, half trousers, skin, and an outline no part claims; a sixth is transparent.
    const strip = new Uint8ClampedArray([...key.hair, 255, ...key.apron, 255, ...key.pants, 255, ...key.skin, 255, 110, 75, 55, 255, 9, 9, 9, 0]);
    const mask = new Uint8ClampedArray(strip.length * 2);
    mask[0] = 255; mask[4 + 1] = 255; mask[8 + 2] = 128; mask[strip.length + 12] = 255; mask[20] = 255;
    const out = paintStaff(strip, mask, 6, 1, key, colours);
    expect([...out.slice(0, 4)]).toEqual([...colours.hair, 255]);
    expect([...out.slice(4, 8)]).toEqual([...colours.apron, 255]);
    const half = 128 / 255;
    expect([...out.slice(8, 11)]).toEqual(key.pants.map((value, c) => Math.round(value * (1 - half) + colours.pants[c] * half)));
    expect([...out.slice(12, 16)]).toEqual([...colours.skin, 255]);
    expect([...out.slice(16, 20)]).toEqual([110, 75, 55, 255]);
    expect([...out.slice(20, 24)]).toEqual([9, 9, 9, 0]);
    // The source pixels are not written to.
    expect([...strip.slice(0, 3)]).toEqual([...key.hair]);
  });

  it('shares a pixel two parts both claim, and ignores the haze a lossy mask leaves', () => {
    const strip = new Uint8ClampedArray([200, 150, 190, 255, 100, 100, 100, 255]);
    const mask = new Uint8ClampedArray(16);
    mask[0] = 255; mask[8] = 255; mask[4 + 1] = 3;
    const out = paintStaff(strip, mask, 2, 1, key, colours);
    const hair = repaint(200, 150, 190, key.hair, colours.hair, .3), skin = repaint(200, 150, 190, key.skin, colours.skin, .9);
    expect([...out.slice(0, 3)]).toEqual(hair.map((value, c) => Math.round((value + skin[c]) / 2)));
    expect([...out.slice(4, 8)]).toEqual([100, 100, 100, 255]);
  });

  it('refuses a mask that does not fit its strip', () => {
    expect(() => paintStaff(new Uint8ClampedArray(8), new Uint8ClampedArray(8), 2, 1, key, colours)).toThrow();
  });
});
