// Original café production props, authored directly on the 96-art-pixel world grid.
// Seasonal changes describe working states, tooling and ingredients, not badge overlays.
import {createPainter} from './build-seasonal-reserve-art.mjs';
const GROUPS = [
 ['workshop-coffee','咖啡萃取','Coffee extraction',[
 ['burr-grinder','锥刀磨豆机','Burr grinder'],['milk-pitcher','拉花缸','Milk pitcher'],['tamper','压粉器','Coffee tamper'],['knock-box','敲渣盒','Knock box'],['espresso-scale','萃取电子秤','Espresso scale'],['syphon','虹吸咖啡器','Coffee syphon'],['moka-pot','八角摩卡壶','Octagonal moka pot'],['coldbrew-tower','冷萃滴滤塔','Cold brew tower']]],
 ['workshop-roasting','烘豆工坊','Roasting workshop',[
 ['drum-roaster','滚筒烘豆机','Drum roaster'],['cooling-sieve','咖啡豆冷却筛','Bean cooling sieve'],['green-bean-sack','生豆麻袋','Green bean sack'],['roast-tray','分级焙豆盘','Roast grading tray'],['bean-scoop','咖啡豆铲','Bean scoop'],['sample-trier','烘豆取样器','Roast sample trier'],['bean-sorting-board','生豆分选板','Bean sorting board'],['chaff-bin','银皮收集箱','Chaff collector']]],
 ['workshop-preparation','面点工具','Pastry preparation',[
 ['rolling-pin','擀面杖','Rolling pin'],['balloon-whisk','球形打蛋器','Balloon whisk'],['stand-mixer','立式厨师机','Stand mixer'],['dough-scraper','切面刮板','Dough scraper'],['pastry-brush','糕点刷','Pastry brush'],['flour-sifter','手摇面粉筛','Flour sifter'],['piping-bag','裱花袋','Piping bag'],['dough-docker','面团打孔滚轮','Dough docker']]],
 ['workshop-molds','模具烤具','Molds and bakeware',[
 ['loaf-mold','长方吐司模','Loaf mold'],['muffin-pan','玛芬连模','Muffin pan'],['bundt-mold','环形咕咕霍夫模','Bundt mold'],['proofing-basket','藤纹发酵篮','Proofing basket'],['cooling-rack','方格冷却架','Cooling rack'],['baking-sheet','浅沿烤盘','Baking sheet'],['springform-pan','活底圆模','Springform pan'],['cookie-cutters','压饼模具组','Cookie cutters']]],
 ['workshop-ingredients','备料食材','Prepared ingredients',[
 ['flour-sack','折口面粉袋','Flour sack'],['butter-dish','切块黄油碟','Butter dish'],['dough-ball','醒发面团','Resting dough'],['yeast-bottle','酵母培养瓶','Yeast culture bottle'],['egg-crate','鸡蛋分格盒','Egg crate'],['cocoa-canister','可可原料筒','Cocoa canister'],['vanilla-tubes','香草荚管架','Vanilla pod tubes'],['nut-hopper','坚果配料斗','Nut ingredient hopper']]],
 ['workshop-organization','计量与整理','Measuring and organization',[
 ['dial-scale','指针厨师秤','Dial kitchen scale'],['measuring-jug','刻度量杯','Measuring jug'],['measuring-spoons','量匙串','Measuring spoon set'],['kitchen-timer','机械计时器','Mechanical kitchen timer'],['thermometer','糖浆温度计','Sugar thermometer'],['utensil-rail','厨具横架','Utensil rail'],['spice-drawer','香料抽屉柜','Spice drawer cabinet'],['towel-roller','厨房布巾卷架','Kitchen towel roller']]],
];
export const PACK={id:'workshop-reserve-v1',titleZh:'咖啡烘焙工坊储备',titleEn:'Coffee and Bakery Workshop Reserve',categories:GROUPS.map(([id,nameZh,nameEn])=>({id,nameZh,nameEn})),catalog:GROUPS.flatMap(([category,,,items])=>items.map(([id,nameZh,nameEn])=>({id:`workshop-${id}`,nameZh,nameEn,category,tags:['workshop','production','native-96','seasonal-tooling']}))),variants:[{id:'spring',nameZh:'春日',nameEn:'Spring'},{id:'summer',nameZh:'夏日',nameEn:'Summer'},{id:'autumn',nameZh:'秋日',nameEn:'Autumn'},{id:'winter',nameZh:'冬日',nameEn:'Winter'}]};
export function paintSprite(palette,base,variantIndex){
 const s=((variantIndex%4)+4)%4,p=createPainter(palette),{color:C,put,rect:R,line:L,ellipse:E,poly:P,box:B}=p;
 const ink=C('walnut',0),wd=C('oak',1),w=C('oak',3),wl=C('oak',5),iv=C('porcelain',2),id=C('porcelain',0),hi=C('porcelain',3),mt=C('steel',2),md=C('steel',0),ml=C('steel',4),g=C('brass',3),gd=C('brass',1),sg=C('sage',3),sd=C('sage',0),sl=C('sage',4),a=[C('cloth-5',1),C('cloth-6',1),C('terracotta',2),C('cloth-1',1)][s];
 const steel=(x,y,z,h)=>B(x,y,z,h,mt,md,ml);
 const wood=(x,y,z,h)=>{B(x,y,z,h,w,wd,wl);if(z>20){L(x+4,y+5,x+z-7,y+5,C('oak',2));L(x+7,y+h-4,x+z-4,y+h-4,wl);}};
 const bean=(x,y,r=4,green=false)=>{E(x,y,r,r*.65,green?sg:wd,green?sd:ink,green?sl:w);L(x-1,y-1,x+1,y+1,green?sd:ink);};
 const beans=(x,y,n,green=false)=>{for(let i=0;i<n;i++)bean(x+(i%4)*8+(Math.floor(i/4)%2)*2,y+Math.floor(i/4)*6,3,green);};
 const tray=(x,y,z=52,h=22)=>{P([[x,y+6],[x+8,y],[x+z,y],[x+z-5,y+h],[x,y+h]],mt,md,ml);P([[x+4,y+7],[x+10,y+3],[x+z-4,y+3],[x+z-8,y+h-4],[x+4,y+h-4]],iv,id,hi);};
 const disk=(x,y,r=10)=>{E(x,y,r,r,iv,id,hi);E(x,y,r-3,r-3,hi,iv);};
 const cloth=(x,y,z=26,h=15)=>{P([[x,y],[x+z,y-2],[x+z-2,y+h],[x+z-8,y+h-2],[x+3,y+h]],a,md,iv);L(x+4,y+2,x+4,y+h-2,hi);L(x+8,y+2,x+8,y+h-2,iv);};
 const scoop=(x,y,len=20)=>{E(x,y,9,5,mt,md,ml);E(x,y-1,6,3,id,md,hi);P([[x+6,y],[x+len,y-7],[x+len+3,y-3],[x+8,y+3]],w,wd,wl);};
 const knob=(x,y,r=4)=>E(x,y,r,r,g,gd,hi);
 const handle=(x,y,z=12,h=18)=>{B(x,y,z,h,mt,md,ml);B(x+3,y+3,z-6,h-6,null);};
 const cylinder=(x,y,z,h,fill=mt,shade=md,light=ml)=>{B(x-z,y,z*2,h,fill,shade,light);E(x,y+h,z,4,fill,shade,light);E(x,y,z,4,light,shade,hi);};
 const ticks=(x,y,n=5)=>{for(let i=0;i<n;i++)L(x,y+i*5,x+(i%2?4:7),y+i*5,md);};
 const board=()=>{P([[17,65],[26,54],[77,54],[82,68],[75,79],[20,79]],w,wd,wl);L(26,73,68,73,C('oak',2));};
 const dough=(x,y,r=12)=>{E(x,y,r,r*.6,iv,id,hi);for(let i=0;i<3;i++)L(x-r+5+i*5,y-3,x-r+3+i*5,y+1,id);};
 const crumbs=(x,y,n=8)=>{for(let i=0;i<n;i++)R(x+(i*7)%22,y+Math.floor(i/4)*4,2,1,wl);};
 E(48,80,29,3,id,undefined,undefined,id);E(50,80,20,2,C('hair-option-0',1),undefined,undefined,C('hair-option-0',1));
 switch(base.id.replace(/^workshop-/,'')){
 case 'burr-grinder': {
  wood(28,71,41,8);B(33,36,31,37,a,sd,iv);P([[32,18],[66,18],[60,37],[39,37]],iv,id,hi);E(49,18,17,5,mt,md,ml);E(49,19,12,3,wd);beans(40,17,3+s);B(43,46,27,5,mt,md,ml);knob(38,44,3);steel(55,50,7,9);cylinder(54,65,10,8);E(54,64,8,2,wd);if(s===0){L(47,15,47,10,md,2);wood(47,9,22,4);knob(68,8,3);}if(s===1){steel(25,46,7,23);ticks(26,49,4);}if(s===2){wood(28,58,18,13);knob(36,63,2);}if(s===3){B(39,21,23,8,iv,id,hi);L(42,25,57,25,md);steel(65,57,8,17);}break;}
 case 'milk-pitcher': {
  handle(66,38,13,27);P([[29,34],[59,34],[70,26],[64,64],[59,77],[32,77],[27,67]],mt,md,ml);E(46,35,18,5,ml,md,hi);E(46,35,14,3,s===2?wd:iv);L(33,42,32,63,hi,2);ticks(51,48,4);if(s===0){E(45,35,8,2,hi);L(40,35,50,35,id);}if(s===1){for(let i=0;i<3;i++)B(35+i*7,32,5,5,hi,id,iv);L(61,43,68,16,wd,2);}if(s===2){L(45,35,39,20,wd,3);L(49,35,44,19,w,2);}if(s===3){B(28,51,37,13,a,md,iv);L(33,55,57,55,hi);steel(58,19,4,20);knob(60,18,4);}break;}
 case 'tamper': {
  wood(24,70,49,9);E(48,68,19,6,mt,md,ml);steel(38,58,20,10);P([[40,57],[43,39],[38,28],[42,22],[54,22],[59,29],[53,40],[56,57]],s===2?w:a,wd,iv);E(48,24,8,4,wl,wd,iv);if(s===0){steel(21,53,11,16);L(23,55,29,55,hi);}if(s===1){E(68,65,9,5,md,ink,ml);for(let i=0;i<4;i++)L(63+i*3,62,63+i*3,50,ml);}if(s===2){P([[62,58],[72,58],[75,71],[59,71]],iv,id,hi);beans(62,60,2);}if(s===3){E(28,64,9,7,mt,md,ml);E(28,64,5,3,wd);L(28,64,34,61,hi);}break;}
 case 'knock-box': {
  P([[22,40],[68,36],[77,46],[73,76],[25,77]],a,md,iv);E(48,43,25,8,mt,md,ml);E(48,43,20,5,ink);L(28,41,68,46,wd,5);L(29,41,67,46,w,2);for(let i=0;i<s+1;i++)E(37+i*8,48+(i%2)*4,6,3,wd,ink,w);L(29,54,29,68,iv,2);if(s===0)steel(64,55,8,15);if(s===1){handle(74,49,8,18);B(31,62,29,6,mt,md,ml);}if(s===2){wood(17,60,6,16);L(20,58,20,43,wd,3);for(let i=0;i<5;i++)L(16+i*2,43,16+i*2,48,wl);}if(s===3){P([[26,34],[62,29],[69,34],[31,39]],mt,md,ml);knob(47,29,3);}break;}
 case 'espresso-scale': {
  P([[20,56],[28,47],[71,47],[79,57],[74,77],[23,77]],a,md,iv);P([[27,55],[32,51],[66,51],[71,55],[68,64],[29,64]],mt,md,ml);B(30,67,22,6,sd,ink,sg);for(let i=0;i<3;i++){R(33+i*6,69,3,1,sl);R(35+i*6,70,1,2,sl);}knob(62,70,2);knob(69,70,2);if(s===0){E(47,46,15,5,mt,md,ml);E(47,46,11,3,wd);beans(38,44,3);}if(s===1){B(36,37,22,15,iv,id,hi);ticks(49,38,3);R(38,45,18,6,C('cloth-6',2));}if(s===2){E(46,49,14,6,w,wd,wl);E(46,44,12,5,wd,ink,w);}if(s===3){steel(36,33,8,18);steel(48,39,8,12);knob(40,33,2);knob(52,39,2);}break;}
 case 'syphon': {
  wood(23,75,52,6);steel(66,20,4,56);L(49,27,67,27,md,3);E(47,55,17,17,iv,id,hi);P([[33,54],[62,54],[59,64],[52,69],[42,69],[35,64]],wd,ink,w);E(47,28,12,16,iv,id,hi);R(44,39,6,9,mt);E(47,30,9,3,s===0?sg:wd);L(39,19,38,28,hi,2);cylinder(47,73,9,4,g,gd,hi);if(s===0){L(69,38,78,39,wd,3);knob(78,39,3);}if(s===1){B(38,17,6,6,hi,id,iv);B(48,21,6,5,hi,id,iv);steel(70,53,5,18);}if(s===2){E(47,12,12,3,w,wd,wl);L(36,44,58,44,g,2);}if(s===3){P([[39,73],[47,64],[55,73]],g,gd,hi);B(31,48,5,17,a,md,iv);}break;}
 case 'moka-pot': {
  handle(65,30,15,26);P([[30,48],[63,48],[69,71],[63,78],[29,78],[24,70]],mt,md,ml);P([[28,25],[64,25],[62,45],[55,51],[34,51],[29,43],[19,30]],mt,md,ml);P([[28,25],[36,18],[58,18],[65,25]],ml,md,hi);knob(46,17,4);L(39,29,37,46,hi);L(51,52,55,74,md,2);L(35,52,32,73,hi,2);L(28,49,63,49,wd,2);if(s===0){L(23,32,18,26,ml,3);E(18,25,3,2,wd);}if(s===1){P([[30,27],[40,27],[37,45],[34,48],[31,41]],ml,undefined,undefined,ml);P([[41,27],[52,27],[54,47],[39,48]],mt,undefined,undefined,mt);P([[53,27],[62,27],[60,44],[55,48]],md,undefined,undefined,md);L(39,28,37,44,hi);L(31,29,32,39,iv);P([[31,52],[40,52],[38,75],[30,75],[27,69]],ml,undefined,undefined,ml);P([[41,52],[51,52],[54,75],[39,75]],mt,undefined,undefined,mt);P([[53,52],[61,52],[66,69],[61,75],[56,75]],md,undefined,undefined,md);L(34,54,31,70,hi);L(40,54,39,72,ml);L(55,54,59,72,md,2);L(30,76,61,76,md);E(58,59,3,3,gd,md,g);put(57,58,hi);B(44,65,6,3,ml,md,ml);L(45,66,48,66,md);}if(s===2){wood(68,59,9,15);L(72,58,73,40,wd,2);}if(s===3){B(26,59,39,11,a,md,iv);for(let x=30;x<62;x+=6)L(x,60,x,68,hi);}break;}
 case 'coldbrew-tower': {
  wood(25,75,47,6);for(const x of [28,65])wood(x,14,4,63);wood(25,17,46,4);wood(25,43,46,4);E(47,25,13,14,iv,id,hi);E(47,25,10,3,C('cloth-6',2));for(let i=0;i<2+s%2;i++)B(39+i*6,18+i%2*3,5,5,hi,id,iv);L(47,38,47,44,g,2);P([[38,46],[57,46],[54,58],[41,58]],mt,md,ml);E(47,47,9,3,wd);L(47,58,47,63,wd);cylinder(47,67,11,7,iv,id,hi);E(47,68,9,2,wd);if(s===0){knob(60,39,3);L(48,39,59,39,g);}if(s===1){steel(73,29,4,22);ticks(74,31,4);}if(s===2){B(37,49,20,5,w,wd,wl);beans(40,49,2);}if(s===3){B(33,22,4,14,a,md,iv);B(59,22,4,14,a,md,iv);wood(33,11,30,4);}break;}
 case 'drum-roaster': {
  steel(23,73,51,6);B(25,36,39,37,a,sd,iv);E(49,43,23,22,mt,md,ml);E(49,43,17,16,wd,ink,w);E(49,43,12,11,mt,md,ml);E(49,43,6,6,ink);L(49,43,58,36,ml,2);P([[34,17],[56,17],[53,28],[39,28]],g,gd,hi);steel(43,28,6,6);E(61,67,20,7,mt,md,ml);E(61,67,16,4,wd);beans(49,65,4+s);B(26,55,12,13,iv,id,hi);knob(32,60,3);if(s%2===1){steel(69,22,7,24);steel(67,20,13,4);}if(s===2){L(40,43,20,47,wd,3);wood(15,45,9,5);}if(s===3){steel(26,21,5,20);L(23,21,33,21,ml,2);}break;}
 case 'cooling-sieve': {
  handle(11,45,12,12);handle(74,45,12,12);E(48,62,28,13,mt,md,ml);B(20,47,56,15,mt,md,ml);E(48,47,28,11,ml,md,hi);E(48,48,24,8,wd);beans(31,44,8+s*2,s===0);for(let x=26;x<74;x+=5)L(x,61,x,66,md);if(s===1){L(48,48,68,38,ml,2);knob(69,37,4);}if(s===2){scoop(64,39,14);}if(s===3){steel(27,70,5,8);steel(65,70,5,8);L(47,48,47,30,g,2);knob(47,29,3);}break;}
 case 'green-bean-sack': {
  P([[29,28],[62,26],[69,40],[74,70],[66,78],[29,78],[23,69],[26,42]],iv,id,hi);E(46,29,19,6,w,wd,wl);E(46,29,15,3,sd);beans(34,27,4+s,true);L(29,42,32,68,id);L(65,42,62,71,id);B(32,48,27,14,a,sd,iv);bean(45,55,7,true);for(let y=36;y<75;y+=5){put(26,y,wd);put(67,y+1,wd);}if(s===0){P([[30,25],[35,20],[55,20],[62,26]],iv,id,hi);}if(s===1)scoop(64,65,15);if(s===2){wood(17,52,8,22);L(20,52,22,33,wd,2);}if(s===3){P([[27,27],[44,19],[65,27],[61,36]],a,md,iv);L(33,31,59,29,wd,2);}break;}
 case 'roast-tray': {
  tray(17,44,65,31);for(let i=1;i<3;i++)L(20+i*20,49,20+i*20,70,md,2);for(let q=0;q<3;q++)for(let j=0;j<3+s%2;j++)bean(27+q*20+(j%2)*7,52+Math.floor(j/2)*9,4,q===0&&s===0);if(s===1){P([[25,34],[42,31],[45,42],[28,44]],iv,id,hi);L(29,37,38,36,md);}if(s===2)scoop(61,34,15);if(s===3){L(23,37,70,32,ml,3);wood(70,29,12,5);}break;}
 case 'bean-scoop': {
  P([[22,56],[29,38],[51,37],[63,52],[55,70],[31,76],[20,68]],mt,md,ml);P([[26,55],[32,43],[48,42],[57,52],[51,65],[31,69]],id,md,hi);P([[52,43],[74,20],[81,22],[79,30],[60,52]],w,wd,wl);beans(29,53,4+s,s===0);L(33,45,43,44,hi);if(s===1){L(70,26,76,29,iv,2);L(69,29,74,32,iv,2);}if(s===2){wood(60,66,16,8);bean(67,67,4);}if(s===3){P([[60,35],[65,30],[73,36],[68,41]],a,md,iv);L(74,19,78,14,wd);E(78,13,4,3,w,wd,wl);}break;}
 case 'sample-trier': {
  P([[19,67],[54,32],[62,39],[27,73]],mt,md,ml);P([[24,65],[53,37],[57,40],[27,68]],wd,ink,w);for(let i=0;i<3+s;i++)bean(28+i*5,62-i*5,3,s===0);P([[55,32],[69,17],[79,22],[63,41]],w,wd,wl);L(65,24,72,20,wl,2);if(s===1){E(70,65,10,7,mt,md,ml);E(70,65,7,4,wd);}if(s===2){P([[19,74],[37,69],[40,76],[23,79]],iv,id,hi);R(25,74,7,1,wd);}if(s===3){L(44,49,56,60,g,2);L(56,60,63,56,g,2);knob(64,55,3);}break;}
 case 'bean-sorting-board': {
  board();P([[21,57],[28,32],[69,32],[77,57]],w,wd,wl);for(let j=0;j<3;j++)L(27,39+j*7,70,39+j*7,wd);for(let i=0;i<7+s;i++)bean(31+i%5*8,39+Math.floor(i/5)*10,3,(i+s)%3!==0);if(s===0){B(29,63,23,8,iv,id,hi);bean(40,67,4,true);}if(s===1){scoop(62,65,14);}if(s===2){L(75,43,82,63,wd,3);for(let i=0;i<4;i++)L(78+i,61,76+i,69,wl);}if(s===3){B(30,28,38,6,iv,id,hi);L(35,31,58,31,md);}break;}
 case 'chaff-bin': {
  P([[27,31],[67,31],[72,75],[23,75]],mt,md,ml);E(47,31,20,6,ml,md,hi);E(47,31,16,3,wd);crumbs(36,30,10+s);L(31,40,28,68,hi,2);for(let x=36;x<65;x+=7)L(x,42,x+1,67,md);if(s===0){handle(68,41,10,19);}if(s===1){P([[25,25],[65,22],[72,27],[30,31]],mt,md,ml);knob(47,22,3);}if(s===2){B(33,48,24,12,a,md,iv);R(38,53,14,2,hi);}if(s===3){steel(19,56,7,19);wood(19,37,7,20);L(24,35,32,31,wd,2);}break;}
 case 'rolling-pin': {
  board();P([[26,56],[57,29],[68,40],[36,68]],w,wd,wl);E(27,57,7,6,w,wd,wl);E(62,34,7,6,wl,wd,iv);P([[18,62],[26,56],[32,61],[23,70]],wd,ink,w);P([[65,30],[74,21],[80,26],[71,36]],wd,ink,wl);L(35,52,57,34,wl,2);if(s===0)dough(53,67,13);if(s===1){P([[37,63],[67,58],[71,69],[41,75]],iv,id,hi);for(let x=45;x<67;x+=7)L(x,64,x+2,69,id);}if(s===2){for(let i=0;i<3;i++)E(51+i*8,68,5,4,iv,id,hi);}if(s===3){cloth(21,70,23,8);R(41,39,4,4,iv);R(49,46,4,3,iv);}break;}
 case 'balloon-whisk': {
  P([[54,36],[68,18],[75,22],[60,42]],w,wd,wl);for(const q of [0,1,2]){P([[55-q*3,35],[62,43+q*2],[53,62+q*3],[38-q*4,70],[29,63-q*3],[34+q*2,46]],mt,md,ml);P([[54-q*3,39],[58,44+q*2],[50,59+q*3],[39-q*3,65],[33,60-q*2],[37+q*2,48]],null,undefined,undefined,null);}L(30,61,58,38,ml);if(s===0){E(34,67,8,3,iv,id,hi);}if(s===1){B(63,58,14,17,iv,id,hi);E(70,59,7,3,hi,id);E(70,60,5,2,g);}if(s===2){L(44,51,50,54,wd,2);L(35,58,40,61,wd,2);scoop(69,70,10);}if(s===3){cloth(20,72,37,7);L(66,21,71,25,iv,2);L(62,27,67,31,iv,2);}break;}
 case 'stand-mixer': {
  if(s===1){
   // Raised motor nose exposes the coupling and balloon wires above the cream.
   B(27,69,49,10,a,sd,iv);B(60,30,15,39,a,sd,iv);
   P([[27,19],[65,19],[76,28],[73,35],[25,35],[20,29],[22,23]],a,sd,iv);
   L(28,22,62,22,iv,2);L(26,33,58,33,sd);knob(65,28,4);steel(32,34,9,5);
   P([[22,53],[60,53],[57,68],[48,74],[33,74],[25,67]],mt,md,ml);
   E(41,53,19,6,ml,md,hi);E(41,53,15,3,iv,id,hi);E(47,53,7,3,hi,id,iv);E(31,54,5,2,hi,id,iv);
   L(36,39,36,44,ink,3);L(36,39,36,44,ml);B(33,43,7,3,mt,md,ml);
   L(33,46,28,50,md);L(28,50,31,54,md);L(31,54,36,56,md);
   L(39,46,45,50,md);L(45,50,42,54,md);L(42,54,36,56,md);
   L(35,46,32,50,ml);L(32,50,36,55,ml);L(38,46,41,50,md);L(41,50,36,55,md);
   L(36,46,36,54,md);L(29,50,31,52,hi);
   L(25,56,31,58,ml);L(31,58,51,58,hi);L(51,58,57,55,md);L(28,62,30,67,hi,2);
   break;
  }
  B(27,69,49,10,a,sd,iv);B(60,32,15,39,a,sd,iv);P([[27,24],[66,24],[76,33],[72,42],[25,42],[20,36],[22,29]],a,sd,iv);L(29,28,62,28,iv,2);knob(65,33,4);steel(33,41,5,13);P([[22,53],[60,53],[57,68],[48,74],[33,74],[25,67]],mt,md,ml);E(41,53,19,6,ml,md,hi);E(41,53,15,3,s===2?wd:iv);if(s===0){L(34,47,29,55,ml);L(36,47,43,55,ml);}if(s===1){E(36,52,8,3,hi,id,iv);E(47,53,7,3,hi,id,iv);}if(s===2){L(36,43,45,48,md,2);L(45,48,37,56,md,2);}if(s===3){P([[23,46],[57,46],[61,51],[20,51]],iv,id,hi);steel(56,43,7,6);}break;}
 case 'dough-scraper': {
  board();P([[29,40],[59,31],[72,63],[40,74]],mt,md,ml);P([[27,39],[30,31],[56,23],[63,31],[61,37],[34,46]],w,wd,wl);L(35,44,45,66,hi,2);for(let i=0;i<4;i++)L(48+i*5,63-i*2,48+i*5,66-i*2,md);if(s===0)dough(29,64,10);if(s===1){for(let i=0;i<3;i++)dough(25+i*10,73,6);}if(s===2){E(65,70,11,4,wd,ink,w);crumbs(23,69,6);}if(s===3){cloth(21,59,16,14);L(31,33,56,26,iv);}break;}
 case 'pastry-brush': {
  board();P([[40,52],[59,21],[66,24],[49,58]],w,wd,wl);P([[33,47],[49,54],[45,64],[28,56]],mt,md,ml);P([[28,56],[45,64],[37,76],[19,68]],s===3?a:iv,id,hi);for(let i=0;i<5;i++)L(28+i*3,59+i,23+i*3,68+i,id);if(s===0){E(64,65,12,7,iv,id,hi);E(64,64,8,4,g,gd,hi);}if(s===1){E(65,64,13,8,iv,id,hi);E(65,63,9,4,C('gingham',1));L(22,68,36,73,C('gingham',1),2);}if(s===2){E(67,62,11,6,w,wd,wl);E(67,61,8,3,wd);L(22,69,36,74,wd,2);}if(s===3){B(61,52,13,19,iv,id,hi);E(67,52,7,3,hi,id);L(62,23,63,16,wd);E(63,15,3,3,w,wd,wl);}break;}
 case 'flour-sifter': {
  handle(67,38,14,24);cylinder(47,38,22,33);E(47,38,18,5,iv,id,hi);L(31,47,31,63,hi,2);for(let x=32;x<65;x+=4)L(x,65,x+2,68,md);L(47,40,47,29,md,2);L(47,29,62,29,md,2);knob(63,28,4);if(s===0){P([[32,37],[44,29],[59,37]],iv,id,hi);}if(s===1){E(47,39,10,3,iv,id,hi);L(27,57,65,57,g);}if(s===2){E(47,37,15,4,wd,ink,w);scoop(23,69,14);}if(s===3){cloth(25,69,43,9);P([[29,31],[62,31],[65,35],[26,35]],ml,md,hi);knob(45,30,3);}break;}
 case 'piping-bag': {
  board();P([[28,24],[56,20],[69,35],[58,56],[44,69],[30,52]],iv,id,hi);P([[43,65],[51,61],[47,76],[40,79]],mt,md,ml);L(33,29,36,49,hi,2);L(57,29,49,55,id);P([[29,24],[22,17],[34,18],[43,13],[49,21]],iv,id,hi);L(29,24,50,22,a,3);if(s===0){E(66,69,7,3,iv,id,hi);E(66,66,5,3,hi,id,iv);}if(s===1){E(68,69,8,3,a,md,iv);E(68,65,6,3,a,md,iv);E(68,62,3,2,hi,id,iv);}if(s===2){P([[59,70],[64,61],[70,70]],mt,md,ml);P([[72,72],[76,64],[80,72]],mt,md,ml);}if(s===3){B(34,39,22,9,a,md,iv);for(let i=0;i<3;i++)E(61+i*7,72,4,3,iv,id,hi);}break;}
 case 'dough-docker': {
  board();P([[28,55],[50,33],[65,47],[42,68]],mt,md,ml);E(32,59,9,7,mt,md,ml);E(59,40,9,7,ml,md,hi);for(let i=0;i<4;i++)for(let j=0;j<3;j++)L(31+i*6+j*4,55-i*5+j*3,29+i*6+j*4,50-i*5+j*3,md,2);L(62,44,72,41,md,3);L(72,41,79,27,md,3);wood(76,19,7,12);if(s===0)dough(59,69,12);if(s===1){P([[23,68],[44,65],[50,74],[24,77]],iv,id,hi);for(let x=28;x<45;x+=5)put(x,72,id);}if(s===2){B(47,57,5,8,a,md,iv);crumbs(60,69,8);}if(s===3){cloth(18,65,22,12);L(48,48,54,52,iv,2);}break;}
 case 'loaf-mold': {
  P([[20,47],[36,35],[77,35],[73,65],[59,78],[23,74]],mt,md,ml);P([[25,47],[38,39],[71,39],[60,58],[26,66]],wd,ink,w);L(62,59,60,74,md,2);if(s===0){P([[28,46],[38,40],[67,40],[58,58],[28,63]],iv,id,hi);L(35,48,55,46,id);}if(s===1){for(let i=0;i<3;i++)dough(35+i*10,52-i*3,9);}if(s===2){P([[26,46],[36,33],[68,32],[64,47],[55,58],[28,64]],w,wd,wl);for(let i=0;i<4;i++)L(33+i*7,42,36+i*7,49,wd);}if(s===3){P([[25,43],[41,32],[78,32],[61,48]],ml,md,hi);steel(41,35,22,3);}break;}
 case 'muffin-pan': {
  tray(16,36,67,41);for(let j=0;j<2;j++)for(let i=0;i<3;i++){const x=31+i*18,y=47+j*18;E(x,y,8,6,md,ink,ml);if(s!==3){E(x,y-2,6,5,s===2?w:iv,s===2?wd:id,s===2?wl:hi);if(s===1){E(x-2,y-3,2,2,C('gingham',1));E(x+2,y,2,2,C('gingham',1));}if(s===2)L(x-3,y-3,x+3,y,wd);}else{E(x,y,6,4,iv,id,hi);E(x,y,3,2,md);}}if(s===3)cloth(27,23,38,10);break;}
 case 'bundt-mold': {
  E(48,63,29,15,mt,md,ml);for(let i=0;i<8;i++){let x=23+i*7;P([[x,47],[x+5,44],[x+8,68],[x+3,74]],mt,md,ml);}E(48,46,29,13,ml,md,hi);E(48,46,23,9,s===2?w:id,s===2?wd:md,s===2?wl:hi);E(48,45,9,9,mt,md,ml);E(48,44,5,5,wd);if(s===0){for(let i=0;i<6;i++)E(29+i*7,48+(i%2)*4,3,2,iv,id,hi);}if(s===1){for(const x of [29,40,58,66])E(x,47,3,3,C('gingham',1));}if(s===3){P([[25,40],[31,33],[44,34],[45,39]],iv,id,hi);scoop(69,73,12);}break;}
 case 'proofing-basket': {
  E(48,62,29,15,w,wd,wl);for(let y=56;y<74;y+=4)L(24,y,71,y,wd);E(48,51,29,12,wl,wd,iv);for(let r=23;r>8;r-=4)E(48,51,r,r*.36,w,wd,wl);if(s===0)dough(48,49,19);if(s===1){dough(39,49,11);dough(56,50,11);}if(s===2){dough(48,48,20);for(let i=0;i<4;i++)L(35+i*7,44,38+i*7,51,wd);}if(s===3){cloth(25,43,45,25);L(32,48,65,46,hi);L(33,55,64,53,iv);}break;}
 case 'cooling-rack': {
  steel(20,72,4,7);steel(73,72,4,7);P([[20,49],[31,33],[79,33],[76,72],[20,72]],mt,md,ml);P([[24,50],[34,37],[75,37],[72,68],[24,68]],null,undefined,undefined,null);for(let x=29;x<74;x+=7)L(x,40,x-2,69,md);for(let y=43;y<69;y+=6)L(24,y,75,y,ml);if(s===0){for(let i=0;i<3;i++)dough(34+i*14,52,8);}if(s===1){for(const x of [34,53,68]){E(x,53,7,5,w,wd,wl);E(x,52,3,2,C('gingham',1));}}if(s===2){P([[33,43],[59,39],[66,47],[63,59],[37,63]],w,wd,wl);for(let i=0;i<3;i++)L(40+i*6,44,43+i*6,53,wd);}if(s===3){for(let j=0;j<2;j++)for(let i=0;i<3;i++){E(35+i*14,48+j*14,5,4,w,wd,wl);L(32+i*14,48+j*14,38+i*14,48+j*14,iv);}}break;}
 case 'baking-sheet': {
  tray(15,34,69,42);if(s===0){for(let i=0;i<4;i++)P([[25+i*12,48],[34+i*12,46],[37+i*12,61],[27+i*12,64]],iv,id,hi);}if(s===1){for(let i=0;i<3;i++){E(32+i*17,54,7,8,w,wd,wl);E(32+i*17,51,4,4,C('gingham',1));}}if(s===2){for(let i=0;i<3;i++)P([[26+i*16,44],[37+i*16,44],[40+i*16,65],[28+i*16,65]],w,wd,wl);}if(s===3){P([[23,42],[72,40],[70,68],[25,69]],iv,id,hi);for(let i=0;i<4;i++){let x=31+i*11;P([[x,46],[x+5,52],[x+2,59],[x-4,58],[x-5,51]],w,wd,wl);}}break;}
 case 'springform-pan': {
  cylinder(47,43,27,24);E(47,43,23,8,s===0?iv:s===1?a:s===2?w:md,s===2?wd:id,s===2?wl:hi);steel(65,52,12,13);knob(73,58,3);L(28,49,28,62,hi,2);if(s===0){L(30,42,60,42,id);L(36,46,55,46,id);}if(s===1){for(let i=0;i<5;i++)E(32+i*7,42+i%2*3,3,3,C('gingham',1));}if(s===2){for(let i=0;i<3;i++)L(34+i*9,39,39+i*9,45,wd);}if(s===3){E(47,31,24,7,mt,md,ml);E(47,31,20,4,ml,md,hi);L(25,31,20,47,md,2);}break;}
 case 'cookie-cutters': {
  board();const shapes=[[[0,-11],[10,-4],[7,9],[-7,9],[-10,-4]],[[0,-10],[9,-6],[11,4],[0,10],[-10,3],[-9,-7]],[[-10,-8],[10,-8],[10,8],[-10,8]],[[0,-12],[4,-4],[12,-3],[6,3],[8,11],[0,7],[-8,11],[-6,3],[-12,-3],[-4,-4]]];for(let j=0;j<3;j++){const x=31+j*17,y=52+(j%2)*11,pts=shapes[(s+j)%4];P(pts.map(([dx,dy])=>[x+dx,y+dy]),mt,md,ml);P(pts.map(([dx,dy])=>[x+dx*.7,y+dy*.7]),w,wd,wl);L(x-4,y-7,x+3,y-7,hi);}if(s===2)crumbs(25,72,10);if(s===3)cloth(29,28,35,9);break;}
 case 'flour-sack': {
  P([[30,28],[60,28],[68,41],[72,72],[65,78],[27,78],[23,70],[26,40]],iv,id,hi);P([[28,28],[34,20],[58,20],[64,28],[59,35],[33,35]],iv,id,hi);L(31,40,29,65,id);L(59,42,63,68,id);B(32,46,27,18,a,md,iv);for(let i=0;i<3;i++){L(40+i*4,61,39+i*4,50,wd);L(40+i*4,54,36+i*4,51,wd);}if(s===0){E(47,28,13,3,hi,id,iv);}if(s===1){scoop(64,65,14);}if(s===2){P([[28,25],[34,18],[58,18],[62,25]],w,wd,wl);R(32,34,26,3,wd);}if(s===3){P([[30,27],[43,18],[61,27],[53,34]],a,md,iv);L(33,30,59,29,wd,2);}break;}
 case 'butter-dish': {
  E(48,70,32,9,iv,id,hi);P([[24,54],[35,44],[68,44],[73,63],[64,71],[25,67]],iv,id,hi);P([[30,49],[39,40],[63,40],[64,57],[56,64],[30,59]],g,gd,C('brass',4));L(39,42,39,57,hi);if(s===0)L(47,42,47,61,gd);if(s===1){for(let i=0;i<3;i++)B(48+i*7,50+i%2*5,6,8,g,gd,hi);}if(s===2){L(32,47,55,46,sg,2);L(34,52,56,51,sg,2);}if(s===3){P([[29,36],[42,28],[73,28],[76,43],[65,50],[31,45]],iv,id,hi);knob(52,29,4);}L(21,70,73,65,ml,2);wood(63,65,15,4);break;}
 case 'dough-ball': {
  board();if(s===0)dough(48,56,25);if(s===1){dough(37,56,15);dough(60,58,15);}if(s===2){E(48,56,24,15,w,wd,wl);for(let i=0;i<5;i++)L(32+i*7,48,36+i*7,58,iv,2);}if(s===3){dough(48,56,25);cloth(26,39,31,20);L(31,43,49,43,hi);L(32,48,50,48,iv);}crumbs(34,72,6+s);break;}
 case 'yeast-bottle': {
  P([[34,26],[61,26],[62,38],[68,44],[68,73],[62,78],[33,78],[27,73],[27,44],[34,37]],iv,id,hi);B(31,50-s*3,33,22+s*3,s===2?w:iv,s===2?wd:id,hi);for(let j=0;j<3;j++)for(let i=0;i<4;i++)E(37+i*7,56+j*6-s*2,1+(i+j)%2,1,hi);L(31,42,31,66,hi,2);B(32,21,31,9,w,wd,wl);if(s===0){P([[29,21],[36,17],[61,17],[67,23],[62,31],[31,29]],iv,id,hi);L(31,27,62,27,wd);}if(s===1){steel(56,12,3,12);B(51,10,12,4,ml,md,hi);}if(s===2){B(35,43,26,9,a,md,iv);L(40,47,55,47,hi);}if(s===3){B(29,56,37,13,a,md,iv);for(let x=33;x<63;x+=6)L(x,57,x,67,iv);}break;}
 case 'egg-crate': {
  P([[18,47],[30,35],[76,35],[81,66],[70,78],[22,76]],iv,id,hi);for(let j=0;j<2;j++)for(let i=0;i<3;i++){let x=31+i*18,y=48+j*18;E(x,y,8,6,id,wd,iv);if(!(s===1&&i===2)||j===0){E(x,y-4,6,8,s===2?w:iv,s===2?wd:id,s===2?wl:hi);}}for(let i=0;i<2;i++)P([[38+i*18,55],[43+i*18,45],[49+i*18,54]],iv,id,hi);if(s===0){P([[24,34],[29,21],[72,21],[76,33]],iv,id,hi);L(32,26,64,26,id);}if(s===3){B(39,34,12,42,a,md,iv);L(43,39,43,70,hi);}break;}
 case 'cocoa-canister': {
  cylinder(47,35,22,39,w,wd,wl);E(47,35,18,4,wd,ink,w);B(32,47,28,17,iv,id,hi);P([[38,51],[54,51],[54,60],[38,60]],wd,ink,w);L(46,52,46,59,w);L(39,55,53,55,w);if(s===0){E(47,25,23,6,mt,md,ml);knob(47,23,3);}if(s===1){scoop(59,33,20);E(59,32,6,2,wd);}if(s===2){wood(69,49,7,23);L(71,48,73,31,wd,2);}if(s===3){P([[23,31],[30,21],[66,21],[71,31]],iv,id,hi);L(28,29,67,29,a,2);}break;}
 case 'vanilla-tubes': {
  wood(22,73,54,7);wood(25,52,48,6);wood(26,27,5,49);wood(67,27,5,49);for(let i=0;i<3;i++){const x=36+i*12;P([[x-4,26],[x+4,26],[x+4,65],[x+2,70],[x-2,70],[x-4,65]],iv,id,hi);L(x-1,36,x+1,64,wd,2);if(s!==0)L(x+2,42,x,65,w);wood(x-5,23-(i===1?s:0),10,5);if(s===2){B(x-3,47,7,8,a,md,iv);}if(s===3){R(x-2,57,4,9,wd);}}if(s===0){L(24,38,22,60,wd,2);L(20,40,18,62,w,2);}if(s===1){wood(20,60,7,13);L(23,59,23,44,ml,2);}break;}
 case 'nut-hopper': {
  wood(25,72,47,8);wood(26,37,5,38);wood(64,37,5,38);P([[28,22],[67,22],[65,47],[55,60],[41,60],[30,47]],iv,id,hi);P([[32,32],[63,32],[60,46],[52,55],[44,55],[34,45]],w,wd,wl);for(let i=0;i<10+(s===2?2:0);i++)E(36+i%4*7,34+Math.floor(i/4)*7,3,s===1?4:2,s===0?sg:s===2?wd:g,wd,wl);steel(42,58,14,8);L(55,60,71,58,md,2);knob(71,57,3);E(48,72,12,4,iv,id,hi);if(s===3){P([[27,20],[35,15],[63,15],[69,21]],w,wd,wl);knob(48,15,3);}else E(47,22,20,5,ml,md,hi);break;}
 case 'dial-scale': {
  P([[26,76],[30,46],[38,39],[61,39],[68,48],[73,76]],a,md,iv);disk(49,57,16);for(let i=0;i<8;i++){const t=i*Math.PI/4;L(49+Math.cos(t)*11,57+Math.sin(t)*11,49+Math.cos(t)*13,57+Math.sin(t)*13,md);}L(49,57,42+s*4,46+s,wd,2);knob(49,57,2);steel(43,30,12,10);E(49,29,28,7,mt,md,ml);if(s===0){dough(49,24,15);}if(s===1){for(let i=0;i<3;i++)E(38+i*10,25,5,6,iv,id,hi);}if(s===2){P([[36,24],[41,11],[57,11],[62,24]],iv,id,hi);B(43,15,11,5,w,wd,wl);}if(s===3){steel(33,17,9,9);steel(48,13,12,13);knob(54,12,3);}break;}
 case 'measuring-jug': {
  handle(66,38,15,24);P([[27,31],[60,31],[68,25],[66,69],[61,77],[30,77],[26,68]],iv,id,hi);P([[30,49-s*4],[62,49-s*4],[60,71],[33,71]],s===2?w:s===3?wd:C('cloth-6',2),id,hi);E(45,32,19,5,hi,id,iv);ticks(48,40,6);L(31,41,31,66,hi,2);if(s===0){E(44,50,10,3,hi,id,iv);}if(s===1){B(33,38,7,6,hi,id,iv);B(43,44,7,6,hi,id,iv);L(58,34,65,17,w,2);}if(s===2){L(42,35,37,20,w,3);}if(s===3){steel(59,19,4,23);knob(61,18,4);}break;}
 case 'measuring-spoons': {
  E(48,28,10,7,mt,md,ml);E(48,28,6,4,null,undefined,undefined,null);for(let i=0;i<(s===2?3:4);i++){let x=25+i*15,y=62+((i+s)%2)*8;L(45+i*2,31,x,y-6,md,4);L(45+i*2,31,x,y-6,ml,2);E(x,y,7+i%2,5+i%2,mt,md,ml);E(x,y-1,4+i%2,3,s===0?iv:s===1?g:s===2?wd:hi,id,hi);}if(s===3){L(42,23,34,17,a,3);L(51,23,62,18,a,3);}break;}
 case 'kitchen-timer': {
  E(48,76,20,4,mt,md,ml);E(48,52,25,25,a,md,iv);disk(48,52,19);for(let i=0;i<12;i++){let t=i*Math.PI/6;L(48+Math.cos(t)*14,52+Math.sin(t)*14,48+Math.cos(t)*16,52+Math.sin(t)*16,wd);}L(48,52,42+s*4,38+s*3,wd,2);E(48,52,5,5,g,gd,hi);if(s===0){knob(48,24,5);}if(s===1){B(30,21,13,7,a,md,iv);B(55,21,13,7,a,md,iv);}if(s===2){wood(34,73,28,5);L(25,51,19,55,g,2);knob(18,56,3);}if(s===3){E(48,18,9,7,mt,md,ml);E(48,18,5,4,null,undefined,undefined,null);steel(45,24,6,5);}break;}
 case 'thermometer': {
  wood(30,73,38,7);P([[38,21],[43,15],[54,15],[59,21],[59,65],[54,72],[42,72],[37,65]],iv,id,hi);B(44,23,8,37,mt,md,ml);L(47,30,47,60,C('gingham',1),2);E(48,64,6,6,C('gingham',1),C('gingham',0),C('gingham',3));for(let i=0;i<7;i++)L(53,25+i*5,56,25+i*5,wd);if(s===0){L(38,38,31,38,mt,3);L(31,38,31,49,mt,3);}if(s===1){E(67,63,8,6,iv,id,hi);B(64,58,6,6,hi,id,iv);}if(s===2){wood(65,36,8,37);L(68,35,65,20,wd,2);}if(s===3){B(34,46,7,18,a,md,iv);B(56,46,7,18,a,md,iv);knob(48,18,3);}break;}
 case 'utensil-rail': {
  wood(19,71,58,7);wood(22,23,5,51);wood(69,23,5,51);wood(22,24,52,6);for(let i=0;i<3;i++){const x=33+i*15;L(x,27,x,42,md,2);if((i+s)%3===0){E(x,57,7,10,mt,md,ml);L(x,40,x,51,w,3);}if((i+s)%3===1){B(x-6,49,12,17,mt,md,ml);L(x,40,x,50,w,3);for(let q=0;q<3;q++)L(x-3+q*3,53,x-3+q*3,62,md);}if((i+s)%3===2){L(x,40,x,58,w,4);for(let q=0;q<4;q++)L(x-5+q*3,57,x-5+q*3,67,iv,2);}}if(s===3)cloth(56,29,12,15);break;}
 case 'spice-drawer': {
  wood(21,26,55,52);P([[21,26],[29,19],[79,19],[76,26]],wl,wd,iv);for(let j=0;j<3;j++)for(let i=0;i<2;i++){let x=25+i*25,y=32+j*14;wood(x,y,22,12);B(x+5,y+3,12,5,iv,id,hi);knob(x+11,y+9,2);}const row=s%3,xx=s%2===0?25:50;P([[xx,32+row*14],[xx+22,32+row*14],[xx+25,40+row*14],[xx+2,40+row*14]],wd,ink,w);if(s===0)beans(xx+5,35+row*14,2,true);if(s===1){E(xx+7,36+row*14,3,2,g);E(xx+15,36+row*14,3,2,g);}if(s===2){L(xx+4,34+row*14,xx+15,37+row*14,w,2);}if(s===3){B(xx+4,33+row*14,5,5,iv,id,hi);B(xx+12,33+row*14,5,5,iv,id,hi);}break;}
 case 'towel-roller': {
  wood(22,73,53,7);wood(25,28,5,47);wood(67,28,5,47);L(25,32,72,32,md,4);E(35,34,10,13,iv,id,hi);B(35,21,25,26,iv,id,hi);E(60,34,10,13,iv,id,hi);E(60,34,4,5,wd);P([[36,39],[57,39],[58,68],[53,73],[36,69]],a,md,iv);for(let i=0;i<3;i++)L(39+i*6,45,39+i*6,66,iv);if(s===0){L(37,61,57,61,hi,2);L(37,65,57,65,hi);}if(s===1){P([[36,60],[57,60],[57,72],[36,68]],iv,id,hi);L(39,63,54,63,a,2);}if(s===2){wood(19,56,11,16);L(22,55,25,40,wd,2);}if(s===3){B(35,21,24,6,a,md,iv);L(38,24,55,24,hi);P([[36,48],[56,48],[54,58],[38,56]],iv,id,hi);}break;}
 default:throw new Error(`Unknown workshop reserve sprite: ${base.id}`);
 }
 return {width:96,height:96,pixels:p.pixels};
}
