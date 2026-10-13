import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../game/state';
import { Sim } from '../game/sim';
import { setLocale } from '../i18n';
import { pantryTaskContext } from './play-flow-context';
afterEach(() => setLocale('en'));
describe('live pantry notice wording', () => {
  it.each(['en', 'zh'] as const)('does not claim missing stock was replenished when closing takes priority (%s)', locale => {
    setLocale(locale);
    const state = createInitialState(0); state.phase = 'open'; state.pantry.beans = 0;
    const sim = new Sim(() => .5);
    expect(pantryTaskContext(state, sim, true).ingredients).toEqual(['beans']);
    state.phase = 'closing';
    const notice = pantryTaskContext(state, sim, true);
    expect(notice.detail).toContain(locale === 'en' ? 'Closing' : '正在收尾');
    expect(state.pantry.beans).toBe(0);
    expect(notice.title).not.toContain(locale === 'en' ? 'Missing' : '不足');
  });
  it('updates stale shortage context after an ordinary stock purchase without promising every future order', () => {
    const state = createInitialState(0); state.phase = 'open'; state.pantry.beans = 0;
    const sim = new Sim(() => .5);
    expect(pantryTaskContext(state, sim, true).ingredients).toEqual(['beans']);
    state.pantry.beans = 10;
    const notice = pantryTaskContext(state, sim, true);
    expect(notice.ingredients).toEqual([]);
    expect(notice.detail).toContain('current stock');
    expect(notice.title).toBe('Quick pantry visit');
  });
});
