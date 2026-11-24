// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { GAME_ICONS, gameIcon, installGameChrome } from './game-chrome';
import { MobileCafeHud } from './mobile-cafe-hud';
import { setLocale } from '../i18n';

afterEach(() => { document.body.innerHTML = ''; document.body.className = ''; vi.restoreAllMocks(); setLocale('en'); });
it('moves live controls into one toolbelt without cloning or dropping their events', () => {
  document.body.innerHTML = `<main id="app"><nav id="edge-tools" aria-label="经营"><button data-management-tab="menu"><span aria-hidden="true">☕</span><span>菜单</span></button></nav><button data-tab="menu">菜单</button><div id="room-zoom-controls"><button id="room-zoom-reset">街道</button></div><div class="cafe-status-bar"><button id="partners-btn">伙伴</button></div><button id="cafe-style-btn">风格</button><button id="settings-btn">设置</button><button id="panel-toggle">管理</button></main>`;
  const root = document.querySelector<HTMLElement>('#app')!;
  const button = root.querySelector<HTMLButtonElement>('#settings-btn')!;
  const click = vi.fn(); button.addEventListener('click', click);
  installGameChrome(root);
  expect(root.querySelector('.game-toolbelt #settings-btn')).toBe(button);
  button.click(); expect(click).toHaveBeenCalledOnce();
  expect(root.querySelectorAll('#settings-btn')).toHaveLength(1);
  expect(root.querySelector('[data-management-tab]')!.textContent).toBe('菜单');
  expect(root.querySelector('[data-management-tab]')!.getAttribute('data-game-icon')).toBe('menu');
  expect(root.querySelector('[data-tab]')!.getAttribute('data-game-icon')).toBe('menu');
});
it.each(Object.keys(GAME_ICONS) as (keyof typeof GAME_ICONS)[])('%s decoration survives label updates and adds no focus target', name => {
  const button = document.createElement('button'); button.textContent = '操作';
  gameIcon(button, name); button.textContent = 'Action';
  expect(button.textContent).toBe('Action'); expect(button.childElementCount).toBe(0);
  expect(button.dataset.gameIcon).toBe(name);
  const svg = decodeURIComponent(button.style.getPropertyValue('--game-icon'));
  expect(svg).toContain('viewBox="0 0 16 16"'); expect(svg).toContain('crispEdges');
  expect(svg).not.toMatch(/https?:\/\/(?!www.w3.org)|[\p{Extended_Pictographic}]/u);
});
it('mobile rotation returns controls to their new toolbelt homes and keeps icons, focus and listeners', () => {
  let mobile = false; const media = window.matchMedia('(max-width: 860px)');
  Object.defineProperty(media, 'matches', { get: () => mobile });
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  setLocale('zh');
  document.body.innerHTML = `<main id="app"><header><div id="money"></div><div class="cafe-status-bar" id="people"></div><button id="settings-btn">设置</button><button id="panel-toggle">管理</button></header><section><div id="day"></div><button id="status"></button><button id="cafe-style-btn">风格</button><button id="open-btn">准备菜单</button><div id="room-zoom-controls"><button id="room-zoom-reset">街道</button></div><button id="help"></button><button id="pantry"></button></section></main>`;
  const get = (id: string) => document.getElementById(id)!;
  const button = (id: string) => get(id) as HTMLButtonElement;
  installGameChrome(get('app'));
  const click = vi.fn(); button('room-zoom-reset').addEventListener('click', click);
  const hud = new MobileCafeHud(get('app'), {money:get('money'),people:get('people'),settings:button('settings-btn'),manage:button('panel-toggle'),day:get('day'),status:get('status'),style:get('cafe-style-btn'),open:button('open-btn'),zoom:get('room-zoom-controls'),overview:button('room-zoom-reset'),help:button('help'),pantry:button('pantry')});
  for (const next of [true, false, true, false]) {
    mobile = next; media.dispatchEvent(new Event('change'));
    expect(get('panel-toggle').closest(next ? '.mobile-cafe-dock' : '.game-toolbelt')).not.toBeNull();
    expect(get('room-zoom-reset').dataset.gameIcon).toBe('map');
    button('room-zoom-reset').click();
    expect(document.querySelectorAll('#room-zoom-reset')).toHaveLength(1);
  }
  expect(click).toHaveBeenCalledTimes(4); hud.destroy();
});
