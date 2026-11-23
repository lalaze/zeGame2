// The floors view's UI (?floors): the "paper journal" look the user chose on 2026-11-23 to go with
// the soft hand-drawn cross-section. floors-ui.css holds the look, scoped to body.floors-view, so
// the pixel view keeps its own; this file switches it on and supplies the line icons.
import './floors-ui.css';
import { onLocaleChange, t } from '../i18n';

type IconSpec = string | { fill: string };

/** Line icons on a 24-unit grid, stroked round at 1.9 units; `fill` shapes are painted solid.
 * Names follow the pixel HUD's icon names (data-game-icon), so its marks redraw in this set. */
export const FLOORS_ICONS = {
  map: 'M4.5 10.5h15V20h-15zM3.5 10.5l2-5.5h13l2 5.5M3.5 10.5c0 1.4 1.1 2.2 2.6 2.2s2.6-.8 2.6-2.2c0 1.4 1.1 2.2 2.7 2.2s2.6-.8 2.6-2.2c0 1.4 1.1 2.2 2.6 2.2s2.6-.8 2.6-2.2M10 20v-4.5h4V20',
  menu: 'M5 9.5h11V14a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 11h1.6a2.4 2.4 0 0 1 0 4.8H16M8.5 3.8c.8 1 .8 2 0 3M12 3.8c.8 1 .8 2 0 3',
  help: 'M12 20s-7.5-4.6-7.5-10A4 4 0 0 1 12 7.6a4 4 0 0 1 7.5 2.4c0 5.4-7.5 10-7.5 10z',
  book: 'M3.5 5.5c2.8-1.2 5.6-1.2 8.5.5v13.5c-2.9-1.7-5.7-1.7-8.5-.5zM20.5 5.5c-2.8-1.2-5.6-1.2-8.5.5v13.5c2.9-1.7 5.7-1.7 8.5-.5z',
  more: { fill: 'M7.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0zM13.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0zM19.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z' },
  pantry: 'M8 3.5h8V6H8zM7 6h10a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V7.5A1.5 1.5 0 0 1 7 6zM9 12.5h6',
  upgrades: 'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0zM12 16.5V8M8.5 11.2 12 7.8l3.5 3.4',
  decor: 'M5.5 11V8.3A2.3 2.3 0 0 1 7.8 6h8.4a2.3 2.3 0 0 1 2.3 2.3V11M3 12.2a2 2 0 0 1 4 0V14h10v-1.8a2 2 0 0 1 4 0V18H3zM5 18v1.8M19 18v1.8',
  pets: 'M5 20v-7.5L4 5.5l4.2 3h7.6l4.2-3-1 7V20zM9.3 13.2h.01M14.7 13.2h.01M11 16.5l1 .8 1-.8',
  promotion: 'M4 10v4.2h3l7.5 4.3V5.7L7 10zM17.5 9a4.2 4.2 0 0 1 0 6.2M7.5 14.2l1.2 4.3',
  coin: 'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0zM12 7.5v9M14.5 9.5c-.6-.8-1.5-1.2-2.6-1.2-1.4 0-2.4.8-2.4 1.9 0 2.6 5.2 1.4 5.2 4 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.2-.5-2.8-1.3',
  star: 'M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z',
  people: 'M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM3.5 19.5c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M15.5 5.2a2.8 2.8 0 0 1 0 5.6M16.8 14.2c2.2.5 3.7 2.5 3.7 5.3',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M18 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  chevron: 'M9.5 5.5 16 12l-6.5 6.5',
  wall: 'M3.5 11.5 12 4.5l8.5 7M6 9.5v10h12v-10M10 19.5v-5h4v5M14.5 10.5h2.5v2.5h-2.5z',
  clock: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 7.5V12l3 2',
  spark: 'M12 3.5l1.9 5.2 5.6.3-4.4 3.5 1.5 5.4L12 14.8 7.4 17.9l1.5-5.4L4.5 9l5.6-.3z',
} as const satisfies Record<string, IconSpec>;
export type FloorsIcon = keyof typeof FLOORS_ICONS;

