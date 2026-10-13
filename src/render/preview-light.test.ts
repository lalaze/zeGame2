import { describe, expect, it } from 'vitest';
import { previewLightDate } from './preview-light';
describe('explicit isolated visual-light QA', () => {
  const now = new Date(2026, 9, 13, 22, 30);
  it('keeps ordinary and non-local runs on their real clock', () => {
    for (const href of ['https://example.com/?qa-light=10', 'http://localhost:5313/', 'bad']) expect(previewLightDate(now, href)).toBe(now);
  });
  it('accepts a visible localhost visual hour without mutating the supplied clock', () => {
    const light = previewLightDate(now, 'http://localhost:5313/?qa-light=10.5');
    expect([light.getHours(), light.getMinutes()]).toEqual([10, 30]);
    expect([now.getHours(), now.getMinutes()]).toEqual([22, 30]);
  });
  it('rejects empty, invalid and out-of-day values', () => {
    for (const value of ['', '-1', '24', 'NaN', 'Infinity']) expect(previewLightDate(now, `http://127.0.0.1/?qa-light=${value}`)).toBe(now);
  });
});
