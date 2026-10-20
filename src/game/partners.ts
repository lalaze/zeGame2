import type { GameState, Look } from './state';
export type PartnerRole = 'barista' | 'server' | 'cook';
export const PARTNER_ROLES: PartnerRole[] = ['barista', 'server', 'cook'];
export interface PartnerDefinition { id: string; role: PartnerRole; name: { zh: string; en: string }; look: Look; appearance: number }
const define = (id: string, role: PartnerRole, zh: string, en: string, appearance: number): PartnerDefinition => ({
  id, role, name: { zh, en }, appearance,
  look: { skin: appearance % 4, hair: appearance % 6, hairStyle: appearance % 4, shirt: (appearance * 3) % 8, pants: appearance % 3 },
});
export const PARTNERS: PartnerDefinition[] = [
  define('lin', 'barista', '林芽', 'Lin', 1), define('theo', 'barista', '麦洛', 'Milo', 2), define('mira', 'barista', '米拉', 'Mira', 3),
  define('yue', 'server', '小月', 'Yue', 0), define('ari', 'server', '阿栗', 'Ari', 1), define('noah', 'server', '诺亚', 'Noah', 2),
  define('mei', 'cook', '梅子', 'Mei', 0), define('hugo', 'cook', '雨果', 'Hugo', 1), define('sora', 'cook', '空', 'Sora', 2),
];
export const partnerDefinition = (id: string | undefined) => PARTNERS.find(p => p.id === id);
export interface PartnerProgress {
  xp: number; workedDays: number; lastWorkedDay: number;
  specialty: 'a' | 'b' | null; unlocked: number; read: number[];
  todayDay: number; todayJobs: number; todayUnlocks: number;
}
export interface PartnerState {
  roster: Record<string, PartnerProgress>;
  active: Record<PartnerRole, string[]>;
}
export interface PartnerContribution { id: string; jobs: number; unlocked: number; xp: number }
export const PARTNER_RECRUIT_COST = 60;
export const PARTNER_TRAIN_COST = 80;
export const PARTNER_TRAIN_XP = 20;
export const PARTNER_NODES = [{ jobs: 5, days: 1 }, { jobs: 20, days: 2 }, { jobs: 60, days: 3 }];
export const freshPartner = (): PartnerProgress => ({
  xp: 0, workedDays: 0, lastWorkedDay: 0, specialty: null, unlocked: 0, read: [],
  todayDay: 0, todayJobs: 0, todayUnlocks: 0,
});
export const emptyPartners = (): PartnerState => ({ roster: {}, active: { barista: [], server: [], cook: [] } });
export function partnerSlots(s: Pick<GameState, 'upgrades' | 'kitchen'>, role: PartnerRole): number {
  return Math.min(3, Math.max(0, role === 'barista' ? s.upgrades.barista : role === 'server' ? 1 + s.upgrades.server : s.kitchen ? 1 + s.upgrades.cook : 0));
}
/** Paid capacity always supplies its promised staff, without charging old saves twice.
 * Extra reserve recruits are retained. Slot order is stable and can change only in prep. */
