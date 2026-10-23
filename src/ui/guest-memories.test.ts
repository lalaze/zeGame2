// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../game/state';
import { Sim, type Customer } from '../game/sim';
import { openShop } from '../game/day';
import { CUSTOMER_CAST } from '../game/customer-cast';
import { makeSignatureId } from '../game/signature-drinks';
import { setLocale, t } from '../i18n';
import { guestMemoryNotes, guestMemoryReport } from './guest-memories';
import { showRecommendation } from './moments';
import { showRegularGuests } from './regular-guests';
import { closeModal, isModalOpen } from './modal';

vi.mock('../render/sprites', () => ({ character: () => ({ stand: document.createElement('canvas') }), toDataURL: () => 'data:image/png;base64,' }));
vi.mock('../render/fine-sprite-art', () => ({ fineSpriteArt: (canvas: HTMLCanvasElement) => ({ canvas, density: 1 }) }));

function cafe() {
  const s = createInitialState(123); s.day = 4; s.items.latte = 1; s.onMenu = ['espresso', 'latte']; s.pantry.milk = 10;
  return s;
}
function visitor(): Customer {
  const s = cafe(), sim = new Sim(() => .5); openShop(s);
  for (let n = 0; n < 1000 && !sim.customers.length; n++) sim.update(s, .05);
  return { ...sim.customers[0], phase: 'queue', order: 'espresso', extra: null, appearanceId: 11, look: { ...CUSTOMER_CAST[11].look } };
}
beforeEach(() => { document.body.innerHTML = '<button id="regular-guests-btn"></button><div id="modal-root"></div>'; });
afterEach(() => { closeModal(); setLocale('en'); document.body.replaceChildren(); });

describe.each(['en', 'zh'] as const)('recommendations and memories in %s', locale => {
  beforeEach(() => setLocale(locale));
  it('labels keeping the order, shows price/time and submits one deliberate choice', () => {
    const s = cafe(), before = structuredClone(s), pick = vi.fn(), skip = vi.fn();
    showRecommendation(s, visitor(), ['espresso', 'latte'], pick, skip);
    const original = document.querySelector<HTMLButtonElement>('[data-recommend-item="espresso"]')!;
    const alternative = document.querySelector<HTMLButtonElement>('[data-recommend-item="latte"]')!;
    expect(original.textContent).toContain(t('memory.keepOrder'));
    expect(alternative.textContent).toContain(t('memory.tryInstead'));
    expect(alternative.textContent).toContain('$10.00');
    expect(document.body.textContent).toContain(t('memory.recommendNote'));
    original.click(); original.click(); alternative.click();
    expect(pick).toHaveBeenCalledExactlyOnceWith('espresso'); expect(skip).not.toHaveBeenCalled();
    expect(isModalOpen()).toBe(false); expect(s).toEqual(before);
  });

  it('lets the player skip without recording a choice', () => {
    const s = cafe(), pick = vi.fn(), skip = vi.fn();
    showRecommendation(s, visitor(), ['espresso', 'latte'], pick, skip);
    document.querySelector<HTMLButtonElement>('.modal-actions button')!.click();
    expect(skip).toHaveBeenCalledOnce(); expect(pick).not.toHaveBeenCalled(); expect(s.guestMemories).toEqual({});
  });

  it('reveals only learned faces in the journal, with availability and actual return counts', () => {
    const s = cafe(); expect(guestMemoryNotes(s)).toBeNull(); expect(guestMemoryReport(s, 3)).toBeNull();
    s.guestMemories[11] = { item: 'latte', source: 'recommend', learnedDay: 2, lastServedDay: 3, returns: 1 };
    const before = structuredClone(s); showRegularGuests(s, vi.fn());
    const notes = document.querySelector<HTMLDetailsElement>('.guest-memories')!;
    expect(notes.open).toBe(false); expect(notes.querySelectorAll('[data-memory-guest]')).toHaveLength(1);
    expect(notes.textContent).toContain(t('memory.available'));
    expect(notes.textContent).toContain(t('memory.returned', { n: 1 }));
    expect(document.querySelector('[data-memory-guest="0"]')).toBeNull(); expect(s).toEqual(before);
    s.pantry.milk = 0;
    document.body.append(guestMemoryNotes(s)!);
    expect(document.body.lastElementChild!.textContent).toContain(t('memory.unavailable'));
  });

  it('summarizes delivered discoveries and returning favorites without changing accounts', () => {
    const s = cafe();
    s.guestMemories[11] = { item: 'latte', source: 'recommend', learnedDay: 2, lastServedDay: 3, returns: 1 };
    s.guestMemories[12] = { item: 'hotchoc', source: 'trial', learnedDay: 3, lastServedDay: 3, returns: 0 };
    const before = structuredClone(s); document.body.append(guestMemoryReport(s, 3)!);
    expect(document.body.textContent).toContain(t('memory.reportLearned', { n: 1 }));
    expect(document.body.textContent).toContain(t('memory.reportReturned', { n: 1 }));
    expect(document.body.textContent).toContain(t('memory.learned.trial', { day: 3 }));
    expect(document.querySelectorAll('[data-memory-guest]')).toHaveLength(2); expect(s).toEqual(before);
  });
});

it('renders a removed custom recipe’s historical name as text', () => {
  const s = cafe(), item = makeSignatureId('coffee', { beans: 1, milk: 1 })!;
  s.guestMemories[11] = { item, name: '<img src=x onerror=alert(1)>', source: 'recommend', learnedDay: 2, lastServedDay: 3, returns: 0 };
  document.body.append(guestMemoryNotes(s)!);
  expect(document.querySelectorAll('.guest-memory img')).toHaveLength(1); // Only the face portrait.
  expect(document.querySelector('.guest-memory h4')!.textContent).toBe('<img src=x onerror=alert(1)>');
  expect(document.body.textContent).toContain(t('memory.unavailable'));
});
