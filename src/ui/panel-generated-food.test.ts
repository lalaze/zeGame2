// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { setLocale } from '../i18n';
import { Panel } from './panel';
const art = vi.hoisted(() => ({ sources: new Map<string, HTMLCanvasElement>(), serial: 0, encode: vi.fn() }));
vi.mock('../render/sprites', () => ({
  ingredientIcon: () => document.createElement('canvas'),
  itemArtwork: (id: string) => {
    if (!art.sources.has(id)) art.sources.set(id, document.createElement('canvas'));
    return art.sources.get(id);
  },
  upgradeIcon: () => document.createElement('canvas'),
  catFrames: () => ({ idle: document.createElement('canvas') }),
  toDataURL: (canvas: HTMLCanvasElement, scale: number) => {
    art.encode(canvas, scale); return `data:image/png;base64,frame${++art.serial}`;
  },
}));
vi.mock('../render/decor-art', () => ({ decorIcon: () => document.createElement('canvas') }));
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => document.createElement('canvas') }));
beforeEach(() => { setLocale('en'); art.sources.clear(); art.encode.mockClear(); document.body.replaceChildren(); });
function open() {
  document.body.innerHTML = `<section id="panel"><nav role="tablist"><button role="tab" data-tab="menu">Menu</button></nav>
    <div class="buy-amount"><button data-amount="1">1</button></div><div class="pantry-amount"></div>
    <div class="menu-filter"><button data-cat="all">All</button></div><div id="list"></div><div id="goal"></div></section>`;
  const state = createInitialState(0);
  const panel = new Panel(document.querySelector('#panel')!, document.querySelector('#list')!, document.querySelector('#goal')!, state, vi.fn(), vi.fn());
  panel.showTab('menu');
  const icon = () => document.querySelector<HTMLImageElement>('.row img.icon')!;
  return { panel, icon };
}
it('refreshes an already-open item icon when fallback becomes generated and on reload/clear', () => {
  const { panel, icon } = open();
  const first = icon().src;
  const old = art.sources.get('espresso')!;
  art.sources.set('espresso', document.createElement('canvas')); panel.update();
  const generated = icon().src; expect(generated).not.toBe(first);
  art.sources.set('espresso', document.createElement('canvas')); panel.update();
  expect(icon().src).not.toBe(generated);
  art.sources.set('espresso', old); panel.update();
  expect(icon().src).toBe(first);
});
it('does not re-encode or rewrite a stable item canvas during repeated panel updates', () => {
  const { panel, icon } = open();
  const source = art.sources.get('espresso')!;
  const count = () => art.encode.mock.calls.filter(([canvas]) => canvas === source).length;
  const before = count(), url = icon().src;
  for (let i = 0; i < 10; i++) panel.update();
  expect(count()).toBe(before); expect(icon().src).toBe(url);
});
