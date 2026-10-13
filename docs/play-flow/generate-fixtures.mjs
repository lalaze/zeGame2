// Synthetic disposable QA cafés. Never access a player's browser save.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({configFile:false, server:{middlewareMode:true}, appType:'custom'});
try {
  const {createInitialState,serialize,deserialize}=await server.ssrLoadModule('/src/game/state.ts');
  const {INGREDIENTS,MENU}=await server.ssrLoadModule('/src/game/data.ts');
  const {trialSignature,saveSignature,setSignatureOnMenu,makeSignatureId}=await server.ssrLoadModule('/src/game/signature-drinks.ts');
  const out='docs/play-flow/fixtures'; await mkdir(out,{recursive:true});
  const write=async(name,s)=>writeFile(`${out}/${name}.json`,serialize(deserialize(serialize(s),0)));
  await write('fresh',createInitialState(0));
  const s=createInitialState(0);s.profile={cafeName:'Play Flow QA',ownerName:'QA',look:{skin:0,hair:0,hairStyle:0,shirt:0,pants:0}};
  s.coins=10000;s.day=8;s.goal=15;s.kitchen=true;
  for(const m of MENU)s.items[m.id]=1;
  for(const i of INGREDIENTS)s.pantry[i.id]=100;
  s.onMenu=['espresso','roll'];s.bakePlan={roll:10};
  await write('advanced',s);
  const id=makeSignatureId('coffee',{beans:1,milk:2});
  if(!id||!trialSignature(s,'coffee',{beans:1,milk:2}).ok||!saveSignature(s,id,'Cloud Milk')||!setSignatureOnMenu(s,id,true))throw Error('Signature fixture setup failed');
  s.onMenu=[];s.pantry.milk=4;s.bakePlan={};
  await write('shortage',s);
  console.log('Fresh, synthetic advanced, and two-serving signature-shortage QA fixtures written.');
} finally { await server.close(); }
