// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArrangeFocus } from './arrange-focus';
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function fixture() {
  document.body.innerHTML = '<section class="mobile-panel"><button data-tab="decor">Furnish</button><button data-place>Place</button></section><button id="done">Done</button>';
  const panel = document.querySelector('section')!;
  const place = panel.querySelector<HTMLButtonElement>('[data-place]')!;
  const done = document.getElementById('done')!;
  vi.spyOn(place, 'getClientRects').mockReturnValue([{ width: 44, height: 44 }] as unknown as DOMRectList);
  place.focus();
  return { panel, place, done, focus: new ArrangeFocus(panel, done) };
}
describe('mobile furnishing focus', () => {
  it('waits for map/pan to finish, then restores the trigger after Done', () => {
    const { focus, done, place } = fixture(); focus.capture(); place.blur();
    focus.update(true, false); expect(document.activeElement).not.toBe(done);
    focus.update(true, true); expect(document.activeElement).toBe(done);
    focus.update(false, true); expect(document.activeElement).toBe(place);
  });
  it.each(['hidden', 'disabled', 'removed'] as const)('falls back to Furnish after the last stored piece action is %s', mode => {
    const { focus, done, place, panel } = fixture(); focus.capture(); focus.update(true, true);
    if (mode === 'hidden') place.hidden = true;
    if (mode === 'disabled') place.disabled = true;
    if (mode === 'removed') place.remove();
    focus.update(false, false); expect(document.activeElement).toBe(done);
    focus.update(false, true); expect(document.activeElement).toBe(panel.querySelector('[data-tab=decor]'));
  });
  it('does not steal desktop focus or refocus every frame', () => {
    const { focus, panel, place, done } = fixture(); panel.classList.remove('mobile-panel');
    focus.capture(); focus.update(true, true); expect(document.activeElement).toBe(place);
    panel.classList.add('mobile-panel'); focus.capture(); focus.update(true, true); place.focus();
    focus.update(true, true); expect(document.activeElement).not.toBe(done);
  });
});
