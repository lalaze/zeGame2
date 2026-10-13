// Disposable QA fixtures only. Never read or write the player's browser save.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
try {
 const {createInitialState,serialize,deserialize}=await server.ssrLoadModule('/src/game/state.ts');
 const {INGREDIENTS}=await server.ssrLoadModule('/src/game/data.ts');
 const s=createInitialState(0);s.profile={cafeName:'Signature QA',ownerName:'QA',look:{skin:0,hair:0,hairStyle:0,shirt:0,pants:0}};
 s.coins=10000;s.day=8;s.goal=15;s.kitchen=true;
 for(const id of ['espresso','americano','latte','blacktea','hotchoc','lemontea','chai','fruittea','matcha','roll','donut'])s.items[id]=1;
 for(const i of INGREDIENTS)s.pantry[i.id]=100;
 s.onMenu=['espresso','roll'];s.bakePlan={roll:10};
 const out='docs/signature-drinks/fixtures';await mkdir(out,{recursive:true});
 await writeFile(`${out}/research.json`,serialize(deserialize(serialize(s),0)));
 console.log('Wrote isolated research fixture with unlocked ingredients and known pantry100.');
} finally {await server.close();}
