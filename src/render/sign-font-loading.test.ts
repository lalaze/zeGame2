import {afterEach, expect, it, vi} from 'vitest';
import {loadSignFonts} from './sign-lettering';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('uses platform lettering when a font request never settles, without blocking renderer creation', async()=>{
 vi.useFakeTimers();vi.stubGlobal('document',{fonts:{load:vi.fn(()=>new Promise(()=>{}))}});
 let ready=false;const font=loadSignFonts().then(()=>{ready=true;});
 await vi.advanceTimersByTimeAsync(2000);expect(ready).toBe(true);await font;expect(vi.getTimerCount()).toBe(0);
});

it('releases the fallback timer after a prompt font load or a failed font download',async()=>{
 vi.useFakeTimers();for(const load of [()=>Promise.resolve([]),()=>Promise.reject(new Error('offline'))]){
  vi.stubGlobal('document',{fonts:{load}});await loadSignFonts();expect(vi.getTimerCount()).toBe(0);
 }
});
