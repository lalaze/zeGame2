/** Integer-grid silhouettes shared by the HUD and ledger. Decorative only: labels
 * and the original buttons/listeners remain the accessible interaction surface. */
export const GAME_ICONS = {
  menu: 'M2 4h9v2h3v5h-3v2H4v-1H2zm9 3v3h2V7zM1 14h12v1H1zM4 1h1v2H4zm4 0h1v2H8z',
  pantry: 'M2 2h4v2H2zm-1 3h6v10H1zm2 3v3h2V8zm7-7h4v2h-4zM9 4h6v11H9zm2 3v4h2V7z',
  upgrades: 'M2 1h2v4h3V1h2v6H7v2H6v6H3V9H2zm9 6h3v8h-3zM12 1h1v5h-1z',
  decor: 'M7 1h2v3h4v4H9v3h3v4H4v-4h3V9H2V5h4v3h1zm1 11H5v2h6v-2z',
  pets: 'M2 2h3v2h6V2h3v11h-2v2H4v-2H2zm2 5v2h2V7zm6 0v2h2V7zM7 10v2h2v-2z',
  promotion: 'M11 2h3v12h-3v-2H8v-1H6v4H3v-4H1V5h4V4h3V3h3zM3 7v2h3V7z',
  book: 'M1 2h6v1h2V2h6v12H9v1H7v-1H1zm2 2v8h4V4zm6 0v8h4V4z',
  map: 'M1 2h4v1h5V2h5v11h-4v1H6v-1H1zm2 2v7h2V4zm4 1v7h2V5zm4-1v7h2V4z',
  more: 'M2 2h4v4H2zm8 0h4v4h-4zM2 10h4v4H2zm8 0h4v4h-4z',
  settings: 'M6 1h4v2h3v3h2v4h-2v3h-3v2H6v-2H3v-3H1V6h2V3h3zm0 5v4h4V6z',
  people: 'M2 2h4v4H2zm8 0h4v4h-4zM1 8h6v6H1zm8 0h6v6H9z',
  star: 'M7 1h2v4h5v3h-2v2h1v4h-3v-2H6v2H3v-4h1V8H2V5h5z',
  coin: 'M4 1h8v2h2v2h1v6h-1v2h-2v2H4v-2H2v-2H1V5h1V3h2zm3 3v8h2V4z',
  close: 'M2 2h3v2h2v2h2V4h2V2h3v3h-2v2h-2v2h2v2h2v3h-3v-2H9v-2H7v2H5v2H2v-3h2V9h2V7H4V5H2z',
} as const;
export type GameIcon = keyof typeof GAME_ICONS;
export function gameIcon(element: HTMLElement, name: GameIcon): void {
  element.dataset.gameIcon = name;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill-rule="evenodd" d="${GAME_ICONS[name]}"/></svg>`;
  element.style.setProperty('--game-icon', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}

/** Move, never clone, live controls before MobileCafeHud records their homes. */
export function installGameChrome(root: HTMLElement): void {
  const toolbar = document.createElement('nav');
  toolbar.className = 'game-toolbelt';
  toolbar.setAttribute('aria-label', root.querySelector('#edge-tools')?.getAttribute('aria-label') ?? 'Café');
  for (const selector of ['#room-zoom-controls', '.cafe-status-bar', '#cafe-style-btn', '#settings-btn', '#panel-toggle']) {
    const control = root.querySelector<HTMLElement>(selector);
    if (control) toolbar.append(control);
  }
  root.append(toolbar);
  const icons: Record<string, GameIcon> = {
    '[data-play-help]': 'menu', '[data-play-pantry]': 'pantry',
    '#panel-toggle': 'book', '#settings-btn': 'settings', '#cafe-style-btn': 'decor',
    '#room-zoom-reset': 'map', '#open-btn': 'menu', '#reputation-btn': 'star',
    '#partners-btn': 'people', '#regular-guests-btn': 'people', '#coins': 'coin', '#drawer-balance': 'coin',
  };
  for (const [selector, name] of Object.entries(icons)) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) gameIcon(element, name);
  }
  for (const tab of root.querySelectorAll<HTMLElement>('[data-tab], [data-management-tab]')) {
    const name = (tab.dataset.tab ?? tab.dataset.managementTab) as GameIcon;
    if (name in GAME_ICONS) gameIcon(tab, name);
    // Old shortcut glyphs were platform-dependent; keep the translated name span.
    tab.querySelector('[aria-hidden="true"]')?.remove();
  }
}