/** The icon as a CSS url(), for a mask painted in the text colour. */
export function floorsIconUrl(name: FloorsIcon): string {
  const spec: IconSpec = FLOORS_ICONS[name];
  const shape = typeof spec === 'string'
    ? `<path d="${spec}" fill="none" stroke="#000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${spec.fill}"/>`;
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${shape}</svg>`)}")`;
}

/** Controls that always carry an icon here, whether or not the pixel HUD marked them. */
const ICON_HOMES: Record<string, FloorsIcon> = {
  '#room-zoom-reset': 'map', '#open-btn': 'menu', '#panel-toggle': 'book', '#mobile-cafe-more': 'more',
  '#coins': 'coin', '#drawer-balance': 'coin', '#drawer-close': 'close', '.mobile-tools-heading button': 'close',
  '#settings-btn': 'settings', '#cafe-style-btn': 'decor', '#reputation-btn': 'star',
  '#partners-btn': 'people', '#regular-guests-btn': 'people',
  '[data-tab="menu"]': 'menu', '[data-tab="pantry"]': 'pantry', '[data-tab="upgrades"]': 'upgrades',
  '[data-tab="decor"]': 'decor', '[data-tab="pets"]': 'pets', '[data-tab="promotion"]': 'promotion',
};

// ------------------------------------------------------------ the outer walls

/** Whether the building shows its front walls (seen from the street) or is cut open; kept on this device. */
export const OUTER_WALL_KEY = 'tiny-bean-cafe/floors-outer-wall';
let wallShown = false;
const wallListeners = new Set<(shown: boolean) => void>();

export function outerWallShown(): boolean {
  return wallShown;
}

export function setOuterWall(shown: boolean): void {
  if (shown === wallShown) return;
  wallShown = shown;
  try { localStorage.setItem(OUTER_WALL_KEY, shown ? '1' : '0'); } catch { /* storage blocked: the choice lasts this visit */ }
  labelWallButton();
  for (const listener of wallListeners) listener(shown);
}

/** Calls back whenever the walls are shown or hidden; returns the way to stop. */
export function onOuterWall(listener: (shown: boolean) => void): () => void {
  wallListeners.add(listener);
  return () => wallListeners.delete(listener);
}

function labelWallButton(): void {
  const button = document.getElementById('floors-wall-btn');
  if (!button) return;
  button.setAttribute('aria-pressed', String(wallShown));
  button.title = t(wallShown ? 'floors.wall.hide' : 'floors.wall.show');
  button.querySelector('span')!.textContent = t('floors.wall');
}

/** Switch the page to the floors look, with the outer walls' button under the money. */
export function installFloorsUi(root: HTMLElement = document.body): void {
  const doc = root.ownerDocument, body = doc.body;
  body.classList.add('floors-view');
  for (const name of Object.keys(FLOORS_ICONS) as FloorsIcon[]) body.style.setProperty(`--floors-icon-${name}`, floorsIconUrl(name));
  for (const [selector, name] of Object.entries(ICON_HOMES)) {
    for (const element of root.querySelectorAll<HTMLElement>(selector)) element.dataset.floorsIcon ??= name;
  }
  try { wallShown = localStorage.getItem(OUTER_WALL_KEY) === '1'; } catch { wallShown = false; }
  if (!doc.getElementById('floors-wall-btn')) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.id = 'floors-wall-btn';
    button.className = 'floors-wall-btn';
    button.dataset.floorsIcon = 'wall';
    button.append(doc.createElement('span'));
    button.addEventListener('click', () => setOuterWall(!wallShown));
    (doc.getElementById('app') ?? body).append(button);
    onLocaleChange(labelWallButton);
  }
  labelWallButton();
}
