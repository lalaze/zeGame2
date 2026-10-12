/** Read the page now: a release may arrive before the next simulation frame. */
export function cafeInteractionEnabled(sessionActive: boolean, modalOpen: boolean): boolean {
  return sessionActive && !modalOpen && !document.hidden
    && !document.getElementById('save-session-notice')
    && !document.querySelector('.onboard-overlay');
}
