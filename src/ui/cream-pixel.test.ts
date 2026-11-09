// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../game/state';
import { updateLedgerTheme } from './ledger-theme';
import { showModal, closeModal } from './modal';
import { setLocale } from '../i18n';
afterEach(()=>{closeModal();document.body.replaceChildren();delete document.documentElement.dataset.ledgerTheme;setLocale('en');});
describe('cream pixel shared UI behaviour',()=>{
 it('retains every equipped wallpaper palette without mutating the save',()=>{
  const s=createInitialState(0);
  for(const [wallpaper,theme] of Object.entries({wall_cream:'classic',wall_mint:'mint',wall_rose:'rose',wall_brick:'terracotta',wall_walnut:'walnut',wall_stars:'midnight'})){
   s.decor.equipped.wallpaper=wallpaper;
   const before=JSON.stringify(s);updateLedgerTheme(s);
   expect(document.documentElement.dataset.ledgerTheme).toBe(theme);expect(JSON.stringify(s)).toBe(before);
  }
 });
 it('keeps actual confirm/cancel button semantics and Escape dismissal with native inputs',()=>{
  document.body.innerHTML='<div id="modal-root"></div>';setLocale('zh');
  let confirmed=0;
  showModal({onEscape:closeModal,title:'确认设置',body:'<label>名称<input value="小豆咖啡馆"></label>',buttons:[{label:'取消'},{label:'确认',primary:true,onClick:()=>confirmed++}]});
  const dialog=document.querySelector('[role="dialog"]')!;
  expect(dialog.querySelector('input')?.value).toBe('小豆咖啡馆');
  const buttons=[...dialog.querySelectorAll('button')];expect(buttons.map(b=>b.textContent)).toEqual(expect.arrayContaining(['取消','确认']));
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(confirmed).toBe(0);expect(document.querySelector('[role="dialog"]')).toBeNull();
 });
});
