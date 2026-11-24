import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GIFT_KINDS, GIFT_SPOTS } from '../../game/cat-gifts';
import { CATS, CAT_AREAS, CAT_PERSONALITIES, CAT_SPOTS, petPreferences, type PetPreferences } from '../../game/pets';
import { imageSize } from '../../../scripts/art-files.mjs';
import {
  CAT_FRAMES, GIFT_PLACES, catEdges, catEntry, catFloors, catNode, catNodes, catObstacles, catPlaces, catRoute, choosePlace, choosePlan,
  crossesBox, floorArea, homeFloor, inBox, placeRank, planSeconds, type CatFloor, type CatPlace, type CatsManifest,
} from './floors-cat-places';
import { FLOOR_ART, FURNITURE_SPOTS, building, furnitureSpot, stairsOf } from './floors-layout';

const BUILD = 'assets/generated/floor-sample-v1/build/cats';
const manifest = existsSync(`${BUILD}/cats.json`) ? JSON.parse(readFileSync(`${BUILD}/cats.json`, 'utf8')) as CatsManifest : null;
const size = (file: string) => imageSize(readFileSync(file)) as [number, number];

describe.skipIf(!manifest)('floors cat art', () => {
  it('has a strip of every pose and a portrait for each of the game\'s breeds', () => {
    expect(manifest!.frames).toEqual([...CAT_FRAMES]);
    expect(Object.keys(manifest!.cats).sort()).toEqual(CATS.map(cat => cat.id).sort());
    for (const [breed, sheet] of Object.entries(manifest!.cats)) {
      const [width, height] = size(`${BUILD}/${breed}.webp`);
      expect([width, height], breed).toEqual([sheet.frameWidth * CAT_FRAMES.length, sheet.frameHeight]);
      const face = size(`${BUILD}/${breed}-face.webp`);
      expect(face[0], breed).toBe(face[1]);
    }
  });

  it('draws cats knee-high to the people of the building', () => {
    const people = JSON.parse(readFileSync('assets/generated/floor-sample-v1/build/sheets.json', 'utf8')) as Record<string, { frameHeight: number }>;
    for (const [breed, sheet] of Object.entries(manifest!.cats)) {
      expect(sheet.frameHeight, breed).toBeGreaterThan(people.owner.frameHeight * .3);
      expect(sheet.frameHeight, breed).toBeLessThan(people.owner.frameHeight * .5);
    }
  });

  it('has an icon for every kind of gift', () => {
    expect([...manifest!.gifts].sort()).toEqual([...GIFT_KINDS].sort());
    for (const kind of GIFT_KINDS) {
      const [width, height] = size(`${BUILD}/gift-${kind}.webp`);
      expect(width, kind).toBe(height);
    }
  });

  it('patches the two cats painted into the terrace, inside its plate', () => {
    expect(manifest!.roof).toHaveLength(2);
    for (const patch of manifest!.roof!) {
      const [width, height] = size(`${BUILD}/${patch.file}`);
      expect(patch.x).toBeGreaterThanOrEqual(0);
      expect(patch.y).toBeGreaterThanOrEqual(0);
      expect(patch.x + width).toBeLessThanOrEqual(1672);
      expect(patch.y + height).toBeLessThanOrEqual(FLOOR_ART.roof.height);
    }
  });
});

const FULL = building(8, true).floors, SMALL = building(2, false).floors;
const prefs = (personality: PetPreferences['personality'], preferredArea: PetPreferences['preferredArea'], preferredSpot: PetPreferences['preferredSpot']): PetPreferences =>
  ({ personality, preferredArea, preferredSpot });
