// Original shelf-size travel and natural-history collectibles, native 96px.
// No source photograph, brand, resampling or generated-image dependency.
import { createPainter } from './build-seasonal-reserve-art.mjs';
const groups = [
 ['nautical','航海纪念','Nautical keepsakes',[
  ['lighthouse','灯塔模型','Lighthouse model'],['sailboat','帆船模型','Sailboat model'],['brass-telescope','黄铜望远镜','Brass telescope'],['ship-wheel','船舵陈列座','Ship wheel display'],['anchor-model','船锚模型','Anchor model'],['diving-helmet','铜潜水头盔','Copper diving helmet'],['buoy-model','航标浮塔模型','Navigation buoy model'],['sextant','黄铜六分仪','Brass sextant']]],
 ['voyage','旅途珍藏','Voyage collection',[
  ['compass','翻盖指南针','Hinged compass'],['globe','古典地球仪','Classic globe'],['suitcase','皮带旅行箱','Strapped travel suitcase'],['map-scroll','古地图卷筒','Antique map scrolls'],['travel-album','旅行摄影相册','Travel photograph album'],['binoculars','皮革双筒镜','Leather binoculars'],['passport-wallet','旅行证件夹','Travel document wallet'],['postcard-rack','明信片轮展架','Postcard display rack']]],
 ['shore','海岸采集','Coastal finds',[
  ['shell-box','贝壳分格盒','Shell specimen box'],['coral','珊瑚枝标本','Coral branch specimen'],['ammonite','菊石化石座','Ammonite fossil stand'],['sea-glass','海玻璃样品座','Sea glass display'],['driftwood','浮木拱标本','Driftwood arch study'],['starfish-frame','海星标本框','Starfish specimen frame'],['pearl-oyster','珍珠贝标本','Pearl oyster specimen'],['sand-bottle','彩沙标本瓶','Layered sand specimen']]],
 ['earth','地质陈列','Geological collection',[
  ['mineral-plinth','矿石陈列底座','Mineral display plinth'],['geode','晶洞切面座','Cut geode display'],['fossil-slab','植物化石石板','Botanical fossil slab'],['meteorite','陨石标本座','Meteorite specimen'],['crystal-cluster','水晶簇标本','Crystal cluster'],['desert-rose','沙漠玫瑰石','Desert rose mineral'],['rock-strata','地层剖面模型','Rock strata model'],['volcanic-core','火山岩芯标本','Volcanic core sample']]],
 ['field','山野采风','Field studies',[
  ['specimen-frame','植物标本框','Botanical specimen frame'],['mushroom-study','蘑菇标本座','Mushroom study'],['fern-press','蕨叶压制板','Pressed fern board'],['pinecone-study','松果研究台','Pinecone study'],['butterfly-case','蝴蝶标本盒','Butterfly specimen case'],['feather-stand','羽毛陈列座','Feather specimen stand'],['seed-cabinet','种子抽屉柜','Seed specimen cabinet'],['moss-cross-section','苔藓剖面标本','Moss cross section']]],
 ['landmarks','远方微景','Distant landscapes',[
  ['tea-hills','茶园山丘微景','Tea hill diorama'],['windmill-model','石塔风车模型','Stone windmill model'],['stone-bridge','石拱桥微景','Stone bridge diorama'],['alpine-peaks','雪山群峰微景','Alpine peaks model'],['hourglass','旅行计时沙漏','Travel hourglass'],['observatory-model','天文台模型','Observatory model'],['pagoda-model','古塔旅行模型','Pagoda model'],['railway-model','山间铁路模型','Mountain railway model']]],
];
export const PACK = {
 id:'travel-reserve-v1',titleZh:'四季旅行自然收藏',titleEn:'Seasonal Travel and Nature Collection',
 categories:groups.map(([id,nameZh,nameEn])=>({id:`travel-${id}`,nameZh,nameEn})),
 catalog:groups.flatMap(([category,,,items])=>items.map(([id,nameZh,nameEn])=>({id:`travel-${id}`,nameZh,nameEn,category:`travel-${category}`,tags:['travel','collectible','native-96','seasonal-structure',category]}))),
 variants:[{id:'spring',nameZh:'春日',nameEn:'Spring'},{id:'summer',nameZh:'夏日',nameEn:'Summer'},{id:'autumn',nameZh:'秋日',nameEn:'Autumn'},{id:'winter',nameZh:'冬日',nameEn:'Winter'}],
};
export function paintSprite(palette,base,variantIndex) {
 const s=((variantIndex%4)+4)%4,p=createPainter(palette),{color:C,put,rect:R,line:L,ellipse:E,poly:P,box:B}=p;
 const ink=C('walnut',0),wd=C('oak',1),w=C('oak',3),wl=C('oak',5),paper=C('porcelain',2),pd=C('porcelain',0),hi=C('porcelain',3),gold=C('brass',3),gd=C('brass',1),metal=C('steel',2),md=C('steel',0),blue=C('cloth-1',1),bd=C('cloth-1',0),sage=C('sage',3),sd=C('sage',0),red=C('gingham',1),pink=C('cloth-5',1),teal=C('cloth-6',1),td=C('cloth-6',0);
 const a=[pink,blue,C('terracotta',2),teal][s],al=[C('cloth-5',2),C('cloth-1',2),C('terracotta',3),C('cloth-6',2)][s];
 E(48,80,30,3,pd,undefined,undefined,pd);E(50,80,20,2,C('hair-option-0',1),undefined,undefined,C('hair-option-0',1));
 const panel=(x,y,ww,hh,c=w,d=wd,h=wl)=>{B(x,y,ww,hh,c,d,h);L(x+2,y+2,x+ww-3,y+2,h);L(x+2,y+3,x+2,y+hh-3,h);};
 const rod=(x,y,xx,yy,c=w,t=2)=>{L(x,y,xx,yy,ink,t+1);L(x,y,xx,yy,c,t);};
 const pin=(x,y,r=2,c=gold)=>E(x,y,r,r,c,gd,hi);
 const plinth=(x=24,y=72,ww=48,hh=7)=>{P([[x,y],[x+6,y-5],[x+ww-5,y-5],[x+ww,y],[x+ww-1,y+hh],[x+1,y+hh]],w,wd,wl);L(x+3,y+2,x+ww-4,y+2,wl);};
 const label=(x,y,ww=15)=>{panel(x,y,ww,6,paper,pd,hi);L(x+3,y+3,x+ww-4,y+3,wd);};
 const stone=(x,y,ww=22,hh=20,c=metal)=>{P([[x-ww*.5,y],[x-ww*.4,y-hh*.6],[x-ww*.1,y-hh],[x+ww*.3,y-hh*.8],[x+ww*.5,y-hh*.25],[x+ww*.3,y+2],[x-ww*.3,y+3]],c,md,hi);L(x-ww*.1,y-hh+3,x+ww*.05,y-4,pd);};
 const stem=(x,y,hh=30,c=sage)=>{rod(x,y,x-2,y-hh,sd,1);for(let j=0;j<4;j++){let yy=y-5-j*6,d=j%2?-1:1;P([[x-1,yy],[x+d*10,yy-8],[x+d*12,yy-4],[x,yy+1]],c,sd,C('sage',4));L(x,yy,x+d*8,yy-5,sd);}};
 const star=(x,y,r=15,c=paper)=>{const pts=[];for(let i=0;i<10;i++){let t=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.42:r;pts.push([x+Math.cos(t)*rr,y+Math.sin(t)*rr]);}P(pts,c,pd,hi);for(let i=0;i<5;i++){let t=-Math.PI/2+i*Math.PI*2/5;L(x,y,x+Math.cos(t)*r*.68,y+Math.sin(t)*r*.68,pd);}};
 const shell=(x,y,r=11,c=paper)=>{P([[x,y+5],[x-r,y],[x-r,y-r*.7],[x-r*.6,y-r],[x,y-r*1.12],[x+r*.6,y-r],[x+r,y-r*.6],[x+r,y]],c,pd,hi);for(let j=-2;j<=2;j++)L(x,y+3,x+j*r*.35,y-r*.8,pd);};
 const crystal=(x,y,ww,hh,c=blue)=>{P([[x-ww/2,y],[x-ww/2,y-hh+8],[x,y-hh],[x+ww/2,y-hh+8],[x+ww/2,y]],c,bd,hi);L(x,y-hh+2,x,y-2,hi);P([[x+1,y-hh+8],[x+ww/2-1,y-hh+10],[x+ww/2-1,y-1],[x+1,y-1]],bd);};
 const wave=(x,y,ww)=>{for(let i=0;i<ww;i+=9){L(x+i,y+2,x+i+4,y,hi);L(x+i+4,y,x+i+8,y+2,blue);}};
 const hill=(x,y,ww,hh,c=sage)=>{P([[x-ww/2,y],[x-ww*.4,y-hh*.55],[x-ww*.1,y-hh],[x+ww*.2,y-hh*.88],[x+ww*.5,y]],c,sd,C('sage',4));};
 const card=(x,y,ww=21,hh=18)=>{panel(x,y,ww,hh,paper,pd,hi);R(x+3,y+3,ww-6,hh-7,blue);if(s===0){P([[x+3,y+hh-5],[x+ww*.5,y+6],[x+ww-4,y+hh-5]],sage,sd,C('sage',4));pin(x+ww-6,y+5,1,pink);}if(s===1){P([[x+ww*.5,y+4],[x+ww*.5,y+hh-5],[x+4,y+hh-5]],hi,pd);L(x+ww*.5,y+3,x+ww*.5,y+hh-4,wd);}if(s===2){for(let j=0;j<2;j++){L(x+6+j*7,y+hh-4,x+6+j*7,y+6,wd);E(x+6+j*7,y+7,3,4,w,red,wl);}}if(s===3){P([[x+3,y+hh-5],[x+ww*.55,y+4],[x+ww-3,y+hh-5]],hi,pd,hi);}};
 switch(base.id.replace(/^travel-/,'')) {
  case 'lighthouse': {
   plinth(23,73,52,6);stone(30,72,14,11);P([[34,69],[40,24],[56,24],[63,69]],paper,pd,hi);P([[36,51],[60,51],[61,58],[35,58]],red,ink,pink);P([[38,35],[58,35],[59,41],[37,41]],red,ink,pink);panel(38,21,20,11,gold,gd,hi);panel(41,22,14,7,blue,bd,hi);L(48,22,48,29,gold);P([[34,21],[48,13],[63,21]],wd,ink,w);panel(43,60,10,12,wd,ink,w);L(33,32,64,32,gold);for(let x=35;x<64;x+=7)L(x,29,x,34,gd);
   if(s===0){stone(68,72,12,16,sage);}if(s===1){wave(25,73,43);rod(64,67,69,44,gold);P([[69,44],[80,48],[68,52]],blue,bd,hi);}if(s===2){P([[27,72],[32,61],[37,72]],w,wd,wl);L(58,63,69,72,paper,2);}if(s===3){P([[35,21],[48,12],[61,20],[53,19],[47,17],[39,22]],hi,pd);R(37,52,15,2,hi);stone(67,72,13,12,paper);}break;
  }
  case 'sailboat': {
   plinth(23,74,51,5);rod(37,74,40,66,wd);rod(61,74,59,66,wd);P([[17,60],[75,60],[69,70],[35,73],[24,68]],w,wd,wl);L(25,64,69,64,paper);rod(46,60,46,15,wd);P([[43,21],[43,56],[22,56]],paper,pd,hi);if(s===0)P([[49,24],[69,55],[49,55]],pink,red,al);if(s===1){P([[49,18],[77,55],[49,55]],paper,pd,hi);L(51,31,65,47,blue,3);}if(s===2){P([[49,30],[66,56],[49,56]],w,wd,wl);L(47,27,31,59,paper);}if(s===3){panel(48,47,21,8,paper,pd,hi);for(let x=52;x<68;x+=5)L(x,47,x,54,wd);rod(65,60,67,34,wd);P([[68,35],[77,45],[68,45]],teal,td,al);}L(46,17,20,60,paper);P([[47,15],[59,18],[47,21]],a,bd,al);break;
  }
  case 'brass-telescope': {
   rod(48,55,30,79,wd);rod(49,55,68,79,wd);rod(49,55,49,78,wd);rod(48,57,49,44,gold,3);P([[22,35],[68,20],[74,33],[27,48]],gold,gd,hi);P([[22,34],[30,32],[35,47],[27,50]],gold,gd,hi);E(24,42,6,9,gd,wd,gold);E(23,40,4,6,blue,bd,hi);P([[65,20],[74,17],[80,31],[72,34]],gold,gd,hi);L(34,33,66,23,hi);L(40,31,44,42,gd);L(59,24,63,36,gd);
   if(s===0){panel(44,51,11,5,paper,pd,hi);}if(s===1){P([[71,19],[80,16],[85,29],[78,32]],wd,ink,w);}if(s===2){L(29,48,25,62,wd);E(25,65,6,4,wd,ink,w);}if(s===3){P([[39,32],[49,29],[54,40],[43,43]],paper,pd,hi);L(43,33,48,39,blue,2);}break;
  }
  case 'ship-wheel': {
   plinth(27,73,43,6);rod(47,72,47,59,gold,3);E(48,43,24,24,w,wd,wl);E(48,43,18,18,null,undefined,undefined,null);for(let i=0;i<8;i++){const t=i*Math.PI/4+s*.08;rod(48,43,48+Math.cos(t)*29,43+Math.sin(t)*29,w,2);pin(48+Math.cos(t)*24,43+Math.sin(t)*24,2);}E(48,43,7,7,gold,gd,hi);pin(48,43,2);
   if(s===0){L(28,28,27,42,paper,2);}if(s===1){L(68,26,74,43,blue,3);}if(s===2){label(34,71,28);}if(s===3){L(31,24,48,18,paper,3);L(48,18,65,26,paper,3);}break;
  }
  case 'anchor-model': {
   plinth(25,74,47,5);E(48,23,8,9,metal,md,hi);E(48,23,4,5,null,undefined,undefined,null);rod(47,30,47,67,metal,5);rod(29,39,67,39,w,4);P([[20,51],[29,56],[27,62],[46,70],[66,62],[65,55],[76,50],[73,67],[48,78],[25,67]],metal,md,hi);L(30,64,46,72,hi);L(48,71,65,64,md);
   for(let i=0;i<3+s;i++){E(40+(i%2)*5,38+i*7,4,5,w,wd,wl);E(40+(i%2)*5,38+i*7,2,3,null,undefined,undefined,null);}if(s===3)L(30,39,64,39,paper,2);break;
  }
  case 'diving-helmet': {
   plinth(23,74,51,5);P([[23,70],[31,60],[65,60],[75,70],[69,76],[29,76]],gold,gd,hi);E(48,43,24,26,gold,gd,hi);E(48,45,15,16,gd,wd,gold);E(48,44,11,12,blue,bd,hi);for(let x=42;x<57;x+=6)L(x,34,x,55,gold,2);L(38,44,58,44,gold,2);E(72,44,6,9,gold,gd,hi);E(72,44,3,5,ink,bd,metal);pin(31,37,3);pin(31,53,3);pin(64,29,3);for(let x=31;x<68;x+=9)pin(x,71,2);
   if(s===0){rod(28,58,21,47,gold);E(21,44,4,5,gold,gd,hi);}if(s===1){rod(66,60,79,60,gold);L(79,60,81,70,wd,3);}if(s===2){panel(38,18,19,5,gold,gd,hi);L(44,16,52,16,gd,2);}if(s===3){panel(38,63,22,7,paper,pd,hi);L(42,66,55,66,bd);}break;
  }
  case 'buoy-model': {
   E(48,72,26,7,red,ink,pink);P([[28,68],[35,52],[61,52],[69,68]],red,ink,pink);E(48,52,14,5,paper,pd,hi);rod(38,50,42,28,red);rod(58,50,54,28,red);L(41,44,55,34,metal);L(41,34,55,44,metal);panel(40,25,16,7,gold,gd,hi);panel(44,18,8,8,blue,bd,hi);P([[40,18],[48,11],[56,18]],red,ink,pink);rod(48,11,48,7,gold,1);
   if(s===0){E(33,66,5,5,paper,pd,hi);E(33,66,2,2,red);}if(s===1){L(56,20,68,20,wd);P([[59,20],[71,23],[59,28]],blue,bd,hi);wave(28,74,32);}if(s===2){L(25,68,18,56,wd,2);pin(18,54,3);}if(s===3){E(48,51,14,3,paper,pd,hi);L(31,65,40,62,hi,2);}break;
  }
  case 'sextant': {
   plinth(25,74,48,5);rod(48,71,48,61,wd);P([[30,29],[78,68],[70,75],[19,41]],gold,gd,hi);P([[34,38],[64,64],[32,48]],null,undefined,undefined,null);E(29,31,6,6,gold,gd,hi);rod(29,31,64+s*3,63-s*3,gold,2);for(let i=0;i<8;i++)L(28+i*6,47+i*3,30+i*6,44+i*3,wd);P([[23,27],[49,20],[52,29],[26,36]],gold,gd,hi);E(24,31,4,6,blue,bd,hi);panel(48,40,8,12,metal,md,hi);panel(62,50,6,12,blue,bd,hi);if(s===3)label(31,73,21);break;
  }
  case 'compass': {
   plinth(26,73,46,6);E(48,32,23,19,gold,gd,hi);E(48,31,18,14,paper,pd,hi);L(35,31,61,31,pd);L(48,20,48,42,pd);E(48,60,27,18,gold,gd,hi);E(48,58,22,14,paper,pd,hi);for(let i=0;i<8;i++){let t=i*Math.PI/4;L(48+Math.cos(t)*17,58+Math.sin(t)*10,48+Math.cos(t)*20,58+Math.sin(t)*12,wd);}const dx=[-8,10,3,-12][s],dy=[-9,-6,-11,-3][s];P([[48+dx,58+dy],[51,59],[48-dx,58-dy],[45,57]],red,ink,pink);pin(48,58,3);E(76,60,3,4,gold,gd,hi);if(s===2){L(36,27,56,35,wd);L(39,35,56,24,wd);}if(s===3){panel(38,24,20,13,blue,bd,hi);star(48,30,5,hi);}break;
  }
  case 'globe': {
   plinth(29,74,38,5);rod(48,71,48,64,gold,3);E(48,42,29,30,gold,gd,hi);E(48,42,26,27,null,undefined,undefined,null);E(48,42,23,23,blue,bd,hi);E(48,42,12,22,teal,td,hi);E(48,42,10,21,blue,undefined,undefined,blue);L(27,40,68,40,teal);L(30,31,65,31,teal);L(30,53,64,53,teal);
   const shift=s*3;P([[33+shift,25],[43+shift,24],[47+shift,31],[41+shift,38],[44+shift,44],[36+shift,49],[31+shift,39]],sage,sd,C('sage',4));P([[49-shift,46],[60-shift,43],[64-shift,51],[56-shift,63],[52-shift,59]],sage,sd,C('sage',4));rod(35,17,61,67,gold,1);pin(35,17,3);pin(61,67,3);if(s===3){P([[38,21],[51,19],[60,25],[50,27],[40,25]],paper,pd,hi);}break;
  }
  case 'suitcase': {
   E(48,27,12,10,wd,ink,w);E(48,27,8,6,null,undefined,undefined,null);P([[19,38],[26,31],[73,31],[79,39],[77,76],[20,76]],w,wd,wl);panel(23,38,50,33,w,wd,wl);panel(29,32,7,43,wd,ink,w);panel(62,32,7,43,wd,ink,w);panel(28,49,9,8,gold,gd,hi);panel(61,49,9,8,gold,gd,hi);L(40,70,57,70,wl);for(let x=23;x<75;x+=8){put(x,36,wl);put(x,72,wl);}card(41,42,17,18);
   if(s===0){L(69,33,79,43,wd);label(72,43,10);}if(s===1){P([[37,31],[55,31],[57,39],[51,43],[46,39],[38,42]],blue,bd,hi);}if(s===2){panel(37,63,21,7,paper,pd,hi);}if(s===3){P([[40,26],[58,26],[59,41],[54,39],[49,42],[43,39]],paper,pd,hi);for(let x=43;x<58;x+=4)L(x,28,x,39,red);}break;
  }
  case 'map-scroll': {
   plinth(24,74,50,5);P([[27,22],[47,18],[51,72],[29,76]],paper,pd,hi);E(37,22,10,4,paper,pd,hi);E(37,22,6,2,wd);P([[46,33],[66,26],[74,72],[53,77]],w,wd,wl);E(56,31,11,4,paper,pd,hi);E(56,31,7,2,wd);panel(28,54,22,7,wd,ink,w);P([[49,56],[69,51],[71,57],[51,63]],gold,gd,hi);for(let j=0;j<4;j++){L(33,31+j*6,43,28+j*6,wd);L(36,29+j*6,39,33+j*6,pd);}if(s===0){L(32,39,43,43,pink,2);}if(s===1){L(33,32,42,49,blue,2);}if(s===2){P([[52,38],[62,35],[66,46],[56,49]],paper,pd,hi);L(56,40,61,44,wd);}if(s===3){panel(20,44,8,26,blue,bd,hi);E(24,44,4,2,gold,gd,hi);}break;
  }
  case 'travel-album': {
   // Closed, standing accordion photography archive; no open-book silhouette.
   P([[23,24],[63,17],[74,25],[74,76],[34,81],[23,73]],a,bd,al);P([[63,21],[70,26],[70,71],[64,73]],paper,pd,hi);L(25,27,25,70,gold);card(31,31,29,27);panel(32,64,29,6,paper,pd,hi);for(let i=0;i<3;i++)L(35+i*8,67,39+i*8,67,wd);panel(60,55,13,7,wd,ink,w);pin(66,58,2);if(s===0){R(40,19,4,9,pink);}if(s===1){R(54,17,4,10,blue);card(51,59,14,13);}if(s===2){P([[30,23],[40,19],[41,27],[31,30]],paper,pd,hi);}if(s===3){panel(39,12,18,10,paper,pd,hi);L(43,16,53,16,red);}break;
  }
  case 'binoculars': {
   plinth(24,74,49,5);for(const x of [32,63]){P([[x-9,33],[x+8,33],[x+13,67],[x+7,74],[x-10,74],[x-14,67]],wd,ink,w);E(x,33,9,5,metal,md,hi);E(x-1,32,6,3,blue,bd,hi);E(x,67,13,8,metal,md,hi);E(x,67,9,5,blue,bd,hi);L(x-9,43,x-11,60,w,2);}panel(40,44,15,9,wd,ink,w);pin(47,44,4);rod(45,45,45,37,metal);if(s===0){L(25,38,18,52,wd,2);L(18,52,22,68,wd,2);}if(s===1){panel(28,24,8,7,gold,gd,hi);panel(59,24,8,7,gold,gd,hi);}if(s===2){L(45,56,50,62,paper);label(43,62,14);}if(s===3){P([[24,42],[37,42],[39,55],[23,56]],paper,pd,hi);P([[56,42],[69,42],[71,55],[55,56]],paper,pd,hi);}break;
  }
  case 'passport-wallet': {
   P([[27,28],[62,22],[71,30],[71,74],[35,80],[26,73]],wd,ink,w);P([[31,31],[63,26],[65,72],[34,76]],a,bd,al);for(let y=34;y<72;y+=5)put(34,y,hi);for(let y=30;y<72;y+=5)put(62,y,hi);E(48,49,10,10,gold,gd,hi);L(40,49,56,49,gd);L(48,41,48,57,gd);E(48,49,5,9,null,undefined,undefined,null);panel(41,62,17,3,gold,gd,hi);panel(59,54,13,8,wd,ink,w);pin(65,58,2);
   const top=[18,13,22,16][s];panel(36,top,23,14,paper,pd,hi);L(40,top+5,55,top+5,wd);if(s===1)R(40,top+8,13,3,blue);if(s===2)R(50,top+7,6,5,red);if(s===3){L(43,top+7,53,top+7,blue);L(48,top+3,48,top+11,blue);}break;
  }
  case 'postcard-rack': {
   plinth(23,73,52,6);rod(29,71,29,25);rod(69,72,69,25);panel(27,27,44,5,w,wd,wl);card(31,17,27,22);card(42,37,28,23);card(27,55,26,20);panel(26,73,48,5,w,wd,wl);panel(26,51,46,4,w,wd,wl);if(s===0)panel(59,19,6,17,pink,red,hi);if(s===1){L(30,29,22,42,gold);pin(22,43,3);}if(s===2)card(56,56,14,17);if(s===3)panel(35,12,20,5,blue,bd,hi);break;
  }
  case 'shell-box': {
   panel(21,22,54,26,w,wd,wl);panel(26,27,44,16,paper,pd,hi);plinth(17,49,64,29);panel(23,49,51,22,wd,ink,w);L(48,49,48,70,wl,2);L(24,60,73,60,wl,2);shell(35,57,8,s===0?pink:paper);shell(61,67,9,s===1?gold:paper);E(34,67,7,4,paper,pd,hi);L(29,67,38,67,pd);if(s===2)star(61,53,7,w);else{E(62,53,7,4,a,bd,al);E(62,53,3,2,hi,pd);}if(s===3){shell(48,37,8,hi);}else label(36,31,25);break;
  }
  case 'coral': {
   plinth(23,73,51,6);stone(48,70,30,10,paper);const c=s===3?paper:C('terracotta',2),d=s===3?pd:red;const twig=(x,y,xx,yy,t=3)=>{rod(x,y,xx,yy,c,t);L(x,y,xx,yy,d,1);};twig(48,69,47,35,6);twig(47,53,27,42,4);twig(27,42,23,24,3);twig(25,35,16,31,2);twig(47,45,62,29,4);twig(62,29,60,18,3);twig(62,30,75,23,3);twig(48,62,70,49,4);twig(70,49,77,36,3);twig(69,49,80,49,2);twig(45,38,38,20,3);twig(39,24,45,15,2);
   if(s===0){twig(28,43,34,31,2);E(44,16,3,3,pink,red,hi);}if(s===1){twig(72,50,80,59,2);twig(37,21,29,15,2);shell(34,69,7,paper);}if(s===2){twig(46,60,31,58,3);twig(31,58,21,51,2);}if(s===3){twig(58,35,71,39,2);E(71,39,4,3,hi,pd);star(62,65,7,paper);}break;
  }
  case 'ammonite': {
   plinth(24,73,49,6);rod(34,73,37,63,gold);rod(65,73,61,61,gold);E(48,46,27,25,w,wd,wl);let last=null;for(let i=0;i<=100;i++){let t=i*.15,r=1+i*.22,x=48+Math.cos(t)*r,y=46+Math.sin(t)*r*.9;if(last)L(last[0],last[1],x,y,wd,2);last=[x,y];}for(let i=0;i<12;i++){let t=i*Math.PI/6;L(48+Math.cos(t)*21,46+Math.sin(t)*19,48+Math.cos(t)*26,46+Math.sin(t)*24,wl);}if(s===0){label(32,73,27);}if(s===1){stone(71,71,13,14,paper);}if(s===2){P([[25,50],[30,37],[35,41],[32,53]],metal,md,hi);}if(s===3){panel(27,27,7,12,paper,pd,hi);L(30,29,30,36,md);}break;
  }
  case 'sea-glass': {
   plinth(20,71,57,8);panel(25,68,47,5,paper,pd,hi);const pts=[[31,61,13,24],[47,61,17,36],[65,60,13,25]];for(let i=0;i<pts.length;i++){const [x,y,ww,hh]=pts[i];P([[x-ww/2,y],[x-ww/2-2,y-hh*.4],[x-2,y-hh],[x+ww/2,y-hh*.8],[x+ww/2+2,y-3]],i===1?teal:blue,bd,hi);L(x-2,y-hh+7,x-ww/3,y-9,hi);}if(s===0){E(36,69,6,3,pink,red,hi);}if(s===1){P([[64,36],[72,29],[76,37],[70,44]],teal,td,hi);}if(s===2){P([[21,64],[25,51],[33,57],[31,66]],gold,gd,hi);}if(s===3){P([[47,28],[52,19],[59,23],[55,35]],paper,pd,hi);L(39,40,42,34,paper,2);}label(36,73,24);break;
  }
  case 'driftwood': {
   plinth(19,74,60,5);P([[22,73],[25,54],[34,38],[42,31],[53,33],[61,45],[67,52],[77,54],[78,61],[64,61],[53,50],[47,41],[39,43],[33,57],[32,74]],w,wd,wl);L(27,67,32,51,wl);L(32,51,42,37,wl);L(44,36,54,39,wl);L(52,43,61,55,wd);L(67,56,74,57,wd);P([[32,57],[23,44],[24,34],[29,38],[29,45],[37,51]],w,wd,wl);P([[54,40],[61,24],[66,22],[64,33],[59,47]],w,wd,wl);
   if(s===0){stem(67,69,16,sage);}if(s===1){shell(48,70,10,paper);}if(s===2){E(36,40,4,6,wd,ink,w);stone(65,72,12,9,w);}if(s===3){L(32,48,43,35,hi,2);L(43,35,53,38,hi,2);shell(49,69,7,hi);}break;
  }
  case 'starfish-frame': {
   plinth(29,75,39,4);P([[22,27],[66,20],[75,27],[75,74],[30,79],[22,72]],w,wd,wl);panel(28,29,39,39,paper,pd,hi);star(48,47,17,s===3?paper:w);for(let i=0;i<5;i++){let t=i*Math.PI*2/5-Math.PI/2;pin(48+Math.cos(t)*10,47+Math.sin(t)*10,1);}label(34,69,25);if(s===0){shell(34,63,6,pink);}if(s===1){E(60,60,4,4,blue,bd,hi);}if(s===2){star(61,31,7,gold);}if(s===3){shell(34,35,6,hi);L(60,56,64,62,blue);}break;
  }
  case 'pearl-oyster': {
   plinth(24,73,49,6);shell(48,46,24,paper);E(48,64,27,13,paper,pd,hi);E(48,61,23,10,pink,red,al);E(48,60,18,7,paper,pd,hi);E(48,57,7,7,hi,pd,paper);E(46,54,2,2,hi,undefined,undefined,hi);for(let i=-2;i<=2;i++)L(48,44,48+i*8,27+Math.abs(i)*3,pd);if(s===0){E(61,60,3,3,pink,red,hi);}if(s===1){E(36,60,4,4,hi,pd);E(60,63,4,4,hi,pd);}if(s===2){P([[30,51],[34,49],[38,53],[34,56]],gold,gd,hi);}if(s===3){E(62,57,5,5,hi,pd);E(34,63,3,3,hi,pd);E(40,65,2,2,hi,pd);}break;
  }
  case 'sand-bottle': {
   plinth(28,74,40,5);P([[39,25],[57,25],[57,35],[68,45],[68,71],[62,77],[34,77],[28,71],[28,45],[39,35]],paper,pd,hi);P([[32,48],[42,39],[54,39],[64,48],[64,70],[60,73],[37,73],[32,69]],gold,gd,hi);P([[33,55-s*2],[47,59],[63,51+s],[63,70],[33,70]],w,wd,wl);P([[33,66],[46,62-s],[63,66],[62,71],[35,71]],a,bd,al);panel(37,18,22,10,w,wd,wl);L(41,20,41,25,wl);L(34,47,34,61,hi,2);label(40,48,17);if(s===0){L(56,29,65,34,wd);label(62,34,12);}if(s===1)panel(40,15,16,4,gold,gd,hi);if(s===2){L(38,28,59,28,wd,2);L(59,28,65,43,wd);}if(s===3){panel(39,28,18,5,blue,bd,hi);L(56,31,61,43,blue,3);}break;
  }
  case 'mineral-plinth': {
   plinth(23,65,50,14);stone(47,63,33,39,metal);P([[30,56],[34,35],[45,23],[47,46],[40,60]],blue,bd,hi);P([[46,44],[56,28],[64,42],[58,59]],teal,td,hi);crystal(33,63,12,21,a);if(s===0){crystal(59,63,10,18,pink);}if(s===1){crystal(60,56,12,30,blue);}if(s===2){P([[42,56],[52,49],[62,57],[55,65],[43,63]],gold,gd,hi);}if(s===3){crystal(49,40,10,26,paper);crystal(64,64,9,20,paper);}label(36,71,25);break;
  }
  case 'geode': {
   plinth(24,73,49,6);P([[25,62],[22,45],[29,26],[44,18],[63,23],[75,40],[70,62],[56,72],[37,70]],metal,md,hi);P([[31,59],[29,43],[35,30],[46,25],[59,29],[68,42],[63,58],[54,65],[40,63]],bd,ink,blue);P([[38,54],[35,42],[41,34],[51,31],[60,39],[59,52],[50,58]],ink,bd,metal);for(let i=0;i<6+s;i++){const t=i*Math.PI*2/(6+s),x=48+Math.cos(t)*18,y=45+Math.sin(t)*17;P([[x-4,y],[x,y-7],[x+5,y],[x+2,y+6]],i%2?blue:a,bd,hi);}if(s===3){crystal(48,59,10,15,paper);}label(36,73,23);break;
  }
  case 'fossil-slab': {
   plinth(27,73,43,6);P([[27,70],[23,36],[31,21],[62,18],[73,31],[69,68],[58,75]],paper,pd,hi);L(31,33,38,26,pd);L(61,23,65,33,pd);L(61,60,66,54,pd);rod(45,65,48,30,wd,1);for(let i=0;i<5;i++){let yy=35+i*6;L(47,yy+5,35,yy,wd);L(47,yy+5,59,yy-2,wd);for(let j=0;j<3;j++){L(36+j*4,yy+j,36+j*4,yy-3+j,wd);L(50+j*4,yy+3-j,51+j*4,yy-j,wd);}}if(s===0)E(58,33,4,3,w,wd,wl);if(s===1){shell(36,59,5,w);}if(s===2){L(29,51,36,49,md);L(36,49,38,43,md);}if(s===3){P([[62,25],[69,33],[66,41],[60,33]],metal,md,hi);}break;
  }
  case 'meteorite': {
   plinth(26,66,45,13);rod(38,67,39,59,gold);rod(60,67,58,59,gold);P([[24,47],[29,31],[44,23],[62,28],[73,43],[67,58],[52,66],[34,61]],bd,ink,metal);for(const [x,y,r]of[[36,39,5],[53,34,6],[60,51,5],[39,55,4],[47,47,3]]){E(x,y,r,r,md,ink,metal);E(x-1,y-1,r-2,r-2,ink,undefined,undefined,ink);}L(30,42,32,35,metal,2);if(s===0){P([[55,26],[61,29],[57,33],[52,30]],gold,gd,hi);}if(s===1){P([[25,48],[30,43],[34,50],[30,57]],metal,md,hi);}if(s===2){P([[56,58],[66,53],[63,62],[55,66]],w,wd,wl);}if(s===3){P([[38,26],[45,23],[50,26],[44,31]],paper,pd,hi);E(65,42,3,3,metal,md,hi);}label(35,70,26);break;
  }
  case 'crystal-cluster': {
   plinth(22,74,53,5);stone(49,69,45,14,metal);crystal(31,66,12,28,blue);crystal(45,65,16,47,a);crystal(61,66,14,36,teal);crystal(51,72,13,24,blue);if(s===0){crystal(69,71,9,17,pink);}if(s===1){crystal(23,68,9,19,teal);crystal(58,37,9,23,blue);}if(s===2){crystal(71,67,10,26,gold);}if(s===3){crystal(33,50,10,34,paper);crystal(65,72,12,21,paper);}break;
  }
  case 'desert-rose': {
   plinth(25,73,48,6);const c=s===3?paper:w;for(let i=0;i<8;i++){const t=i*Math.PI/4+s*.17,x=48+Math.cos(t)*12,y=49+Math.sin(t)*12;P([[x-12,y],[x-5,y-12],[x+7,y-9],[x+13,y+2],[x+3,y+10],[x-8,y+7]],c,wd,wl);L(x-7,y+2,x+5,y-5,pd);}P([[38,43],[47,35],[59,40],[60,53],[49,61],[38,54]],paper,pd,hi);L(43,48,55,43,wd);L(44,53,55,48,wd);if(s===1)stone(66,71,14,10,w);if(s===2){P([[28,57],[20,50],[23,42],[34,46]],gold,gd,hi);}if(s===3){P([[49,22],[54,17],[61,24],[55,33]],paper,pd,hi);}label(36,74,24);break;
  }
  case 'rock-strata': {
   plinth(21,73,56,6);P([[24,68],[24,37],[37,24],[67,28],[73,42],[70,69]],w,wd,wl);P([[25,42],[38,31],[68,35],[71,42],[68,45],[38,38]],paper,pd,hi);P([[25,51],[38,43],[69,47],[70,54],[38,50]],metal,md,hi);P([[25,60],[38,54],[69,58],[69,64],[37,61]],wd,ink,w);L(39,30,39,65,pd);if(s===0){P([[29,35],[39,27],[66,30],[68,34],[39,32]],sage,sd,C('sage',4));}if(s===1){L(55,30,52,68,ink);L(53,46,59,50,ink);}if(s===2){shell(51,48,7,paper);}if(s===3){P([[25,36],[38,24],[67,28],[69,32],[37,29],[29,37]],hi,pd);L(44,41,55,43,hi);}break;
  }
  case 'volcanic-core': {
   plinth(24,72,48,7);for(let i=0;i<3;i++){let x=34+i*14,top=29+(i+s)%3*9;panel(x-6,top,12,41-(i+s)%3*9,bd,ink,metal);E(x,top,6,3,metal,md,hi);for(let y=top+7;y<68;y+=8)L(x-5,y,x+5,y+1,y%3?wd:paper);for(let y=top+6;y<67;y+=11)put(x+((y+i)%3)-2,y,ink);}panel(27,62,43,4,gold,gd,hi);label(36,73,24);if(s===3)stone(65,72,13,13,paper);break;
  }
  case 'specimen-frame': {
   plinth(28,75,40,4);panel(22,18,51,58,w,wd,wl);panel(27,23,41,46,paper,pd,hi);stem(47,62,32,s===2?w:sage);if(s===0){for(const [x,y]of[[39,32],[56,37],[39,45]])E(x,y,4,3,pink,red,hi);}if(s===1){for(let i=0;i<3;i++)E(47+i*4,29-i*3,3,3,gold,gd,hi);}if(s===2){P([[34,53],[31,45],[38,43],[41,51]],w,wd,wl);L(35,45,36,52,wd);}if(s===3){for(let i=0;i<4;i++){E(41+i%2*12,32+i*6,3,4,w,wd,wl);}R(46,30,2,30,pd);}label(36,69,24);break;
  }
  case 'mushroom-study': {
   plinth(23,73,51,6);stone(49,69,40,9,wd);const mushroom=(x,y,r,h,c)=>{P([[x-4,y],[x-3,y-h],[x+3,y-h],[x+5,y]],paper,pd,hi);E(x,y-h,r,r*.4,pd,wd,paper);P([[x-r,y-h],[x-r+3,y-h-r*.65],[x,y-h-r],[x+r-3,y-h-r*.6],[x+r,y-h]],c,wd,wl);L(x-r+3,y-h,x+r-3,y-h,paper);};
   mushroom(44,69,20,29,s===0?paper:s===1?w:red);mushroom(65,70,11,16,w);if(s===0){mushroom(29,70,8,12,paper);}if(s===1){for(let i=0;i<3;i++)L(31+i*8,36,33+i*8,42,pd);}if(s===2){for(const [x,y]of[[33,34],[44,29],[52,35]])E(x,y,2,2,paper);mushroom(28,69,9,22,red);}if(s===3){P([[25,40],[31,29],[44,20],[58,31],[64,40],[56,35],[44,27],[32,36]],paper,pd,hi);mushroom(27,72,7,10,paper);}break;
  }
  case 'fern-press': {
   P([[22,22],[65,16],[75,24],[75,73],[31,80],[22,73]],wd,ink,w);P([[27,26],[66,21],[69,70],[31,75]],paper,pd,hi);rod(44,67,50,29,sd,1);for(let i=0;i<6;i++){let y=34+i*5,x=49-i*.5,len=7+i%3*3;L(x,y+4,x-len,y,sage);L(x,y+4,x+len,y-2,sage);for(let j=0;j<3;j++){L(x-len+j*3,y+j,x-len+j*3,y-3+j,sage);L(x+3+j*3,y+2-j,x+4+j*3,y-2-j,sage);}}for(const [x,y]of[[25,26],[67,22],[28,70],[69,69]])pin(x,y,2);if(s===0){panel(32,59,6,4,pink,red,hi);}if(s===1){L(54,49,64,41,sage);L(60,44,66,45,sage);}if(s===2){L(35,50,39,44,w,2);L(57,39,63,34,w,2);}if(s===3){label(35,67,24);L(35,25,36,35,pd);}break;
  }
  case 'pinecone-study': {
   plinth(22,73,54,6);const cone=(x,y,rx,ry)=>{E(x,y,rx,ry,w,wd,wl);for(let row=0;row<5;row++)for(let col=0;col<3;col++){let xx=x-7+col*6+(row%2)*2,yy=y-ry+5+row*6;P([[xx-3,yy],[xx+4,yy],[xx+2,yy+5],[xx,yy+7]],w,wd,wl);}rod(x,y-ry,x+2,y-ry-5,wd,1);};cone(42,48,15,23);if(s===0){cone(65,60,9,13);stem(26,70,23,sage);}if(s===1){rod(60,70,64,28,wd,1);for(let y=35;y<64;y+=6){L(63,y,55,y-7,sage);L(63,y,72,y-8,sage);}}if(s===2){cone(65,57,10,17);E(27,68,7,5,gold,gd,hi);}if(s===3){P([[31,34],[42,24],[52,33],[48,38],[42,33],[35,39]],paper,pd,hi);cone(65,61,8,12);}label(34,74,26);break;
  }
  case 'butterfly-case': {
   panel(19,25,58,49,wd,ink,w);panel(24,30,48,37,paper,pd,hi);const x=48,y=48;E(x-11,y-7,11+s,10,pink,red,hi);E(x+11,y-7,11+s,10,a,bd,al);E(x-8,y+8,8,9,a,bd,al);E(x+8,y+8,8,9,pink,red,hi);rod(x,y-11,x,y+12,wd,2);L(x,y-10,x-5,y-17,wd);L(x,y-10,x+5,y-17,wd);for(let j=-1;j<=1;j+=2){E(x+j*12,y-6,4,4,s===1?blue:gold,gd,hi);E(x+j*8,y+8,3,3,s===2?paper:blue,bd,hi);}label(32,68,32);if(s===3){panel(26,21,44,4,paper,pd,hi);L(28,33,28,44,hi);}break;
  }
  case 'feather-stand': {
   plinth(27,72,43,7);const feather=(x,y,hh,dx,c)=>{rod(x,y,x+dx,y-hh,wd,1);P([[x+dx,y-hh],[x+dx+7,y-hh+9],[x+dx+6,y-hh+24],[x+2,y-4],[x-5,y-10],[x+dx-7,y-hh+12]],c,pd,hi);L(x,y,x+dx,y-hh,wd);for(let i=1;i<6;i++){let t=i/7,xx=x+dx*t,yy=y-hh*t;L(xx,yy,xx-5,yy-4,pd);L(xx+1,yy,xx+6,yy-5,pd);}};feather(42,69,49,-8,s===3?paper:blue);feather(54,69,38,10,w);if(s===0){feather(47,68,30,1,pink);}if(s===1){feather(61,68,49,7,teal);}if(s===2){for(let i=0;i<3;i++)E(32+i,27+i*7,3,2,wd,ink,w);}if(s===3){feather(29,68,31,-4,hi);}panel(34,64,27,8,gold,gd,hi);label(35,74,25);break;
  }
  case 'seed-cabinet': {
   panel(23,25,51,51,w,wd,wl);P([[23,25],[31,18],[69,18],[74,25]],w,wd,wl);for(let i=0;i<3;i++){let yy=30+i*13;panel(28,yy,41,11,paper,pd,hi);pin(49,yy+5,2);}const row=s%3,yy=30+row*13;P([[27,yy+3],[65,yy+3],[75,yy+10],[73,yy+20],[27,yy+20]],w,wd,wl);P([[30,yy+4],[64,yy+4],[70,yy+10],[32,yy+11]],paper,pd,hi);for(let i=0;i<4+s;i++)E(35+i*5,yy+7,2,1,i%2?wd:gold);pin(51,yy+15,2);if(s===3){panel(30,11,32,8,paper,pd,hi);L(35,15,56,15,sage);}break;
  }
  case 'moss-cross-section': {
   plinth(21,72,56,7);P([[25,45],[39,34],[70,39],[72,67],[57,73],[26,67]],wd,ink,w);P([[26,52],[40,43],[70,47],[70,54],[39,49]],paper,pd,hi);for(let i=0;i<6;i++){L(31+i*6,52,29+i*6,64,wl);L(30+i*6,59,34+i*6,62,wl);}P([[23,44],[34,34],[45,31],[57,34],[70,37],[74,44],[60,50],[39,47]],sage,sd,C('sage',4));for(let i=0;i<6;i++){let x=30+i*7,y=38+(i%3)*3;E(x,y,5,4,sage,sd,C('sage',4));}if(s===0){for(let i=0;i<3;i++){L(35+i*12,40,34+i*12,27,sd);E(34+i*12,26,3,3,pink,red,hi);}}if(s===1){stem(47,39,20,sage);}if(s===2){E(39,33,7,4,w,wd,wl);E(60,38,6,4,w,wd,wl);}if(s===3){P([[25,43],[36,34],[45,32],[57,35],[70,38],[68,42],[53,38],[39,39],[32,46]],paper,pd,hi);}label(38,73,23);break;
  }
  case 'tea-hills': {
   plinth(18,73,62,6);hill(42,68,46,40,s===2?w:sage);hill(62,69,35,28,s===2?w:sage);for(let y=40;y<66;y+=7){L(31,y,46,y-4,sd,2);L(46,y-4,54,y,sd,2);L(34,y+2,48,y-2,C('sage',4));}for(let y=50;y<69;y+=7)L(56,y,70,y+3,sd,2);P([[27,70],[34,60],[42,55],[47,48],[52,47],[46,57],[38,63],[33,71]],paper,pd,hi);if(s===0){for(let i=0;i<3;i++)E(31+i*9,44+i*6,2,2,pink,red,hi);}if(s===1){rod(64,52,64,37,wd,1);P([[56,38],[64,31],[72,38]],paper,pd,hi);}if(s===2){P([[56,57],[62,53],[68,57],[67,65],[57,65]],w,wd,wl);L(58,57,66,57,paper);}if(s===3){P([[29,42],[38,28],[43,28],[52,36],[50,40],[42,34],[36,39]],paper,pd,hi);L(55,51,68,55,hi,2);}break;
  }
  case 'windmill-model': {
   plinth(23,73,51,6);P([[34,72],[40,34],[58,34],[66,72]],paper,pd,hi);P([[36,34],[49,21],[62,34]],wd,ink,w);panel(44,57,10,16,wd,ink,w);panel(39,46,5,7,blue,bd,hi);L(57,61,62,61,pd);L(36,67,42,67,pd);const cx=49,cy=35;for(let i=0;i<4;i++){let t=i*Math.PI/2+Math.PI/4+s*.12,dx=Math.cos(t),dy=Math.sin(t),nx=-dy,ny=dx;rod(cx,cy,cx+dx*29,cy+dy*29,w,1);P([[cx+dx*9,cy+dy*9],[cx+dx*29,cy+dy*29],[cx+dx*29+nx*6,cy+dy*29+ny*6],[cx+dx*9+nx*6,cy+dy*9+ny*6]],s===3?paper:w,wd,wl);for(let j=13;j<29;j+=5)L(cx+dx*j,cy+dy*j,cx+dx*j+nx*5,cy+dy*j+ny*5,wd);}pin(cx,cy,4);if(s===3)L(37,35,44,27,hi,2);if(s===1)stone(70,73,10,9,sage);break;
  }
  case 'stone-bridge': {
   plinth(17,73,64,6);P([[20,50],[32,39],[60,39],[77,51],[76,73],[20,73]],metal,md,hi);E(48,67,16,18,null,undefined,undefined,null);R(33,67,31,10,null);P([[20,50],[32,39],[60,39],[77,51],[74,55],[59,44],[34,44],[23,55]],paper,pd,hi);for(let i=0;i<7;i++){let t=Math.PI+i*Math.PI/6;L(48+Math.cos(t)*17,67+Math.sin(t)*20,48+Math.cos(t)*22,67+Math.sin(t)*25,pd);}R(34,71,28,5,blue);wave(36,71,22);L(22,59,29,59,pd);L(67,59,74,59,pd);if(s===0){stem(24,70,17,sage);}if(s===1){P([[41,70],[59,70],[55,74],[44,74]],w,wd,wl);}if(s===2){E(71,45,6,5,w,wd,wl);}if(s===3){P([[21,49],[32,38],[60,38],[76,50],[72,51],[59,42],[33,42],[24,52]],hi,pd,hi);L(37,72,59,72,hi,2);}break;
  }
  case 'alpine-peaks': {
   plinth(18,73,63,6);P([[19,70],[34,37],[43,53],[54,20],[79,70]],metal,md,hi);P([[35,70],[54,20],[58,52],[69,70]],bd,md,metal);P([[43,43],[54,20],[64,41],[58,36],[54,42],[50,34]],paper,pd,hi);P([[25,55],[34,37],[41,51],[36,48],[32,52]],paper,pd,hi);P([[23,71],[39,65],[49,68],[68,63],[76,72]],s===3?paper:sage,sd,hi);
   if(s===0){E(45,68,7,3,blue,bd,hi);}if(s===1){rod(61,38,61,28,wd,1);P([[62,28],[71,30],[62,34]],red,ink,pink);}if(s===2){P([[23,70],[30,57],[36,70]],w,wd,wl);P([[65,70],[70,57],[76,70]],w,wd,wl);}if(s===3){P([[19,69],[26,53],[33,56],[39,51],[43,56],[47,48],[53,52],[58,45],[66,53],[76,65],[79,70]],paper,pd,hi);}break;
  }
  case 'hourglass': {
   E(48,76,24,5,w,wd,wl);for(const x of [27,69])rod(x,72,x,25,gold,2);P([[33,26],[63,26],[61,37],[52,48],[52,51],[61,63],[63,72],[33,72],[35,62],[44,51],[44,48],[35,38]],paper,pd,hi);P([[37,29],[59,29],[57,37],[49,47],[40,37]],blue,bd,hi);const fill=34+s*3;P([[39,fill],[58,fill],[49,47]],gold,gd,hi);P([[37,69],[48,58-s*2],[60,69]],gold,gd,hi);L(48,47,48,60-s*2,gold);L(36,31,39,39,hi,2);L(36,64,36,69,hi,2);E(48,25,24,5,w,wd,wl);E(48,21,22,4,w,wd,wl);if(s===0)pin(27,49,3,pink);if(s===1){panel(65,42,8,7,blue,bd,hi);}if(s===2){L(27,31,22,39,wd);label(17,39,13);}if(s===3){panel(32,17,32,4,paper,pd,hi);}break;
  }
  case 'observatory-model': {
   plinth(20,73,58,6);panel(26,44,45,28,paper,pd,hi);E(48,44,23,22,teal,td,hi);R(24,45,49,6,paper);panel(25,44,47,7,metal,md,hi);P([[45,23],[53,23],[57,42],[48,42]],bd,ink,blue);rod(51,36,68+s,22+s*2,gold,4);E(69+s,22+s*2,4,5,blue,bd,hi);panel(43,58,11,15,wd,ink,w);panel(31,55,6,8,blue,bd,hi);panel(60,55,6,8,blue,bd,hi);L(27,68,36,68,pd);if(s===0){L(27,44,27,37,gold);pin(27,35,2,pink);}if(s===1){panel(69,55,8,13,blue,bd,hi);}if(s===2)P([[29,72],[34,65],[39,72]],w,wd,wl);if(s===3){L(29,31,36,25,hi,2);L(36,25,44,23,hi,2);R(26,45,19,2,hi);}break;
  }
  case 'pagoda-model': {
   plinth(25,74,47,5);panel(35,55,27,18,paper,pd,hi);panel(38,37,21,18,paper,pd,hi);panel(41,23,15,14,paper,pd,hi);for(const [y,ww]of[[25,27],[42,39],[60,53]]){P([[48-ww/2,y],[48-ww/2+6,y-2],[48,y-12],[48+ww/2-6,y-2],[48+ww/2,y],[48+ww/2-3,y+4],[48-ww/2+3,y+4]],s===3?paper:teal,td,hi);L(48-ww/2+5,y+3,48+ww/2-5,y+3,gold);}panel(44,63,9,11,wd,ink,w);panel(45,44,6,8,blue,bd,hi);rod(48,14,48,8,gold,1);pin(48,8,2);if(s===0){E(29,60,3,4,pink,red,hi);}if(s===1){L(66,60,66,68,gold);pin(66,69,2);}if(s===2){L(31,61,27,70,red,2);L(64,61,70,70,red,2);}if(s===3){R(36,58,23,2,hi);panel(32,71,8,3,paper,pd,hi);}break;
  }
  case 'railway-model': {
   plinth(16,72,65,7);P([[20,69],[23,38],[34,25],[49,35],[56,69]],metal,md,hi);E(37,59,12,17,ink,wd,w);R(26,59,22,13,ink);P([[17,73],[35,63],[77,63],[81,70],[38,71],[22,78]],w,wd,wl);for(let x=26;x<77;x+=8)L(x,66,x+3,73,wd,2);L(26,69,77,65,metal,2);L(28,74,78,70,metal,2);panel(44,49,23,15,a,bd,al);panel(62,40,12,21,a,bd,al);panel(64,43,7,7,blue,bd,hi);panel(43,46,8,5,wd,ink,w);panel(44,39,5,8,wd,ink,w);for(const x of [48,59,70])E(x,65,4,4,ink,md,metal);L(48,65,69,65,metal);if(s===0){E(46,33,4,3,paper,pd,hi);}if(s===1){E(46,31,5,4,paper,pd,hi);E(42,23,7,5,paper,pd,hi);}if(s===2){P([[21,45],[23,37],[29,32],[34,37],[31,45]],w,wd,wl);}if(s===3){P([[23,39],[34,25],[49,35],[51,43],[42,38],[35,32],[30,39]],paper,pd,hi);panel(61,38,15,4,paper,pd,hi);}break;
  }
  default:throw new Error(`Unknown travel reserve base: ${base.id}`);
 }
 return {width:96,height:96,pixels:p.pixels};
}
