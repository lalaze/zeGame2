// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PARTNER_RECRUIT_COST, syncPartners } from '../game/partners';
import { openShop } from '../game/day';
import { Sim } from '../game/sim';
import { createInitialState } from '../game/state';
import { setLocale } from '../i18n';
import { showPartners, updatePartnersButton } from './partners';
import { closeModal } from './modal';

// Portraits need a real canvas; these tests are about the dialog's words.
vi.mock('../render/sprites', () => ({ character: () => ({ stand: {} }), toDataURL: () => 'data:,' }));
vi.mock('../render/fine-sprite-art', () => ({ fineSpriteArt: () => ({ canvas: {}, density: 1 }) }));

afterEach(() => { closeModal(); setLocale('en'); document.body.replaceChildren(); });

describe('Team HUD button', () => {
  it.each([['en', 'Team'], ['zh', '伙伴']] as const)('shows unread stories as a badge, never as part of the label, in %s', (locale, label) => {
    setLocale(locale);
    document.body.innerHTML = '<button id="partners-btn">Team</button>';
    const state = createInitialState(0); syncPartners(state);
    const [id] = Object.keys(state.partners.roster);
    updatePartnersButton(state);
    const button = document.getElementById('partners-btn')!;
    const badge = button.querySelector<HTMLElement>('[data-partner-unread]')!;
    expect(button.querySelector('[data-partner-label]')!.textContent).toBe(label);
    expect(badge.hidden).toBe(true);
    state.partners.roster[id].unlocked = 3;
    updatePartnersButton(state);
    expect(button.querySelector('[data-partner-label]')!.textContent).toBe(label);
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('3');
    expect(button.getAttribute('aria-label')).toContain('3');
  });
});

describe('Team dialog explanations', () => {
  const open = (state: ReturnType<typeof createInitialState>) => {
    document.body.innerHTML = '<main></main><div id="modal-root"></div>';
    let seed = 7; showPartners(state, new Sim(() => (seed = (seed * 16807) % 2147483647) / 2147483647), () => {});
    return document.querySelector<HTMLElement>('[role=dialog]')!;
  };
  it('says why recruiting is unavailable instead of only disabling the button', () => {
    const state = createInitialState(0); state.coins = 1000; syncPartners(state); openShop(state);
    const dialog = open(state);
    dialog.querySelector<HTMLButtonElement>('[data-partner-open="lin"]')!.click();
    const recruit = dialog.querySelector<HTMLButtonElement>('[data-partner-recruit="lin"]')!;
    expect(recruit.disabled).toBe(true);
    const reason = document.getElementById(recruit.getAttribute('aria-describedby')!)!;
    expect(reason.textContent).toBe('Recruiting opens after closing.');
  });
  it('names the missing money while closed, and explains an empty barista row', () => {
    const state = createInitialState(0); state.coins = PARTNER_RECRUIT_COST - 15; syncPartners(state);
    const dialog = open(state);
    expect(dialog.textContent).toContain('No barista slots yet');
    dialog.querySelector<HTMLButtonElement>('[data-partner-open="lin"]')!.click();
    const recruit = dialog.querySelector<HTMLButtonElement>('[data-partner-recruit="lin"]')!;
    expect(document.getElementById(recruit.getAttribute('aria-describedby')!)!.textContent).toBe('Need $15 more.');
  });
});
