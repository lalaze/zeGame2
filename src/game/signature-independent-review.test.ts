import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createInitialState } from './state';
import { menuItems } from './economy';
import { checkOpen, finishDay } from './day';
import { settlementAdvice } from './settlement-advice';
import { GOALS } from './goals';
import { bookPromotion } from './promotion';
import { trialSignature, saveSignature, setSignatureOnMenu } from './signature-drinks';
function onlySignature() {
 const s = createInitialState(0); s.coins = 1000; s.pantry.beans = 100;
 const trial = trialSignature(s, 'coffee', { beans: 1 });
 expect(trial.ok).toBe(true); expect(saveSignature(s, trial.id!, 'Only house drink')).toBe(true);
 expect(setSignatureOnMenu(s, trial.id!, true)).toBe(true); s.onMenu = []; return s;
}
describe('independent review: signature-only entry points', () => {
 it('can open and book a promotion with only a custom drink on the menu', () => {
  const s = onlySignature(); expect(menuItems(s)).toHaveLength(1); expect(checkOpen(s)).toEqual({ok:true});
  expect(bookPromotion(s, 'clipLocal')).toBe(true); expect(s.coins).toBe(940);
 });
 it('main entry uses the same effective menu as preparation and simulation', () => {
  const source = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
  expect(source).toMatch(/const menuEmpty = \(\) => (?:!menuItems\(state\)\.length|menuItems\(state\)\.length === 0);/);
 });
});

describe('independent review: fractional-stock settlement advice', () => {
 it('does not promise an unpurchasable fractional bean instead of emergency help', () => {
  const s = onlySignature(); s.goal = GOALS.length; s.pantry.beans = .75; s.coins = .25;
  const report = finishDay(s);
  expect(settlementAdvice(report, s).action.kind).toBe('emergency');
 });
 it('recognizes a listed custom recipe when recommending existing stock', () => {
  const s = onlySignature(); s.goal = GOALS.length; s.pantry.beans = 2; s.coins = 0;
  const report = finishDay(s);
  expect(settlementAdvice(report, s).action.kind).toBe('useStock');
 });
});
