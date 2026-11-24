// The starter themes' pictures in the opening flow. The floors view supplies its own room here
// (render/floors/floors-theme-preview.ts); without a source the page draws the pixel room.
export type ThemeArt = (themeId: string) => HTMLCanvasElement;

let source: ThemeArt | null = null;

export function setThemeArt(art: ThemeArt | null): void {
  source = art;
}

/** The picture of a starter theme, if a source has one. */
export const themeArt = (themeId: string): HTMLCanvasElement | undefined => source?.(themeId);
