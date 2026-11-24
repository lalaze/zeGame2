// Where a branch stands (game/locations.ts), as the building shows it: the backdrop behind the roof in
// every light, and what is seen through the rooms' windows. The old town is the building's own sky; the
// other places' pictures are build/places (scripts/art-gen/floor-places-build.py), loaded for the place
// the café is in and drawn by floors-sky.ts.
import type { LocationId } from '../../game/locations';
import type { FloorId } from './floors-layout';
import { SKY_NAMES, type SkyName } from './floors-sky-light';

export type PaintedPlace = Exclude<LocationId, 'town'>;
export type PlaceWindow = '1f' | '2f';
/** The glass of the rooms' windows on their layers (build/places/places.json); the ground floor's layer is the side window. */
export const PLACE_WINDOWS: Record<PlaceWindow, { x: number; y: number; width: number; height: number }> = {
  '2f': { x: 133, y: 107, width: 112, height: 387 },
  '1f': { x: 140, y: 94, width: 127, height: 320 },
};
/** The window each floor has. */
export const FLOOR_WINDOWS: Partial<Record<FloorId, PlaceWindow>> = { 'floor-3': '2f', 'floor-2': '2f', ground: '1f' };

export const paintedPlace = (location: LocationId): PaintedPlace | null => (location === 'town' ? null : location);
/** Texture keys, which are the files under build/ without their extension. */
export const placeSky = (place: PaintedPlace, light: SkyName): string => `places/${place}/${light}`;
export const placeGlass = (place: PaintedPlace, window: PlaceWindow): string => `places/${place}/glass-${window}`;
export const placePictures = (place: PaintedPlace): string[] =>
  [...SKY_NAMES.map(light => placeSky(place, light)), ...(Object.keys(PLACE_WINDOWS) as PlaceWindow[]).map(window => placeGlass(place, window))];
/** Where the moon and the sun hang over a place: clear of the landmark at its left edge and of the roof. */
export const PLACE_DISC = { x: 336, row: 212 } as const;
