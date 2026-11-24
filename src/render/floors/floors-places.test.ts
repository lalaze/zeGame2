import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCATION_IDS } from '../../game/locations';
import { FLOOR_WINDOWS, PLACE_WINDOWS, paintedPlace, placeGlass, placePictures, placeSky } from './floors-places';
import { SKY_NAMES } from './floors-sky-light';

const BUILD = 'assets/generated/floor-sample-v1/build/';
const manifest = JSON.parse(readFileSync(`${BUILD}places/places.json`, 'utf8'));

describe('the places of the branches', () => {
  it('have every light and both windows painted, but for the old town, which is the building\'s own sky', () => {
    const painted = LOCATION_IDS.map(paintedPlace).filter(place => place !== null);
    expect(paintedPlace('town')).toBeNull();
    expect(painted).toEqual(LOCATION_IDS.filter(id => id !== 'town'));
    expect([...manifest.places].sort()).toEqual([...painted].sort());
    for (const place of painted) {
      expect(placePictures(place)).toHaveLength(SKY_NAMES.length + 2);
      for (const key of placePictures(place)) expect(existsSync(`${BUILD}${key}.webp`), key).toBe(true);
      for (const light of SKY_NAMES) expect(placePictures(place)).toContain(placeSky(place, light));
      expect(placePictures(place)).toContain(placeGlass(place, '1f'));
    }
  });

  it('show through the windows where the build cut their glass', () => {
    expect(PLACE_WINDOWS).toEqual(manifest.windows);
    expect(Object.keys(FLOOR_WINDOWS).sort()).toEqual(['floor-2', 'floor-3', 'ground']);
  });
});
