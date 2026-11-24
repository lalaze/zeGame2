// The app's face in the building: the painted icon beside the café's name and the paper-journal
// loading screen with its painted picture. index.html switches the loading screen on before the
// first paint and names the icons in public/ (copies of build/app, as the README of
// assets/generated/floor-sample-v1 says); this does the rest once the script has loaded. The pixel
// view (`?pixel`) keeps the page's own loader. The pictures are built by scripts/art-gen/floor-app-build.py.
import './floors-identity.css';

export const FLOORS_APP_ART = `${import.meta.env.BASE_URL}assets/generated/floor-sample-v1/build/app/`;
/** The paper journal's page colour, for the browser's own chrome around the page. */
export const FLOORS_THEME = '#fbf3e4';

/** Switches the page to the floors view's icon and loading screen. Safe to call more than once. */
export function installFloorsIdentity(doc: Document = document, art: string = FLOORS_APP_ART): void {
  const { body } = doc;
  // The loading screen is styled from the first moment, before the building's own setup adds the class.
  body.classList.add('floors-view');
  // Absolute, so the stylesheets that use them cannot resolve them against their own address.
  const absolute = (name: string) => new URL(`${art}${name}`, doc.baseURI).href;
  body.style.setProperty('--floors-loading-art', `url("${absolute('loading.webp')}")`);
  body.style.setProperty('--floors-app-icon', `url("${absolute('icon-192.png')}")`);
  const tab = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (tab) { tab.type = 'image/png'; tab.href = `${art}favicon.png`; }
  const touch = doc.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (touch) touch.href = `${art}apple-touch-icon.png`;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', FLOORS_THEME);
  for (const image of doc.querySelectorAll<HTMLImageElement>('img.brand-icon')) image.src = `${art}icon-192.png`;
}
