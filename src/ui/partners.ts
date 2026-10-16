import { PARTNERS, PARTNER_ROLES, PARTNER_NODES, PARTNER_RECRUIT_COST, PARTNER_TRAIN_COST, PARTNER_TRAIN_XP, partnerSlots, partnerUnread, syncPartners, recruitPartner, assignPartner, trainPartner, readPartnerChapter, type PartnerDefinition, type PartnerRole } from '../game/partners';
import { PARTNER_STORIES } from '../game/partner-stories';
import type { GameState } from '../game/state';
import type { Sim } from '../game/sim';
import { getLocale } from '../i18n';
import { character, toDataURL } from '../render/sprites';
import { fineSpriteArt } from '../render/fine-sprite-art';
import { showModal } from './modal';
export const partnerText = (zh: string, en: string) => getLocale() === 'zh' ? zh : en;
const roleName = (r: PartnerRole) => ({ barista: partnerText('咖啡师','Barista'), server: partnerText('服务员','Server'), cook: partnerText('厨师','Cook') })[r];
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, value: string, cls = '') => {
  const n = document.createElement(tag); n.textContent = value; n.className = cls; return n;
};
export function updatePartnersButton(state: GameState): void {
  const b = document.getElementById('partners-btn'); if (!b) return;
  const count = partnerUnread(state), label = partnerText('伙伴','Team') + (count ? ' · ' + count : '');
  if (b.textContent !== label) b.textContent = label;
  b.setAttribute('aria-label', partnerText('咖啡馆伙伴','Café partners') + (count ? partnerText('，未读故事 ',', unread stories ') + count : ''));
}
function specialtyDescription(role: PartnerRole, choice: 'a' | 'b'): string {
  const descriptions = {
    barista: [
      ['饮品专注：饮品制作时间 −20%，烘焙点单制作时间 +10%。适合饮品占多数的菜单。','Drink focus: drink preparation −20%, bakery-order preparation +10%. Best for drink-heavy menus.'],
      ['点心搭档：烘焙点单制作时间 −20%，饮品制作时间 +10%。适合点心占多数的菜单。','Bakery focus: bakery-order preparation −20%, drink preparation +10%. Best for bakery-heavy menus.'],
    ],
    server: [
      ['轻装快送：移动速度 +20%，每趟只能携带 1 单。适合短距离、少量订单。','Light courier: movement +20%, but only 1 order per trip. Suits short routes and small queues.'],
      ['批量配送：携带至少 2 单时速度 +10%，其他时候速度 −10%。适合集中配送。','Batch delivery: movement +10% with at least 2 orders, −10% otherwise. Suits grouped deliveries.'],
    ],
    cook: [
      ['专心制作：工位操作时间 −20%，移动速度 −10%。适合工位耗时较长的配方。','Station focus: station time −20%, movement −10%. Suits recipes with long station work.'],
      ['灵活走位：移动速度 +25%，工位操作时间 +10%。适合走动较多的配方。','Kitchen runner: movement +25%, station time +10%. Suits recipes with more walking.'],
    ],
  };
  const d = descriptions[role][choice === 'a' ? 0 : 1]; return partnerText(d[0],d[1]);
}
export function showPartners(state: GameState, sim: Sim, save: () => void, selected?: string): void {
  syncPartners(state);
  const root = node('div','', 'regular-journal partner-journal');
  function action(label: string, fn: () => void, disabled = false): HTMLButtonElement {
    const b = node('button',label,'pixel-btn ghost'); b.type='button'; b.disabled=disabled;
    b.addEventListener('click',()=> { if(root.isConnected && b.isConnected) fn(); }); return b;
  }
  function commit(ok: boolean, id: string): void { if(ok) { sim.update(state,0); save(); updatePartnersButton(state); } profile(id); }
  function render(...children: Node[]): void {
    root.replaceChildren(...children);
    const scroll=root.closest<HTMLElement>('.modal-body'); if(scroll) scroll.scrollTop=0;
    const title=root.querySelector<HTMLElement>('h3'); if(title) { title.tabIndex=-1; title.focus(); }
  }
  function portrait(p: PartnerDefinition): HTMLImageElement {
    const frame=character(p.look,p.role,p.appearance).stand, art=fineSpriteArt(frame);
    const img=node('img','', 'regular-portrait'); img.src=toDataURL(art.canvas,3/art.density); img.alt=''; img.width=48; img.height=78; return img;
  }
  function identity(p: PartnerDefinition): HTMLElement {
    const h=node('div','', 'regular-heading'), title=node('div','', 'regular-identity');
    title.append(node('h3',p.name[getLocale()]),node('p',roleName(p.role),'regular-role')); h.append(portrait(p),title); return h;
  }
  function list(): void {
    const intro=node('div','', 'regular-intro');
    intro.append(node('h3',partnerText('一起把日子过好','Good days, together')),node('p',partnerText('9 位候选伙伴，每种职业 3 位。候选与上岗名额分开；已购岗位的人手免费保留。店主单独工作，不占伙伴名额。','Nine candidates, three per role. Your roster and active slots are separate; purchased staffing stays yours free. The owner works separately.'),'note'),
    node('p',partnerText('关店后可以招募、换班和培养。故事随实际工作与不同营业日解锁，随时可稍后再看。','Recruit, assign and train while closed. Stories unlock through real work across business days; read whenever you like.'),'note'));
    const cards=node('div','', 'regular-cards');
    for(const role of PARTNER_ROLES) {
      cards.append(node('h3',roleName(role)+' · '+partnerText('上岗 ','Active ')+state.partners.active[role].length+'/'+partnerSlots(state,role)));
      for(const p of PARTNERS.filter(p=>p.role===role)) {
        const c=node('section','', 'regular-profile'); c.dataset.partner=p.id; c.append(identity(p));
        const progress=state.partners.roster[p.id], active=state.partners.active[role].includes(p.id);
        c.append(node('p',progress ? (active?partnerText('在岗','On duty'):partnerText('候补','Reserve'))+' · '+progress.xp+' XP · '+progress.workedDays+partnerText(' 个营业日',' business days') : partnerText('尚未加入','Not recruited'),'note'));
        const open=action(partnerText('查看伙伴','View partner'),()=>profile(p.id)); open.dataset.partnerOpen=p.id; c.append(open); cards.append(c);
      }
    }
    render(intro,cards);
  }
  function currentWork(p: PartnerDefinition): string {
    if(!state.partners.active[p.role].includes(p.id)) return partnerText('候补休息中','Resting in reserve');
    if(state.phase==='prep') return partnerText('关店准备中','Preparing while closed');
    if(p.role==='server') {
      const actor=sim.servers.find(s=>s.partnerId===p.id);
      return !actor ? partnerText('等待开工','Ready for work') : actor.plates.length ? partnerText('正在配送','Delivering orders') : partnerText('等待取餐或返回中','Collecting orders or returning');
    }
    if(p.role==='barista') {
      const actor=sim.baristas.find(b=>b.partnerId===p.id);
      return actor?.customerId == null ? partnerText('等待下一单','Waiting for the next order') : actor.remaining > 0 ? partnerText('正在制作','Preparing an order') : partnerText('等待出餐','Waiting to hand off');
    }
    const cook=sim.cooks.find(c=>c.partnerId===p.id);
    return cook?.batch ? partnerText('正在烘焙批次','Working on a baking batch') : partnerText('等待补货需求','Waiting for restocking work');
  }
  function profile(id: string): void {
    const p=PARTNERS.find(x=>x.id===id)!; const progress=state.partners.roster[id], card=node('section','', 'regular-profile');
    card.append(identity(p),node('p',PARTNER_STORIES[id].intro[getLocale()]));
    if(!progress) {
      const recruit=action(partnerText('招募候补 · ','Recruit reserve · ')+'$'+PARTNER_RECRUIT_COST,()=>commit(recruitPartner(state,id),id),state.phase!=='prep'||state.coins<PARTNER_RECRUIT_COST||p.role==='cook'&&!state.kitchen);
      recruit.dataset.partnerRecruit=id;
      card.append(node('p',partnerText('招募不增加岗位。购买岗位仍会自动补足人手；厨房伙伴需先建厨房。','Recruiting does not add a slot. Purchased slots still supply staff automatically; cooks need an installed kitchen.'),'note'),recruit);
    } else {
      card.append(node('p',currentWork(p)),node('p',progress.xp+' XP · '+progress.workedDays+partnerText(' 个营业日',' business days')+' · '+partnerText('故事 ','Stories ')+progress.unlocked+'/3','note'));
      const assignments=node('div','', 'regular-reading-actions');
      for(let slot=0;slot<partnerSlots(state,p.role);slot++) {
        const b=action(partnerText('安排岗位 ','Assign slot ')+(slot+1)+(state.partners.active[p.role][slot]===id?' ✓':''),()=>commit(assignPartner(state,id,slot),id),state.phase!=='prep'||state.partners.active[p.role][slot]===id);
        b.dataset.partnerAssign=String(slot); assignments.append(b);
      }
      card.append(assignments,node('h4',partnerText('职业专长','Specialty')),node('p',partnerText('20 XP 后可选一项，每次学习或切换 $80；只在关店时生效，不叠加。','Choose one at 20 XP. Learning or switching costs $80, only while closed. Specialties never stack.'),'note'));
      for(const choice of ['a','b'] as const) {
        card.append(node('p',specialtyDescription(p.role,choice)));
        const b=action(progress.specialty===choice?partnerText('已学习','Selected'):partnerText('学习 · $80','Train · $80'),()=>commit(trainPartner(state,id,choice),id),state.phase!=='prep'||progress.xp<PARTNER_TRAIN_XP||state.coins<PARTNER_TRAIN_COST||progress.specialty===choice);
        b.dataset.partnerTrain=choice; card.append(b);
      }
      card.append(node('h4',partnerText('伙伴故事','Partner stories')));
      PARTNER_NODES.forEach((n,index)=>{
        const unlocked=index<progress.unlocked;
        const label=partnerText('第 ','Chapter ')+(index+1)+(unlocked ? progress.read.includes(index)?partnerText(' · 回看',' · Replay'):partnerText(' · 新故事',' · New') : ' · '+n.jobs+partnerText(' 次工作 / ',' jobs / ')+n.days+partnerText(' 个营业日',' business days'));
        const b=action(label,()=>story(id,index),!unlocked); b.dataset.partnerChapter=String(index); card.append(b);
      });
      card.append(node('p',partnerText('每次实际制作、成功交付或完成烘焙批次获得 1 XP。离线、阅读、暂停与未完成工作不计经验。','Each real brew, successful delivery or completed baking batch earns 1 XP. Offline time, reading, pauses and unfinished work earn none.'),'note'));
    }
    render(action(partnerText('返回团队','Back to team'),list),card);
  }
  function story(id: string,index: number): void {
    const progress=state.partners.roster[id]; if(!progress||index>=progress.unlocked) return;
    const article=node('article','', 'regular-story'); article.dataset.partnerReading=id;
    article.append(node('h3',PARTNERS.find(p=>p.id===id)!.name[getLocale()]+' · '+partnerText('第 ','Chapter ')+(index+1)),node('p',PARTNER_STORIES[id].chapters[index][getLocale()]));
    const read=action(partnerText('读完了','Finished reading'),()=>{ if(readPartnerChapter(state,id,index)) {save();updatePartnersButton(state);} profile(id); }); read.dataset.partnerFinish='';
    render(article,read,action(partnerText('稍后再看','Read later'),()=>profile(id)),action(partnerText('返回团队','Back to team'),list));
  }
  if(selected) profile(selected); else list();
  showModal({title:partnerText('咖啡馆伙伴','Café partners'),body:root,focusableBody:true,buttons:[{label:partnerText('关闭','Close')}]});
  root.closest('[role="dialog"]')?.classList.add('regular-journal-modal');
}
