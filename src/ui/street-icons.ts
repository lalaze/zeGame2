/** Tiny grid-aligned UI marks, never emoji/font glyphs or extra network assets. */
const paths = {
  left: 'M1 5h2V3h2V1h2v2H5v2h6v2H5v2h2v2H5V9H3V7H1z',
  right: 'M11 5H9V3H7V1H5v2h2v2H1v2h6v2H5v2h2V9h2V7h2z',
  down: 'M1 3h2v2h2v2h2V5h2V3h2v4H9v2H7v2H5V9H3V7H1z',
  lock: 'M3 1h6v2H7V2H5v1H3zm-1 2h2v3h4V3h2v3h1v5H1V6h1zm3 4v2h2V7z',
  flag: 'M2 1h2v10H2zm2 0h7v5H4zm0 7h3v1H4z',
  book: 'M1 1h4v1h2V1h4v9H7v1H5v-1H1zm2 2v5h2V3zm4 0v5h2V3z',
  close: 'M1 1h2v2h2v2h2V3h2V1h2v2H9v2H7v2h2v2h2v2H9V9H7V7H5v2H3v2H1V9h2V7h2V5H3V3H1z',
} as const;
export function streetIcon(name: keyof typeof paths): string {
  return `<svg class="street-ui-icon street-ui-icon-${name}" viewBox="0 0 12 12" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${paths[name]}"/></svg>`;
}
