// What the floors view (?floors) tells the page about its cats: their painted portraits for the
// pet panel, what each is doing in the building, and how to bring the building to one. Like
// icon-art.ts, only the floors view fills this in (render/floors/floors-cats.ts); without a source
// the page shows its pixel portraits and the pixel rooms' cats.
import type { CatId } from '../game/pets';
import type { LivingCatView } from './living-cats';

export interface CatSource {
  /** The painted portrait of a breed, if there is one. */
  portrait(id: CatId): string | undefined;
  /** What a resident is doing in the building, in the pet panel's terms. */
  view(id: CatId): LivingCatView | undefined;
  /** Brings the building to a resident; false if it isn't drawn. */
  locate(id: CatId): boolean;
}

let source: CatSource | null = null;

export function setCatSource(cats: CatSource | null): void {
  source = cats;
}

export const catPortrait = (id: CatId): string | undefined => source?.portrait(id);
export const catView = (id: CatId): LivingCatView | undefined => source?.view(id);
export const locateCat = (id: CatId): boolean => source?.locate(id) ?? false;
