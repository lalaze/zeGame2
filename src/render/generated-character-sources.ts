import { type GeneratedCatAdapter } from './generated-cat-art';
import { type GeneratedCustomerAdapter } from './generated-customer-art';
import { generatedMainKey, generatedMainSource, getGeneratedCustomerAdapter, getGeneratedStaffAdapter, getGeneratedCatAdapter,
  removeGeneratedMainSource } from './generated-main-art';
import { GENERATED_STAFF_FRAME_IDS, type GeneratedStaffAdapter } from './generated-staff-art';
import type { GeneratedServerAdapter } from './generated-server-art';
import { getGeneratedServerAdapter } from './generated-main-art';

export type GeneratedCharacterPack =
  | { readonly kind: 'staff'; readonly adapter: GeneratedStaffAdapter }
  | { readonly kind: 'server'; readonly adapter: GeneratedServerAdapter }
  | { readonly kind: 'customer'; readonly adapter: GeneratedCustomerAdapter }
  | { readonly kind: 'cat'; readonly adapter: GeneratedCatAdapter };

/** The small TextureManager surface needed here; no Phaser runtime import. */
export interface GeneratedSourceTextures {
  exists(key: string): boolean;
  /** Must destroy the original texture, not merely remove its lookup key. */
  remove(key: string): unknown;
}

/**
 * Call only after publishing the successfully baked adapter to the shared
 * registry. Its canvases and UI previews no longer need the full-resolution
 * source textures. An incomplete or superseded adapter never releases anything.
 *
 * Removes only source-pack keys, never canvas-* baked frames or room props.
 * Repeated calls are safe. A later clear/preload may install the sources again.
 * Returns the number of source IDs released from either cache.
 */
export function releaseGeneratedCharacterSources(pack: GeneratedCharacterPack, textures: GeneratedSourceTextures): number {
  const shared = pack.kind === 'staff' ? getGeneratedStaffAdapter() : pack.kind === 'server' ? getGeneratedServerAdapter() : pack.kind === 'customer' ? getGeneratedCustomerAdapter() : getGeneratedCatAdapter();
  if (!pack.adapter.ready || shared !== pack.adapter) return 0;
  const ids = pack.kind === 'staff' ? GENERATED_STAFF_FRAME_IDS : pack.kind === 'customer' ? pack.adapter.sourceFrameIds : pack.adapter.sourceFrameIds;
  let released = 0;
  for (const id of ids) {
    const key = generatedMainKey(id);
    const uploaded = textures.exists(key);
    const installed = !!generatedMainSource(id);
    // Destroy GPU/source ownership before dropping the registry's reference.
    // If destruction throws, that source stays registered and can be retried.
    if (uploaded) textures.remove(key);
    removeGeneratedMainSource(id);
    if (uploaded || installed) released++;
  }
  return released;
}
