// Pictures the ledger shows in the floors view (src/ui/icon-art.ts), from the floors art.
import type { IconArt } from '../../ui/icon-art';

/** Menu, pantry and upgrade icons painted for the floors (build/icons, floor-icons-build.py),
 * furniture as it stands in the building (build/furniture), decor options cut from their floor
 * (build/thumbs, floor-thumbs-build.py). Anything else keeps its drawn icon. */
export function floorsIconArt(base: string, furniture: Readonly<Record<string, unknown>> | null, thumbs: readonly string[], icons: readonly string[] = []): IconArt {
  const decor = new Set(thumbs), painted = new Set(icons);
  return key => {
    if (painted.has(key)) return `${base}icons/${key.replace(':', '-')}.webp`;
    const [kind, id] = key.split(':');
    if (kind === 'furniture' && furniture?.[id]) return `${base}furniture/${id}.webp`;
    if (kind === 'decor' && decor.has(id)) return `${base}thumbs/${id}.webp`;
    return undefined;
  };
}
