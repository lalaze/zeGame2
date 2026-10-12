/** Walking art is authored head-left; upright/interaction art retains its seat-facing convention. */
export function residentCatFlipX(walking: boolean, facing: -1 | 1): boolean {
  return walking ? facing > 0 : facing < 0;
}
