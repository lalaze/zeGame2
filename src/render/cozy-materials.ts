import { GENERATED_DECOR_CATALOG, type GeneratedDecorMeta, type GeneratedDecorSourceId } from './generated-decor-art';
import counterMetadata from './cozy-counter-metadata.json';

export const COZY_MATERIAL_IDS = ['wall_cream', 'wall_mint', 'wall_rose', 'wall_dots', 'wall_brick', 'wall_walnut', 'wall_stars', 'floor_checker', 'floor_planks', 'floor_mint', 'floor_terrazzo', 'floor_herringbone', 'floor_marble'] as const;
export const COZY_MATERIAL_ASSETS = {
  ...Object.fromEntries(COZY_MATERIAL_IDS.map(id => [`decor-${id}-tile`, `cozy-world-v2/${id}.png`])) as Record<`decor-${typeof COZY_MATERIAL_IDS[number]}-tile`, string>,
  ...Object.fromEntries(Object.keys(counterMetadata).map(id => [`decor-${id}`, `cozy-world-v2/decor-${id}.png`])) as Record<`decor-${keyof typeof counterMetadata}`, string>,
};

/** New sheets own their repeat geometry, independently of archived source dimensions. */
export const COZY_DECOR_CATALOG: Readonly<Partial<Record<GeneratedDecorSourceId, GeneratedDecorMeta>>> = { ...Object.fromEntries(
  COZY_MATERIAL_IDS.map(id => {
    const key = `${id}-tile` as GeneratedDecorSourceId;
    return [key, { ...GENERATED_DECOR_CATALOG[key], size: [256, 256],
      estimatedSourcePeriod: [256, 256], nominalMotifUnitFromLegacy: [48, 48] }];
  }),
), ...counterMetadata as unknown as Record<keyof typeof counterMetadata, GeneratedDecorMeta> };
