// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MobileCafeHud } from './mobile-cafe-hud';
import { setLocale } from '../i18n';

let hud: MobileCafeHud;
let mobile = true;
let change: () => void;
const get = (id: string) => document.getElementById(id)!;
const button = (id: string) => get(id) as HTMLButtonElement;
beforeEach(() => {
  mobile = true; setLocale('zh');
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation(query => {
    const media = matchMedia(query);
    Object.defineProperty(media, 'matches', { get: () => mobile });
    change = () => { media.dispatchEvent(new Event('change')); };
    return media;
  });
  document.body.innerHTML = `<main id="app"><header id="old-header"><div id="money"></div><div id="people"><button id="regulars">熟客</button></div><button id="settings">···</button><button id="manage">管理</button></header>
    <div id="stage"><div id="day"><button id="speed">2×</button></div><button id="status">状态</button><button id="style">风格</button><button id="open">开门</button>
    <div id="zoom"><button id="minus">−</button><button id="overview">全景</button><button id="plus">+</button></div></div>
    <nav id="play"><button id="help">帮忙</button><button id="pantry">补货</button></nav></main>`;
  hud = new MobileCafeHud(get('app'), {
    money: get('money'), people: get('people'), settings: button('settings'), manage: button('manage'),
    day: get('day'), status: get('status'), style: get('style'), open: button('open'), zoom: get('zoom'),
    overview: button('overview'), help: button('help'), pantry: button('pantry'),
  });
});
afterEach(() => { hud.destroy(); vi.restoreAllMocks(); setLocale('en'); document.body.className = ''; });

it('keeps existing actions working, hides secondary controls, and restores their order on desktop', () => {
  const serve = vi.fn(); button('help').addEventListener('click', serve);
  expect(get('regulars').closest('[hidden]')?.id).toBe('mobile-cafe-tools');
  button('help').click(); expect(serve).toHaveBeenCalledOnce();
  hud.update('豆豆店', '第 1 天 · 08:00', false, '营业中');
  expect(get('help').hidden).toBe(false);
  hud.update('豆豆店', '第 2 天 · 休息中', true, '休息中');
  expect(get('help').hidden).toBe(true);
  mobile = false; change();
  expect(get('overview').parentElement).toBe(get('zoom'));
  expect([...get('zoom').children].map(el => el.id)).toEqual(['minus', 'overview', 'plus']);
  expect(get('zoom').parentElement).toBe(get('stage'));
  expect(get('manage').parentElement).toBe(get('old-header'));
  expect(get('help').parentElement).toBe(get('play')); expect(get('help').hidden).toBe(false);
  expect(button('settings').textContent).toBe('···');
  mobile = true; change();
  expect(get('overview').closest('.mobile-cafe-dock')).not.toBeNull();
  expect(document.querySelectorAll('#overview')).toHaveLength(1);
});

it('opens by clock or More and closes with Escape, backdrop, or a primary action', () => {
  button('mobile-cafe-more').click();
  expect(hud.expanded).toBe(true); expect(get('mobile-cafe-tools').hidden).toBe(false);
  expect(document.activeElement?.getAttribute('aria-label')).toBe('关闭店内操作');
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
  hud.handleKey(event); expect(event.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(button('mobile-cafe-more')); expect(hud.expanded).toBe(false);
  document.querySelector<HTMLButtonElement>('.mobile-cafe-clock')!.click();
  document.querySelector<HTMLButtonElement>('.mobile-tools-backdrop')!.click();
  expect(hud.expanded).toBe(false);
  button('mobile-cafe-more').click(); button('manage').click(); expect(hud.expanded).toBe(false);
});

it('retains the controls behind a dialog so its trigger can regain focus', () => {
  button('mobile-cafe-more').click();
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  const close = document.createElement('button'); overlay.append(close); document.body.append(overlay);
  close.addEventListener('click', () => overlay.remove()); close.click();
  expect(hud.expanded).toBe(true);
  setLocale('en'); hud.update('Bean', 'Day 1 · 08:00', false, 'Open');
  expect(button('mobile-cafe-more').textContent).toBe('More');
  expect(button('settings').textContent).toBe('Settings');
});
