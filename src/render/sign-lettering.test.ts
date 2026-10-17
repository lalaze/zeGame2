import { expect, it, vi } from 'vitest';
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

import { paintPixelSignText, pixelSignGlyph } from './sign-lettering';
it('uses bounded binary masks and preserves distinct supported accents', () => {
  const emoji=pixelSignGlyph('🐱'), han=pixelSignGlyph('𠮷');
  expect(emoji.width).toBe(12);expect(han.width).toBe(12);
  expect(pixelSignGlyph('é').bits).not.toEqual(pixelSignGlyph('è').bits);
  for(const mask of [emoji,han,pixelSignGlyph('é'),pixelSignGlyph('…')]) {
    expect(mask.bits.length).toBe(mask.width*mask.height);
    expect([...mask.bits].every(bit=>bit===0||bit===1)).toBe(true);
  }
});
it('paints native art pixels for long mixed-script names while respecting the fitted width', () => {
  const rects:number[][]=[];
  const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},fillStyle:'',fillRect(...args:number[]){rects.push(args);}} as unknown as CanvasRenderingContext2D;
  paintPixelSignText(ctx,'𠮷🐱 Tiny Bean Café 123456789',50.25,3,84,7,'#efdfbe');
  expect(rects.length).toBeGreaterThan(0);
  for(const [x,y,w,h] of rects) {
    expect([x,y,w,h].every(v=>Number.isInteger(v*2))).toBe(true);
    expect(w).toBe(.5);expect(h).toBe(.5);
    expect(x).toBeGreaterThanOrEqual(8);expect(x+w).toBeLessThanOrEqual(92.5);
    expect(y).toBeGreaterThanOrEqual(3);expect(y+h).toBeLessThanOrEqual(10);
  }
  // The existing OPEN plaque loses 10% of its width in the wall projection.
  // Its complete Chinese and English labels must fit without becoming an ellipsis.
  for(const [word,width] of [['营业中',23*.9],['OPEN',18*.9]] as const) {
    rects.length=0;
    paintPixelSignText(ctx,word,50,3,width,6,'#efdfbe');
    expect(rects.length).toBe([...word].reduce((sum,ch)=>sum+pixelSignGlyph(ch).bits.reduce((a,b)=>a+b,0),0));
  }
});

it('keeps the complete native Chinese glyph and removes intermediate raster alpha', () => {
  const data = new Uint8ClampedArray(24 * 32 * 4);
  data[(8 * 24 + 4) * 4 + 3] = 255;
  data[(19 * 24 + 5) * 4 + 3] = 255;
  data[(9 * 24 + 6) * 4 + 3] = 127;
  data[(9 * 24 + 7) * 4 + 3] = 128;
  const ctx = {font:'',textBaseline:'',fillStyle:'',fillText:vi.fn(),getImageData:()=>({data})};
  vi.stubGlobal('document', {
    fonts: new Set([{family:'"Pixel ZH"',status:'loaded'}]),
    createElement:()=>({width:16,height:16,getContext:()=>ctx}),
  });
  try {
    const mask = pixelSignGlyph('营');
    expect(mask.width).toBe(12);
    expect(mask.bits[11 * 12 + 5]).toBe(1);
    expect(mask.bits[12 + 6]).toBe(0);
    expect(mask.bits[12 + 7]).toBe(1);
    expect(ctx.font).toBe('12px "Pixel ZH"');
  } finally {vi.unstubAllGlobals();}
});

it('rasterises a non-subset café-name character with the platform CJK face, never a hex plaque', () => {
  const ctx={font:'',textBaseline:'',fillStyle:'',fillText:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray(24*32*4).fill(255)})};
  vi.stubGlobal('document',{fonts:new Set(),createElement:()=>({width:24,height:32,getContext:()=>ctx})});
  try {
    const mask=pixelSignGlyph('龘');
    expect(ctx.fillText).toHaveBeenCalledWith('龘',expect.any(Number),expect.any(Number));
    expect(ctx.font).toContain('PingFang SC');
    expect(mask.width).toBe(12);
    expect([...mask.bits].every(bit=>bit===0||bit===1)).toBe(true);
  } finally {vi.unstubAllGlobals();}
});
