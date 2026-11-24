import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CONDITIONS } from '../../game/conditions';
import { DAY_SECONDS } from '../../game/data';
import { DECOR } from '../../game/decor';
import { FLOOR_ART, FRAME, WORLD_W, type FloorId } from './floors-layout';
import {
  CEILING_LAMPS, FLOOR_LAMPS, ROOM_WINDOWS, SKY_NAMES, SKY_TIMES, SKY_WEATHERS, STREET_LAMP, WALL_LAMPS,
  floorLamps, previewSky, skyHour, skyLook, skyTimes, type SkyTops,
} from './floors-sky-light';

// floors-sky.ts draws with Phaser, which needs a browser; only its lists of pictures are read here.
vi.mock('phaser', () => ({ default: { GameObjects: { Rectangle: class {} }, BlendModes: {}, Math: {} } }));
const { ATTIC_SHADE, SKY_IMAGES, SKY_PICTURES, SKY_TOPS, WINDOW_GLOWS } = await import('./floors-sky');

const BUILD = 'assets/generated/floor-sample-v1/build';
const read = (path: string) => (existsSync(`${BUILD}/${path}`) ? JSON.parse(readFileSync(`${BUILD}/${path}`, 'utf8')) : null);
const manifest = read('sky/sky.json') as {
  width: number; height: number;
  skies: Record<string, { image: string; top: string }>;
  sprites: Record<string, [number, number]>;
  windows: Record<string, { image: string; width: number; height: number; scale: number; glass: number }>;
  shade: Record<string, { image: string; width: number; height: number; scale: number }>;
} | null;
const atlas = read('sky/sprites.json') as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>; meta: { size: { w: number; h: number } } } | null;
const frame = read('frame/frame.json') as Record<string, { width: number; height: number; top?: string }> | null;
const tops: SkyTops = SKY_TOPS;
const hex = (colour: number) => colour.toString(16).padStart(6, '0');
const brightness = (colour: number) => ((colour >> 16) & 255) + ((colour >> 8) & 255) + (colour & 255);

