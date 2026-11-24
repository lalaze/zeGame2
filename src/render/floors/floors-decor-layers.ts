// The stacking of the decorated floors' layers (build/decor), shared by the scene and the previews.
/**
 * Decor layers of the ground floor ('1f') and the seating floors ('2f'), from
 * scripts/art-gen/floor-decor-build.py: the fixed layers drawn behind and in front of people, and for
 * each decor slot the layer of each item. An item without a layer on a floor draws nothing there.
 */
export type DecorManifest = Partial<Record<DecorFloor, { back: string[]; front: string[]; slots: Record<string, Record<string, string>> }>>;
export type DecorFloor = '1f' | '2f';
/** Back to front: the room, then its surfaces, then what stands in it, then what hangs over it. */
export const BACK_LAYERS = ['shell', 'wallpaper', 'floor', 'rug', 'shadow', 'fixtures', 'tablecloth', 'centerpiece', 'neon', 'sill', 'curtain', 'ceiling'];
export const FRONT_LAYERS = ['counter', 'fixtures-front'];
/** Back layers stack from this depth up, a step apart. */
export const LAYER_DEPTH = -2, LAYER_STEP = .05;
/** In front of every back layer: a seating floor's stairs, then who is on the steps in their well. */
export const HALL_DEPTH = -1.3, IN_WELL_DEPTH = -1.2;
