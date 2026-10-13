/** Small in-world signage icons. Crisp integer geometry, no platform emoji. */
export type UiIconName = 'map' | 'arrow' | 'film' | 'spark';
const paths: Record<UiIconName, string> = {
  map: '<path fill="#39281f" d="M0 2h2V1h3V0h2v1h3v1h2V1h2V0h2v12h-2v1h-3v1H9v-1H6v-1H4v1H2v1H0z"/><path fill="#f4e6c7" d="M2 3h3v7H4v1H2zm5 0h2v1h2v7H9v-1H7zm6-1h1v9h-1v1h-1V3h1z"/><path fill="#c8a15e" d="M3 4h1v4H3zm5 1h1v4H8zm5-1h1v5h-1z"/>',
  arrow: '<path fill="#543425" d="M0 0h2v2h2v2h2v3H4v2H2v2H0V8h2V6h2V5H2V3H0z"/><path fill="#c8a15e" d="M0 0h1v2H0zm2 2h1v2H2zm2 2h1v2H4z"/>',
  film: '<path fill="#39281f" d="M2 2h12v12H2z"/><path fill="#f4e6c7" d="M3 3h10v10H3z"/><path fill="#627451" d="M6 4h2v1h2v1h2v3h-2v1H8v1H6z"/><path fill="#fff5dc" d="M3 3h10v1H3z"/><path fill="#c8a15e" d="M0 4h1v2H0zm0 5h1v2H0zm15-5h1v2h-1zm0 5h1v2h-1z"/>',
  spark: '<path fill="#39281f" d="M7 0h2v4h2v2h4v3h-4v2H9v4H7v-4H5V9H1V6h4V4h2z"/><path fill="#c8a15e" d="M7 3h2v3h3v2H9v3H7V8H4V6h3z"/><path fill="#f0ce85" d="M7 3h1v4H4V6h3z"/>',
};

export function uiIcon(name: UiIconName): string {
  const box = name === 'arrow' ? '0 0 7 11' : name === 'map' ? '0 0 16 14' : '0 0 16 16';
  return `<svg class="ui-pixel-icon" viewBox="${box}" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${paths[name]}</svg>`;
}