/** A repeatable stand-in for Math.random. */
const dice = (seed = 7) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('floors cat places', () => {
  it('keeps cats out of the basement kitchen and has places on every other floor', () => {
    expect(catFloors(FULL)).toEqual(['ground', 'floor-2', 'floor-3', 'roof']);
    expect(catFloors(SMALL)).toEqual(['ground', 'roof']);
    for (const floors of [FULL, SMALL]) {
      const places = catPlaces(floors);
      expect(new Set(places.map(place => place.id)).size).toBe(places.length);
      for (const floor of catFloors(floors)) expect(places.filter(place => place.floor === floor).length, floor).toBeGreaterThanOrEqual(3);
      // Somewhere to nap, to watch from and to keep people company in even the smallest café.
      expect(places.some(place => place.naps)).toBe(true);
      expect(places.some(place => place.kind === 'window')).toBe(true);
      expect(places.some(place => place.kind === 'people')).toBe(true);
    }
    expect(catPlaces(SMALL).every(place => place.floor === 'ground' || place.floor === 'roof')).toBe(true);
  });

  it('never stands or walks a cat inside the counter, a table or the stairs', () => {
    for (const floor of catFloors(FULL)) {
      const boxes = catObstacles(floor);
      expect(boxes.length, floor).toBeGreaterThan(1);
      for (const node of catNodes(floor)) for (const box of boxes) expect(inBox(catNode(node), box), `${node} in ${JSON.stringify(box)}`).toBe(false);
      for (const [a, b] of catEdges(floor)) for (const box of boxes) expect(crossesBox(catNode(a), catNode(b), box), `${a} to ${b}`).toBe(false);
      for (const place of catPlaces(FULL).filter(p => p.floor === floor)) {
        for (const box of boxes) expect(inBox(place, box), `${place.id} in ${JSON.stringify(box)}`).toBe(false);
        // A place on the floor is walked to in a straight line; a raised one is jumped to.
        if (!place.hop) for (const box of boxes) expect(crossesBox(catNode(place.from), place, box), place.id).toBe(false);
        expect(place.x).toBeGreaterThan(80);
        expect(place.x).toBeLessThan(1600);
        expect(place.y).toBeLessThan(FLOOR_ART[floor].top + FLOOR_ART[floor].height);
      }
    }
  });

  it('joins every place of a floor to its stairs', () => {
    for (const floor of catFloors(FULL)) {
      const reached = new Set([catEntry(floor)]);
      for (let grew = true; grew;) {
        grew = false;
        for (const [a, b] of catEdges(floor)) {
          if (reached.has(a) !== reached.has(b)) { reached.add(a); reached.add(b); grew = true; }
        }
      }
      expect([...reached].sort()).toEqual(catNodes(floor).sort());
      for (const place of catPlaces(FULL).filter(p => p.floor === floor)) expect(reached.has(place.from), place.id).toBe(true);
    }
  });

  it('maps a preferred room of the pixel café to a floor the building has', () => {
    expect(homeFloor('main', FULL)).toBe('ground');
    expect(homeFloor('reading', FULL)).toBe('floor-2');
    expect(homeFloor('workshop', FULL)).toBe('floor-3');
    for (const area of ['terrace', 'greenhouse', 'observatory'] as const) expect(homeFloor(area, FULL)).toBe('roof');
    // Without seating floors the indoor rooms come down to the ground floor.
    expect(homeFloor('reading', SMALL)).toBe('ground');
    expect(homeFloor('workshop', SMALL)).toBe('ground');
    for (const area of CAT_AREAS) expect(SMALL).toContain(homeFloor(area, SMALL));
    expect(floorArea('roof')).toBe('terrace');
    expect(floorArea('ground')).toBe('main');
    expect(floorArea('floor-3')).toBe('reading');
  });

  it('ranks a cat\'s home floor first, then its kind of spot', () => {
    const places = catPlaces(FULL);
    const best = (p: PetPreferences) => [...places].sort((a, b) => placeRank(b, p, FULL) - placeRank(a, p, FULL))[0];
    expect(best(prefs('quiet', 'terrace', 'cozy')).id).toBe('roof/cushion');
    expect(best(prefs('quiet', 'terrace', 'window')).id).toBe('roof/wall');
    expect(best(prefs('affectionate', 'main', 'window')).id).toBe('ground/window-seat');
    expect(best(prefs('playful', 'main', 'explore')).floor).toBe('ground');
    expect(best(prefs('quiet', 'reading', 'cozy')).id).toBe('floor-2/books');
    // Every breed's own preferences lead somewhere in the smallest café too.
    for (const cat of CATS) expect(choosePlace('watch', petPreferences({ id: cat.id }), catPlaces(SMALL), SMALL, undefined, dice())).toBeDefined();
  });

  it('chooses plans by personality and places by plan', () => {
    const share = (personality: PetPreferences['personality'], plan: string) => {
      let n = 0;
      for (let i = 0; i < 200; i++) if (choosePlan(personality, (i + .5) / 200) === plan) n++;
      return n / 200;
    };
    expect(share('quiet', 'nap')).toBeGreaterThan(share('playful', 'nap'));
    expect(share('playful', 'roam')).toBeGreaterThan(share('quiet', 'roam'));
    expect(share('affectionate', 'watch')).toBeGreaterThan(share('playful', 'watch'));
    for (const personality of CAT_PERSONALITIES) expect(planSeconds('nap', personality, .5)).toBeGreaterThan(planSeconds('roam', personality, .5));
    expect(planSeconds('nap', 'quiet', .5)).toBe(2 * planSeconds('nap', 'playful', .5));

    const places = catPlaces(FULL), random = dice();
    for (const personality of CAT_PERSONALITIES) for (const area of CAT_AREAS) for (const spot of CAT_SPOTS) {
      const p = prefs(personality, area, spot);
      expect(choosePlace('nap', p, places, FULL, undefined, random)!.naps).toBe(true);
      const watch = choosePlace('watch', p, places, FULL, undefined, random)!;
      expect(['window', 'people']).toContain(watch.kind);
      if (spot === 'window') expect(watch.kind).toBe('window');
      // Never the place it is already at; nothing when every place is taken.
      const here = choosePlace('roam', p, places, FULL, undefined, random)!;
      expect(choosePlace('roam', p, places, FULL, here.id, random)!.id).not.toBe(here.id);
      expect(choosePlace('roam', p, [], FULL, undefined, random)).toBeUndefined();
    }
    // A quiet cat naps at the best place for it, and keeps to its home floor.
    expect(choosePlace('nap', prefs('quiet', 'terrace', 'cozy'), places, FULL, undefined, random)!.id).toBe('roof/cushion');
  });

  it('hides a place a piece of furniture stands in front of, and makes a cat bed a place', () => {
    const books = 'floor-2-front-4';
    expect(catPlaces(FULL).some(place => place.id === 'floor-2/books')).toBe(true);
    const furnished = catPlaces(FULL, new Map([[books, 'bookshelf']]));
    expect(furnished.some(place => place.id === 'floor-2/books')).toBe(false);
    // The same spot on the floor above has no furniture, so its place stays.
    expect(furnished.some(place => place.id === 'floor-3/books')).toBe(true);
    const bedded = catPlaces(FULL, new Map([[books, 'catbed']]));
    const bed = bedded.find(place => place.kind === 'bed' && place.floor === 'floor-2')!;
    expect(bed).toMatchObject({ x: furnitureSpot(books)!.x, naps: true, hop: true });
    expect(catNodes('floor-2')).toContain(bed.from);
    // A bed on a floor the café has not opened is no place yet.
    expect(catPlaces(SMALL, new Map([[books, 'catbed']])).some(place => place.floor === 'floor-2')).toBe(false);
  });

  it('lets cats reach a cat bed at almost any floor spot, up to the top floor', () => {
    const reached = FURNITURE_SPOTS.filter(spot => !spot.box)
      .filter(spot => catPlaces(FULL, new Map([[spot.id, 'catbed']])).some(place => place.id === `${spot.floor}/bed-${spot.id}`));
    expect(reached.length).toBeGreaterThan(12);
    for (const floor of FULL.filter(f => f !== 'basement')) expect(reached.some(spot => spot.floor === floor), floor).toBe(true);
  });

  it('walks between any two places, taking the stairs floor by floor', () => {
    for (const floors of [FULL, SMALL]) {
      const places = catPlaces(floors), levels = catFloors(floors);
      for (const from of places) for (const to of places) {
        if (from === to) continue;
        const steps = catRoute(from.from, to, floors);
        const last = steps[steps.length - 1];
        expect(last, `${from.id} to ${to.id}`).toMatchObject({ floor: to.floor, x: to.x, y: to.y });
        // One appearance per flight, each on the next floor up or down.
        const jumps = steps.filter(step => step.jump);
        expect(jumps.length).toBe(Math.abs(levels.indexOf(from.floor) - levels.indexOf(to.floor)));
        let floor: CatFloor = from.floor;
        for (const step of steps) {
          if (step.floor !== floor) {
            expect(step.jump, `${from.id} to ${to.id}`).toBe(true);
            expect(Math.abs(levels.indexOf(step.floor as CatFloor) - levels.indexOf(floor))).toBe(1);
            floor = step.floor as CatFloor;
          }
        }
        // Only the last stretch, onto a raised place, is jumped.
        expect(steps.slice(0, -1).some(step => step.hop)).toBe(false);
        expect(!!last.hop).toBe(!!to.hop);
      }
    }
  });

  it('climbs each flight from its foot and comes out of the roof at its door', () => {
    const wall = catPlaces(SMALL).find(place => place.id === 'roof/wall') as CatPlace;
    const up = catRoute('ground/a1', wall, SMALL), flight = stairsOf('ground')!;
    const jump = up.findIndex(step => step.jump);
    expect(up[jump - 2]).toMatchObject({ floor: 'ground', ...flight.foot });
    expect(up[jump - 1]).toMatchObject({ floor: 'ground', ...flight.top });
    expect(up[jump]).toMatchObject({ ...catNode(catEntry('roof')), jump: true });
    const seat = catPlaces(SMALL).find(place => place.id === 'ground/window-seat') as CatPlace;
    const down = catRoute('roof/wall', seat, SMALL), landing = down.findIndex(step => step.jump);
    expect(down[landing - 1]).toMatchObject(catNode(catEntry('roof')));
    expect(down[landing]).toMatchObject({ floor: 'ground', ...flight.top, jump: true });
    expect(down[landing + 1]).toMatchObject({ floor: 'ground', ...flight.foot });
  });

  it('gives each of the game\'s gift spots a place on a floor every café has', () => {
    expect(GIFT_PLACES).toHaveLength(GIFT_SPOTS.length);
    for (const place of GIFT_PLACES) {
      expect(SMALL).toContain(place.floor);
      // Clear of where cats sit, so a cat never hides a gift.
      for (const cat of catPlaces(SMALL)) expect(Math.hypot(cat.x - place.x, cat.y - place.y), cat.id).toBeGreaterThan(40);
    }
  });
});