describe.skipIf(!manifest || !atlas || !frame)('floors sky pictures', () => {
  it('has a painted sky for every sky the game shows, the size of the day sky, with its top colour', () => {
    expect(Object.keys(manifest!.skies).sort()).toEqual([...SKY_NAMES].sort());
    expect([manifest!.width, manifest!.height]).toEqual([frame!.sky.width, frame!.sky.height]);
    expect(manifest!.width).toBe(WORLD_W);
    expect(manifest!.skies.day).toEqual({ image: 'frame/sky', top: frame!.sky.top });
    for (const name of SKY_NAMES) {
      const sky = manifest!.skies[name];
      expect(existsSync(`${BUILD}/${sky.image}.webp`), sky.image).toBe(true);
      if (name !== 'day') expect(sky.image, name).toBe(SKY_PICTURES[name]);
      // The colours the game starts with are the manifest's, so nothing flashes when it is read.
      expect(SKY_TOPS[name], name).toBe(sky.top);
    }
  });

  it('loads only pictures that exist', () => {
    for (const key of SKY_IMAGES) expect(existsSync(`${BUILD}/${key}.webp`), key).toBe(true);
    expect(existsSync(`${BUILD}/sky/sprites.webp`)).toBe(true);
  });

  it('has every cloud and piece the sky draws in its atlas, inside the picture', () => {
    const drawn = ['cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5', 'cloud-6', 'moon', 'sun', 'star', 'drop', 'splash',
      'flake-1', 'flake-2', 'leaf-1', 'leaf-2', 'balloon-1', 'balloon-2', 'bird'];
    expect(Object.keys(atlas!.frames).sort()).toEqual(drawn.sort());
    expect(Object.keys(manifest!.sprites).sort()).toEqual(drawn.sort());
    const source = readFileSync('src/render/floors/floors-sky.ts', 'utf8');
    for (const name of drawn) {
      const { x, y, w, h } = atlas!.frames[name].frame;
      expect(x >= 0 && y >= 0 && x + w <= atlas!.meta.size.w && y + h <= atlas!.meta.size.h, name).toBe(true);
      expect(manifest!.sprites[name]).toEqual([w, h]);
      expect(source, `${name} is drawn`).toContain(`'${name}'`);
    }
  });

  it('has the window light of every front wall and the night over the top floor, at their pictures\' size', () => {
    expect(Object.keys(manifest!.windows).sort()).toEqual(Object.keys(WINDOW_GLOWS).map(key => key.replace('frame/', '')).sort());
    for (const [wall, glow] of Object.entries(manifest!.windows)) {
      expect(glow.image).toBe(WINDOW_GLOWS[`frame/${wall}`]);
      expect(Math.abs(glow.width * glow.scale - frame![wall].width), wall).toBeLessThanOrEqual(1);
      expect(Math.abs(glow.height * glow.scale - frame![wall].height), wall).toBeLessThanOrEqual(1);
      // Every wall has glass to light.
      expect(glow.glass, wall).toBeGreaterThan(.02);
    }
    const shade = manifest!.shade.attic;
    expect(shade.image).toBe(ATTIC_SHADE);
    expect(Math.abs(shade.width * shade.scale - frame!.attic.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(shade.height * shade.scale - frame!.attic.height)).toBeLessThanOrEqual(1);
  });
});

describe('floors sky by the clock', () => {
  it('follows the game\'s business clock: morning while planning, 08:00 to 20:00 while open, held at closing', () => {
    expect(skyHour({ phase: 'prep', dayTime: 500 })).toBe(8);
    expect(skyHour({ phase: 'open', dayTime: 0 })).toBe(8);
    expect(skyHour({ phase: 'open', dayTime: DAY_SECONDS / 2 })).toBe(14);
    expect(skyHour({ phase: 'open', dayTime: DAY_SECONDS })).toBe(20);
    expect(skyHour({ phase: 'closing', dayTime: DAY_SECONDS * 3 })).toBe(20);
  });

  it('shows the day sky through business hours, dusk at sunset and night at closing', () => {
    for (const hour of [8, 10, 12, 15.5]) expect(skyTimes(hour), String(hour)).toEqual({ day: 1, dusk: 0, night: 0 });
    expect(skyTimes(18.5)).toEqual({ day: 0, dusk: 1, night: 0 });
    expect(skyTimes(20).night).toBeCloseTo(.9);
    for (const hour of [0, 3, 21, 23.5]) expect(skyTimes(hour), String(hour)).toEqual({ day: 0, dusk: 0, night: 1 });
    // Dawn borrows the dusk sky.
    expect(skyTimes(6.5).dusk).toBe(1);
  });

  it('cross-fades without a jump: the shares always add up to 1 and move a little at a time', () => {
    let last = skyTimes(0);
    for (let hour = 0; hour <= 24; hour += .05) {
      const now = skyTimes(hour);
      expect(now.day + now.dusk + now.night).toBeCloseTo(1);
      for (const name of SKY_TIMES) {
        expect(now[name]).toBeGreaterThanOrEqual(0);
        expect(Math.abs(now[name] - last[name]), `${name} at ${hour.toFixed(2)}`).toBeLessThan(.12);
      }
      last = now;
    }
  });

  it('leaves the building as painted on a fair day, and lights the lamps as night falls', () => {
    for (const hour of [8, 12, 15]) {
      const look = skyLook(hour, 'fair', tops);
      expect([hex(look.room), look.lamps, look.stars, look.moon, look.cover, look.fall]).toEqual(['ffffff', 0, 0, 0, 0, null]);
      // The morning and the afternoon are only a touch warmer than noon.
      expect(brightness(look.outside), String(hour)).toBeGreaterThan(720);
    }
    expect(hex(skyLook(12, 'fair', tops).outside)).toBe('ffffff');
    expect(hex(skyLook(12, 'fair', tops).top)).toBe(tops.day.slice(1));
    const dusk = skyLook(19, 'fair', tops), night = skyLook(22, 'fair', tops);
    expect(dusk.lamps).toBeGreaterThan(.5);
    expect(night.lamps).toBe(1);
    expect(night.stars).toBe(1);
    expect(night.moon).toBe(1);
    expect(hex(night.top)).toBe(tops.night.slice(1));
  });

  it('keeps the rooms warm and easy to read at night while the outside darkens', () => {
    for (const weather of SKY_WEATHERS) {
      for (let hour = 0; hour <= 24; hour += .5) {
        const look = skyLook(hour, weather, tops);
        const [r, g, b] = [look.room >> 16 & 255, look.room >> 8 & 255, look.room & 255];
        // Never more than a fifth darker, and never cooler than it is warm.
        expect(Math.min(r, g, b), `${weather} ${hour}`).toBeGreaterThanOrEqual(255 * .78);
        expect(r).toBeGreaterThanOrEqual(b);
        // The outside stays visible: dimmed to no less than about two fifths.
        expect(brightness(look.outside), `${weather} ${hour}`).toBeGreaterThan(765 * .38);
        expect(brightness(look.room)).toBeGreaterThanOrEqual(brightness(look.outside));
      }
    }
    const night = skyLook(22, 'fair', tops);
    expect(brightness(night.outside)).toBeLessThan(brightness(night.room) * .8);
  });
});

describe('floors sky by the weather', () => {
  it('has a look for every condition of the game, and for snow', () => {
    expect([...SKY_WEATHERS].sort()).toEqual([...CONDITIONS.map(c => c.id), 'snow'].sort());
    const looks = SKY_WEATHERS.map(weather => {
      const look = skyLook(12, weather, tops);
      return JSON.stringify([look.cover, look.clear, look.clouds, look.drift, look.fall, look.sun, look.balloons, look.bird, look.cloudTint]);
    });
    // No two kinds of day look the same.
    expect(new Set(looks).size).toBe(SKY_WEATHERS.length);
  });

  it('covers the sky and brings rain on a rainy day, with the lamps on early', () => {
    const rain = skyLook(12, 'rain', tops);
    expect([rain.cover, rain.fall, rain.sun, rain.stars]).toEqual([1, 'rain', 0, 0]);
    expect(rain.pieces).toBeGreaterThan(20);
    expect(rain.lamps).toBeGreaterThanOrEqual(.4);
    expect(brightness(rain.outside)).toBeLessThan(brightness(skyLook(12, 'fair', tops).outside));
    // A rainy night hides the stars and the moon behind the overcast sky, which darkens with the hour.
    const night = skyLook(22, 'rain', tops);
    expect([night.stars, night.moon]).toEqual([0, 0]);
    expect(brightness(night.coverTint)).toBeLessThan(brightness(rain.coverTint));
    expect(brightness(night.top)).toBeLessThan(brightness(rain.top));
  });

  it('shows the sun in a cloudless sky on a hot day, leaves on a crisp one, snow when it snows', () => {
    const hot = skyLook(12, 'hot', tops);
    expect([hot.sun, hot.clear, hot.fall]).toEqual([1, true, null]);
    expect(skyLook(22, 'hot', tops).sun).toBe(0);
    expect(skyLook(10, 'crisp', tops).fall).toBe('leaves');
    expect(skyLook(12, 'snow', tops).fall).toBe('snow');
    expect(skyLook(12, 'market', tops).balloons).toBe(true);
    expect(skyLook(12, 'quiet', tops).bird).toBe(true);
    // Balloons and birds are for the day.
    expect([skyLook(22, 'market', tops).balloons, skyLook(22, 'quiet', tops).bird]).toEqual([false, false]);
    for (const weather of ['fair', 'market', 'quiet'] as const) expect(skyLook(12, weather, tops).fall, weather).toBeNull();
  });

  it('reads a preview hour and weather from the address, and ignores anything else', () => {
    expect(previewSky('?floors&hour=21&weather=rain')).toEqual({ hour: 21, weather: 'rain' });
    expect(previewSky('?floors&hour=7.5')).toEqual({ hour: 7.5 });
    expect(previewSky('?floors&weather=snow')).toEqual({ weather: 'snow' });
    expect(previewSky('?floors')).toEqual({});
    expect(previewSky('?floors&hour=&weather=')).toEqual({});
    expect(previewSky('?floors&hour=25&weather=fog')).toEqual({});
    expect(previewSky('?floors&hour=night')).toEqual({});
  });
});

describe('floors lamps', () => {
  const floors = Object.keys(FLOOR_ART) as FloorId[];

  it('gives every floor lamps, inside its picture', () => {
    for (const floor of floors) {
      const art = FLOOR_ART[floor];
      expect(FLOOR_LAMPS[floor].length, floor).toBeGreaterThanOrEqual(2);
      for (const lamp of floorLamps(floor, { ceiling: 'ceiling_chandelier', neon: 'neon_cafe' })) {
        expect(lamp.x, floor).toBeGreaterThan(0);
        expect(lamp.x, floor).toBeLessThan(WORLD_W);
        expect(lamp.y, floor).toBeGreaterThanOrEqual(art.top);
        expect(lamp.y, floor).toBeLessThan(art.top + art.height);
        expect(lamp.reach).toBeGreaterThan(100);
      }
    }
  });

  it('adds the lamps of the ceiling decor and the neon sign where the game shows them', () => {
    // Only real decor is named, and every ceiling with lamps in it is here.
    for (const id of Object.keys(CEILING_LAMPS)) expect(DECOR.find(d => d.id === id)?.slot, id).toBe('ceiling');
    expect(Object.keys(CEILING_LAMPS).sort()).toEqual(['ceiling_chandelier', 'ceiling_lights', 'ceiling_pendants']);
    const plain = floorLamps('ground').length;
    expect(floorLamps('ground', { ceiling: 'ceiling_none', neon: 'neon_none' })).toHaveLength(plain);
    expect(floorLamps('ground', { ceiling: 'ceiling_pendants' })).toHaveLength(plain + 3);
    expect(floorLamps('ground', { ceiling: 'ceiling_vines', neon: 'neon_heart' })).toHaveLength(plain + 1);
    // The neon sign is downstairs only; the top floor and the basement have no decor.
    expect(floorLamps('floor-2', { neon: 'neon_heart' })).toHaveLength(floorLamps('floor-2').length);
    expect(floorLamps('floor-2', { ceiling: 'ceiling_chandelier' })).toHaveLength(floorLamps('floor-2').length + 1);
    for (const floor of ['roof', 'basement'] as const) expect(floorLamps(floor, { ceiling: 'ceiling_pendants', neon: 'neon_cup' })).toHaveLength(FLOOR_LAMPS[floor].length);
  });

  it('keeps the room windows, the walls\' lamps and the street lamp on their pictures', () => {
    for (const [floor, shape] of Object.entries(ROOM_WINDOWS) as [FloorId, [number, number][]][]) {
      expect(shape.length, floor).toBeGreaterThanOrEqual(3);
      for (const [x, y] of shape) {
        expect(x > 0 && x < WORLD_W / 2, floor).toBe(true);
        expect(y >= FLOOR_ART[floor].top && y < FLOOR_ART[floor].top + FLOOR_ART[floor].height, floor).toBe(true);
      }
    }
    expect(Object.keys(WALL_LAMPS).sort()).toEqual(Object.keys(WINDOW_GLOWS).sort());
    for (const [wall, lamps] of Object.entries(WALL_LAMPS)) {
      const size = frame?.[wall.replace('frame/', '')];
      for (const lamp of lamps) {
        expect(lamp.x > 0 && lamp.x < WORLD_W, wall).toBe(true);
        if (size) expect(lamp.y > 0 && lamp.y < size.height, wall).toBe(true);
      }
    }
    for (const lamp of STREET_LAMP) expect(lamp.x > 0 && lamp.x < WORLD_W && lamp.y > 0 && lamp.y < FRAME.street).toBe(true);
  });
});
