import type { GameState } from '../game/state';

const WALL_PALETTES: Readonly<Record<string, string>> = {
  wall_cream: 'classic',
  wall_mint: 'mint',
  wall_rose: 'rose',
  wall_dots: 'mint',
  wall_brick: 'terracotta',
  wall_walnut: 'walnut',
  wall_stars: 'midnight',
};

/** The wall is the room's dominant colour, even when fabrics are mixed.
 * Derive from equipped décor so old saves, reloads and free theme swaps agree. */
export function updateLedgerTheme(state: GameState): void {
  const theme = WALL_PALETTES[state.decor.equipped.wallpaper] ?? 'classic';
  const root = document.documentElement;
  if (root.dataset.ledgerTheme !== theme) root.dataset.ledgerTheme = theme;
}
