// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { setLocale } from '../i18n';
import { closeModal } from './modal';
import { projectsEntryLabel, showRoomProjects, updateRoomProjectsBook } from './room-projects';
import { RegionsUI } from './regions';
vi.mock('../render/furniture-art', () => ({ furnitureIcon: () => ({ toDataURL: () => 'data:,' }) }));
afterEach(() => { closeModal(); document.body.replaceChildren(); setLocale('en'); vi.useRealTimers(); });

describe('room project book', () => {
  it('redirects old room navigation to the street map', () => {
    document.body.innerHTML = '<nav id="edges"></nav><div id="card"></div>';
    const s = createInitialState(0), select = vi.fn(), street = vi.fn();
    const regions = new RegionsUI(document.querySelector('#edges')!, document.querySelector('#card')!, () => s, select, vi.fn(), street);
    regions.select('observatory');
    expect(street).toHaveBeenCalledWith(true);
    expect(select).not.toHaveBeenCalled();
  });

  it('explains locked areas, buys production, keeps focus through countdowns and collects once', () => {
    vi.useFakeTimers(); vi.setSystemTime(0); setLocale('zh');
    document.body.innerHTML = '<div id="modal-root"></div>';
    const s = createInitialState(0); s.day = 3; s.coins = 10_000;
    const changed = vi.fn(); showRoomProjects(s, changed);
    expect(document.activeElement).toBe(document.querySelector('.modal-body'));
    expect(document.querySelectorAll('[data-project]')).toHaveLength(1);
    expect(document.body.textContent).not.toContain('先扩建');
    const card = document.querySelector('[data-project="postcards"]')!;
    card.querySelector<HTMLButtonElement>('[data-project-upgrade]')!.click();
    const mode = card.querySelector<HTMLButtonElement>('[data-project-mode="long"]')!;
    mode.focus(); vi.setSystemTime(10 * 60_000); updateRoomProjectsBook();
    expect(document.activeElement).toBe(mode);
    expect(projectsEntryLabel(s, Date.now())).toContain('1 处可以收获');
    const collect = card.querySelector<HTMLButtonElement>('[data-project-collect]')!;
    expect(collect.disabled).toBe(false); collect.click(); collect.click();
    expect(s.roomProjects.inspiration).toBe(1);
    expect(changed).toHaveBeenCalledTimes(2);
    closeModal(); updateRoomProjectsBook();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('returns to the street map from research and names insufficient inspiration', () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    document.body.innerHTML = '<div id="modal-root"></div>';
    const s = createInitialState(0); s.day = 3; s.coins = 10_000;
    const back = vi.fn(); showRoomProjects(s, vi.fn(), undefined, back);
    document.querySelector<HTMLButtonElement>('[data-project="postcards"] [data-project-upgrade]')!.click();
    expect(document.body.textContent).toContain('Need 15 more inspiration');
    document.querySelector<HTMLButtonElement>('.modal-actions button')!.click();
    expect(back).toHaveBeenCalledOnce();
    expect(s.construction).toEqual([]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
