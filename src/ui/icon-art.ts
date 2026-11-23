// Pictures the ledger shows instead of its drawn pixel icons. The floors view (?floors) supplies
// its own art here so the ledger matches the building; without a source every icon is drawn.

/** Icon keys start `kind:id`, as the ledger names them: `furniture:lamp`, `decor:wall_mint`,
 * `item:latte`. A tablecloth or centerpiece key also carries the table setting after the id. */
export type IconArt = (key: string) => string | undefined;

let source: IconArt | null = null;

export function setIconArt(art: IconArt | null): void {
  source = art;
}

/** The picture to show for this icon, if a source has one. */
export function iconArt(key: string): string | undefined {
  return source?.(key);
}
