import { expect, it } from 'vitest';
import { fitSignLabel } from './sign-lettering';
import { cleanName, createInitialState, serialize, deserialize } from '../game/state';
const measure = (text: string) => [...text].length * 7;
it('keeps short Chinese names intact', () => expect(fitSignLabel('小猫咖啡馆',84,measure)).toBe('小猫咖啡馆'));
it('bounds long names with an ellipsis without stretching', () => {
  const value = fitSignLabel('春天花园里的小猫和朋友们一起喝咖啡的地方',84,measure);
  expect(measure(value)).toBeLessThanOrEqual(84); expect(value.endsWith('…')).toBe(true);
});
it('preserves Unicode codepoints and removes control characters', () => {
  expect(fitSignLabel(' 猫🐱\n咖啡 ',84,measure)).toBe('猫🐱咖啡');
});
it('uses existing 20-codepoint name constraints without a new save field', () => {
  expect([...cleanName('咖'.repeat(30))]).toHaveLength(20);
  expect(fitSignLabel('<script>猫</script>',300,measure)).toBe('<script>猫</script>');
});

it('round-trips the existing profile, economy and player identity without migration', () => {
 const state = createInitialState(100);
 state.profile = { cafeName:'猫与朋友咖啡馆🐱',ownerName:'店主',look:{skin:1,hair:2,hairStyle:1,shirt:2,pants:1} };
 state.coins=1234.56;
 const restored=deserialize(serialize(state),100);
 expect(restored.profile).toEqual(state.profile); expect(restored.coins).toBe(state.coins);
});
it('leaves an older profile-less save on the existing onboarding path', () => {
 const state=createInitialState(100);
 expect(deserialize(serialize(state),100).profile).toBeNull();
});