export function syncPartners(s: GameState): PartnerState {
  s.partners ??= emptyPartners();
  for (const role of PARTNER_ROLES) {
    const cap = partnerSlots(s, role), defs = PARTNERS.filter(p => p.role === role);
    let owned = defs.filter(p => !!s.partners.roster[p.id]);
    for (const p of defs) {
      if (owned.length >= cap) break;
      if (!s.partners.roster[p.id]) { s.partners.roster[p.id] = freshPartner(); owned.push(p); }
    }
    const active = [...new Set(s.partners.active[role])].filter(id => owned.some(p => p.id === id)).slice(0, cap);
    for (const p of owned) if (active.length < cap && !active.includes(p.id)) active.push(p.id);
    s.partners.active[role] = active;
  }
  return s.partners;
}
const count = (v: unknown, max = 1e9) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0;
export function parsePartners(raw: unknown, s: GameState): PartnerState {
  const value = raw && typeof raw === 'object' ? raw as Partial<PartnerState> : {};
  const out = emptyPartners();
  for (const def of PARTNERS) {
    const p = value.roster?.[def.id];
    if (!p || typeof p !== 'object') continue;
    const xp = count(p.xp), workedDays = Math.min(count(p.workedDays, s.day), xp), lastWorkedDay = count(p.lastWorkedDay, s.day);
    const reachable = PARTNER_NODES.filter(n => xp >= n.jobs && workedDays >= n.days).length;
    const unlocked = Math.min(count(p.unlocked, 3), reachable);
    const todayDay = count(p.todayDay, s.day);
    out.roster[def.id] = {
      xp, workedDays, lastWorkedDay, unlocked,
      specialty: xp >= PARTNER_TRAIN_XP && (p.specialty === 'a' || p.specialty === 'b') ? p.specialty : null,
      read: Array.isArray(p.read) ? [...new Set(p.read.filter(n => Number.isInteger(n) && n >= 0 && n < unlocked))] : [],
      todayDay, todayJobs: todayDay === s.day ? Math.min(count(p.todayJobs), xp) : 0,
      todayUnlocks: todayDay === s.day ? Math.min(count(p.todayUnlocks, 3), unlocked) : 0,
    };
  }
  for (const role of PARTNER_ROLES) out.active[role] = Array.isArray(value.active?.[role])
    ? value.active![role].filter(id => typeof id === 'string' && partnerDefinition(id)?.role === role) : [];
  s.partners = out;
  return syncPartners(s);
}
export function activePartner(s: GameState, role: PartnerRole, index: number): PartnerDefinition | undefined {
  return partnerDefinition(s.partners.active[role][index]);
}
export function recruitPartner(s: GameState, id: string): boolean {
  syncPartners(s);
  const p = partnerDefinition(id);
  if (!p || s.phase !== 'prep' || s.partners.roster[id] || s.coins < PARTNER_RECRUIT_COST || p.role === 'cook' && !s.kitchen) return false;
  s.coins -= PARTNER_RECRUIT_COST;
  s.partners.roster[id] = freshPartner();
  return true;
}
/** Replaces a slot or swaps two on-duty people; never changes headcount or paid capacity. */
export function assignPartner(s: GameState, id: string, slot: number): boolean {
  syncPartners(s);
  const p = partnerDefinition(id);
  if (!p || s.phase !== 'prep' || !s.partners.roster[id] || !Number.isInteger(slot) || slot < 0 || slot >= partnerSlots(s, p.role)) return false;
  const a = s.partners.active[p.role], old = a.indexOf(id), previous = a[slot];
  if (old === slot) return false;
  a[slot] = id;
  if (old >= 0) a[old] = previous;
  return true;
}
export function trainPartner(s: GameState, id: string, choice: 'a' | 'b'): boolean {
  const p = s.partners.roster[id];
  if (s.phase !== 'prep' || !p || p.xp < PARTNER_TRAIN_XP || p.specialty === choice || s.coins < PARTNER_TRAIN_COST || choice !== 'a' && choice !== 'b') return false;
  s.coins -= PARTNER_TRAIN_COST; p.specialty = choice;
  return true;
}
/** Called only at a real, atomic sim completion transition. Not on load/read/settlement. */
export function recordPartnerWork(s: GameState, id: string | undefined): void {
  if (!id || s.phase === 'prep') return;
  const p = s.partners.roster[id]; if (!p) return;
  if (p.todayDay !== s.day) { p.todayDay = s.day; p.todayJobs = 0; p.todayUnlocks = 0; }
  p.xp++; p.todayJobs++;
  if (p.lastWorkedDay !== s.day) { p.lastWorkedDay = s.day; p.workedDays++; }
  const unlocked = PARTNER_NODES.filter(n => p.xp >= n.jobs && p.workedDays >= n.days).length;
  p.todayUnlocks += Math.max(0, unlocked - p.unlocked); p.unlocked = Math.max(p.unlocked, unlocked);
}
export function partnerContributions(s: GameState): PartnerContribution[] {
  return PARTNERS.flatMap(d => {
    const p = s.partners.roster[d.id];
    return p && p.todayDay === s.day && p.todayJobs ? [{ id: d.id, jobs: p.todayJobs, unlocked: p.todayUnlocks, xp: p.xp }] : [];
  });
}
export function readPartnerChapter(s: GameState, id: string, chapter: number): boolean {
  const p = s.partners.roster[id];
  if (!p || !Number.isInteger(chapter) || chapter < 0 || chapter >= p.unlocked || p.read.includes(chapter)) return false;
  p.read.push(chapter); return true;
}
export const partnerUnread = (s: GameState) => Object.values(s.partners.roster).reduce((n, p) => n + p.unlocked - p.read.length, 0);
const specialty = (s: GameState, id: string | undefined) => id ? s.partners.roster[id]?.specialty : null;
export function partnerBrewMultiplier(s: GameState, id: string | undefined, bakery: boolean): number {
  const v = specialty(s,id); return !v ? 1 : (v === 'a' ? !bakery : bakery) ? .8 : 1.1;
}
export function partnerServerSpeed(s: GameState, id: string | undefined, load: number): number {
  const v = specialty(s,id); return v === 'a' ? 1.2 : v === 'b' ? load >= 2 ? 1.1 : .9 : 1;
}
export const partnerTraySize = (s: GameState,id: string | undefined) => specialty(s,id) === 'a' ? 1 : 3;
export const partnerCookSpeed = (s: GameState,id: string | undefined) => specialty(s,id) === 'a' ? .9 : specialty(s,id) === 'b' ? 1.25 : 1;
export const partnerStationTime = (s: GameState,id: string | undefined) => specialty(s,id) === 'a' ? .8 : specialty(s,id) === 'b' ? 1.1 : 1;
