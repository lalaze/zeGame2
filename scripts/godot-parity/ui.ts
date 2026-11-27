// Walks through the page's own screens (src/ui) without a browser (happy-dom): opens one on a café from a played career,
// presses what can be pressed at random, and writes down after every press what the screen says, which buttons work,
// the passing note, and in the end the save. `godot/tests/run_ui.gd` opens the same screens and presses the same things.
import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { MODS, call } from './mods';
import { IDS, Random, play, type Shot } from './ops';
import { lcg, wire } from './wire';
import styleSource from '../../src/ui/cafe-styles.ts?raw';
import type { GameState } from '../../src/game/state';
import type { Sim } from '../../src/game/sim';

type Any = any;
const page = new Window({ url: 'http://localhost/' }) as Any;
const g = globalThis as Any;
for (const name of ['document', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLDetailsElement', 'HTMLImageElement', 'HTMLCanvasElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'ResizeObserver', 'MutationObserver', 'Image', 'localStorage', 'getComputedStyle']) g[name] = page[name];
g.window = page;
Object.defineProperty(g, 'navigator', { value: page.navigator, configurable: true });
const frame = (f: (t: number) => void) => { f(0); return 1; };
g.requestAnimationFrame = page.requestAnimationFrame = frame;
g.cancelAnimationFrame = page.cancelAnimationFrame = () => {};
page.setTimeout = g.setTimeout = ((f: () => void) => 0) as Any;
// Pictures are not compared: every canvas takes any drawing and shows none.
const nothing: Any = new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'data' ? new Uint8ClampedArray(4) : nothing), set: () => true, apply: () => nothing });
page.HTMLCanvasElement.prototype.getContext = () => nothing;
page.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
page.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
// The street counts real time between two taps that spend; every step here is a second.
let ticks = 1000;
Object.defineProperty(g, 'performance', { value: { now: () => ticks }, configurable: true });

const { setLocale, t } = await import('../../src/i18n');
const { setIconArt } = await import('../../src/ui/icon-art');
const { setPortraitArt } = await import('../../src/ui/portrait-art');
const { setCatSource } = await import('../../src/ui/cat-art');
const { setBranchArt } = await import('../../src/render/branch-map-art');
const ui = { ...await import('../../src/ui/panel'), ...await import('../../src/ui/prepare'), ...await import('../../src/ui/first-opening'), ...await import('../../src/ui/settlement'), ...await import('../../src/ui/reputation'), ...await import('../../src/ui/money-details'), ...await import('../../src/ui/partners'),
  ...await import('../../src/ui/regular-guests'), ...await import('../../src/ui/cafe-styles'), ...await import('../../src/ui/taste'), ...await import('../../src/ui/milestones'), ...await import('../../src/ui/chain-ui'), ...await import('../../src/ui/branch-map'), ...await import('../../src/ui/signature-drinks'), ...await import('../../src/ui/streets'),
  ...await import('../../src/ui/room-projects'), ...await import('../../src/ui/sold-out'), ...await import('../../src/ui/moments'), ...await import('../../src/ui/service-help'), ...await import('../../src/ui/living-cats'), ...await import('../../src/ui/trial-sales'), ...await import('../../src/ui/guest-memories'), ...await import('../../src/ui/cafe-life') } as Any;
const { showModal, toast, closeModal, isModalOpen } = await import('../../src/ui/modal');
const { formatTransactionMoney, formatMoney } = await import('../../src/game/format');
setIconArt(() => 'data:,');
setPortraitArt(() => new Promise(() => {}));
setCatSource({ portrait: () => 'data:,', view: () => undefined, locate: () => false } as Any);
setBranchArt({ map: 'data:,', view: () => 'data:,' } as Any);

// ---------------------------------------------------------------- what a screen says

type Token = { k: 'text' | 'button' | 'box' | 'list' | 'entry' | 'fold'; v: string; on?: boolean; el?: Any };
const squash = (s: string) => s.replace(/\s+/g, '');
function tokens(root: Any): Token[] {
  const out: Token[] = [];
  const say = (v: string) => { const text = squash(v); if (!text) return; const last = out[out.length - 1]; if (last?.k === 'text') last.v += text; else out.push({ k: 'text', v: text }); };
  const walk = (node: Any, after = false): void => {
    if (node.nodeType === 3) { say(node.textContent ?? ''); return; }
    if (node.nodeType !== 1 || node.hidden || node.getAttribute('hidden') !== null) return;
    const has = (c: string) => node.classList.contains(c);
    // Kept out of sight on a phone by the stylesheets.
    if (has('life-full-label') || has('play-flow-help-hint')) return;
    if (node.parentElement?.classList.contains('street-shop-caption') && node.tagName === 'STRONG' && (['open', 'building'].includes(node.closest('.street-shop').dataset.status) || node.closest('.street-home'))) return;
    // The sheet's close button stands after its title.
    if (has('street-detail-close') && !after) return;
    switch (node.tagName) {
      case 'BUTTON': out.push({ k: 'button', v: has('street-shop') ? squash([...node.querySelectorAll('.street-shop-sign, .street-shop-caption strong, .street-shop-caption small')].filter((e: Any) => !(e.tagName === 'STRONG' && (['open', 'building'].includes(node.dataset.status) || has('street-home')))).map((e: Any) => e.textContent).join('')) : squash(node.textContent), on: !node.disabled, el: node }); return;
      case 'INPUT': out.push(node.type === 'checkbox' ? { k: 'box', v: node.checked ? 'x' : '', on: !node.disabled, el: node } : { k: 'entry', v: node.value, on: !node.disabled, el: node }); return;
      case 'SELECT': out.push({ k: 'list', v: squash(node.options[node.selectedIndex]?.textContent ?? ''), on: !node.disabled, el: node }); return;
      case 'DETAILS': { const summary = [...node.children].find((c: Any) => c.tagName === 'SUMMARY') as Any; out.push({ k: 'fold', v: squash(summary?.textContent ?? ''), on: true, el: node }); if (node.open) for (const c of node.childNodes) if (c !== summary) walk(c); return; }
      case 'OPTION': case 'STYLE': case 'CANVAS': case 'SVG': case 'IMG': case 'PROGRESS': return;
    }
    const children = [...node.childNodes];
    if (has('ledger-tools')) children.reverse();
    for (const c of children) { walk(c); if (c.id === 'street-detail-title') walk(root.querySelector('.street-detail-close'), true); }
  };
  walk(root);
  return out;
}

// ---------------------------------------------------------------- the page around them

const tabs = ['menu', 'pantry', 'upgrades', 'decor', 'pets', 'promotion'] as const;
const cats = ['all', 'coffee', 'tea', 'bread', 'pastry'];
function markup(): void {
  document.body.innerHTML = `<aside class="panel mobile-panel" id="management-panel"><nav class="tabs" role="tablist">${tabs.map((id) => `<button role="tab" data-tab="${id}" class="tab">${t(`tab.${id}` as Any)}</button>`).join('')}</nav>
    <div class="panel-scroll"><div class="goal" id="goal" hidden></div><div class="ledger-tools"><div class="buy-amount"><span>${t('buy.label')}</span><button data-amount="1" class="chip active">×1</button><button data-amount="10" class="chip">×10</button><button data-amount="max" class="chip">${t('buy.max')}</button></div>
    <div class="menu-filter">${cats.map((c) => `<button data-cat="${c}" class="chip">${t((c === 'all' ? 'cat.all' : `catShort.${c}`) as Any)}</button>`).join('')}</div></div>
    <div class="buy-amount pantry-amount" hidden><span>${t('buy.label')}</span>${[10, 50, 200].map((n) => `<button data-pantry-amount="${n}" class="chip">${n}</button>`).join('')}</div><div class="list" id="list"></div></div></aside>
    <button id="partners-btn"></button><button id="regular-guests-btn"></button><button id="cafe-style-btn"></button><div id="modal-root"></div><div id="toast" hidden></div>`;
}

interface Walk { state: GameState; sim: Sim; clock: number; panel: Any; ledger: boolean; done: boolean }
const $ = (id: string) => document.getElementById(id) as Any;
/** What main.ts does around the ledger, without the room. */
function ledger(w: Walk): Any {
  const purchase = (kind: string, id: string) => {
    if (kind === 'upgrade' && id === 'tables') { const moved = call('furniture', 'evictBlocked', [w.state, call('regions', 'mainTableCount', [w.state])]) as number; if (moved > 0) toast(t('toast.evicted', { n: moved })); }
    save(w);
    if (kind === 'goal') toast(t('goal.claimed', { reward: formatMoney(Number(id)) }));
  };
  const away = () => { w.ledger = false; };
  const panel = new ui.Panel($('management-panel'), $('list'), $('goal'), w.state, purchase, away, {}, away, away);
  $('management-panel').addEventListener('open-branch', () => branchMap(w));
  return panel;
}
function branchMap(w: Walk): void {
  if (call('chain', 'canOpenBranch', [w.state])) ui.showBranchMap(w.state, (location: string) => confirmBranch(w, location));
}
function confirmBranch(w: Walk, location: string): void {
  const s = w.state, chain = MODS.chain as Any, bonuses = MODS['chain-bonuses'] as Any;
  if (!chain.canOpenBranch(s)) return;
  const stars = chain.starsOnBranch(s), here = call('locations', 'cafeLocation', [s]) as Any, body = document.createElement('div');
  const perks = t('chain.perks', { pct: Math.round((MODS.regions as Any).buildShare(s.chain.branches + 1) * 100) });
  for (const text of [t('chain.confirm.where', { place: ui.locationName(location) }), t('chain.confirm.body', { stars, bonus: chain.chainBonusPercent(bonuses.starsFree(s) + stars) }),
    t('chain.confirm.franchise', { place: ui.locationName(here), money: formatTransactionMoney((MODS.manager as Any).awayHourly(s) * chain.FRANCHISE_SHARE), bonus: ui.placeBonusText(here, bonuses.franchisesIn(s, here) + 1) }), t('chain.confirm.resets'), t('chain.confirm.keeps'), perks]) { const p = document.createElement('p'); p.textContent = text; body.append(p); }
  showModal({ title: t('chain.confirm.title'), body, buttons: [{ label: t('chain.confirm.cancel'), primary: true, onClick: () => branchMap(w) }, { label: t('chain.confirm.ok'), danger: true, onClick: () => {
    const next = chain.openBranch(w.state, location, w.clock) as GameState | null; if (!next) return;
    w.state = next; call('furniture', 'settleInBuilding', [w.state]); w.ledger = false; w.done = true;
    toast(t('chain.opened', { stars: w.state.chain.stars, bonus: chain.chainBonusPercent(bonuses.starsFree(w.state)) }));
  } }] });
}
/** Saving during service looks at who is on duty. */
const save = (w: Walk) => { if (w.state.phase !== 'prep') w.sim.snapshot(w.state); };
const changed = (w: Walk) => () => { save(w); w.panel.refresh(); };
function startDay(w: Walk): void {
  if (w.state.phase !== 'prep' || !(call('economy', 'menuItems', [w.state]) as unknown[]).length) return;
  const baked = call('day', 'openShop', [w.state]) as number;
  save(w);
  toast(baked > 0 ? t('toast.openedBaked', { n: w.state.day, baked }) : t('toast.opened', { n: w.state.day }));
}
function prepare(w: Walk): void { if (w.state.phase === 'prep') ui.showPrepare(w.state, () => startDay(w), changed(w)); }
function report(w: Walk, of: Any): void {
  ui.showSettlement(of, w.state, {
    onNext: () => { if (!call('manager', 'managerRunsDays', [w.state])) prepare(w); },
    onTab: (tab: string) => { w.ledger = true; w.panel.showTab(tab); },
    onClaim: (kind: string, id: string) => {
      save(w);
      if (kind === 'goal') toast(t('goal.claimed', { reward: formatMoney(Number(id)) }));
      w.panel.refresh();
    },
    onTrialChange: changed(w),
    onStorySave: () => save(w),
  });
}

// ---------------------------------------------------------------- the screens

type Opener = (w: Walk, arg: Any, shot: Shot) => void;
const SCREENS: Record<string, Opener> = {
  ledger: (w, tab) => { w.ledger = true; w.panel.showTab(tab); },
  intro: (w) => { w.ledger = true; w.panel.showTab('menu'); w.panel.setIntroMode(true); },
  prepare,
  firstOpening: (w, step) => ui.showFirstOpening(w.state, () => startDay(w), changed(w), { step, confirmStock: () => {}, advanced: () => prepare(w) }),
  report: (w, _a, shot) => report(w, structuredClone(shot.report)),
  reputation: (w) => ui.showReputation(w.state),
  money: (w, price) => ui.showMoneyDetails(w.state.coins, price ?? undefined),
  partners: (w, id) => ui.showPartners(w.state, w.sim, () => save(w), id ?? undefined),
  regulars: (w) => ui.showRegularGuests(w.state, () => save(w)),
  styles: (w) => ui.showCafeStyles(w.state, changed(w)),
  taste: (w, id) => ui.showTaste(w.state, id, () => {}),
  book: (w) => ui.showMilestoneBook(w.state),
  perks: (w) => ui.showChainPerks(w.state, () => {}),
  map: (w) => branchMap(w),
  lab: (w) => ui.showSignatureDrinks(w.state, changed(w)),
  street: (w) => ui.showStreetMap(w.state, changed(w), () => {}),
  projects: (w) => ui.showRoomProjects(w.state, changed(w)),
  soldOut: (w) => ui.showSoldOut(w.state, () => { w.sim.resumeAfterRestock(w.state); save(w); }, () => save(w)),
  recommend: (w, guest) => { const c = w.sim.customers.find((x) => x.id === guest) as Any; ui.showRecommendation(w.state, c, [...new Set([c.order, ...w.state.onMenu])].slice(0, 3), () => {}, () => {}); },
  trial: (w) => showModal({ title: t('trial.title'), body: ui.trialResultCard(w.state, changed(w)), buttons: [{ label: t('settings.back') }] }),
  cat: (w, id) => ui.showLivingCat(w.state.pets.find((p) => p.id === id), undefined, () => toast(t('pet.living.needsCare')), () => {}),
};
const BENCH = ['confirm-delete', 'save', 'name', 'trial', 'buy-trial', 'create', 'toggle-menu', 'rename', 'edit', 'delete', 'detail'];
const NAMES = ['', 'Late Bloom', '12', '夜雨特调', '  '];

/** Cafés a short career seldom reaches: rich or broke, with streets, a chain, orders, milestones, wishes and memories. */
function vary(shot: Shot, r: Random): Shot {
  const s = structuredClone(shot.state), now = shot.now, all = MODS as Any;
  const maybe = (chance: number, f: () => void) => { if (r.chance(chance)) try { f(); } catch { /* not for this café */ } };
  Date.now = () => Math.floor(now);
  const prepping = s.phase === 'prep';
  maybe(.5, () => { s.day = Math.max(s.day, r.pick([1, 2, 3, 5, 12])); });
  maybe(.7, () => all.economy.earn(s, r.pick([1e3, 1e5, 1e7])));
  if (prepping) {
    maybe(.5, () => { s.regions = ['reading', 'greenhouse', 'terrace'].slice(0, r.int(4)) as Any; });
    maybe(.25, () => { s.chain.stars += 1 + r.int(40); for (let n = r.int(4); n > 0; n--) all['chain-bonuses'].buyPerk(s, r.pick(all['chain-bonuses'].PERKS as Any[]).id); });
    maybe(.25, () => { s.regions = ['reading', 'greenhouse', 'terrace'] as Any; all.economy.earn(s, 1e8); const next = all.chain.openBranch(s, r.pick(all.locations.LOCATION_IDS), now); if (next) { Object.keys(s).forEach((k) => delete (s as Any)[k]); Object.assign(s, next); all.economy.earn(s, 1e6); s.regions = ['terrace'] as Any; } });
    maybe(.6, () => { for (let n = 2 + r.int(4); n > 0; n--) { const street = r.pick(all.streets.STREETS as Any[]).id, plot = r.pick(all.streets.STREET_PLOTS as Any[]).id, id = all.streets.streetLotId(street, plot), at = now - r.pick([0, 1e5, 1e7]); if (all.streets.buyStreetPlot(s, street, plot, at) && r.chance(.6)) all.streets.fitOutStreetPlot(s, id, r.pick(all.streets.BUSINESSES as Any[]).id, at); } });
    maybe(.5, () => { s.roomProjects.inspiration += r.int(400); all['room-projects'].upgradeProject(s, 'postcards', now - 1e7); for (const p of all['room-projects'].ROOM_PROJECTS) all['room-projects'].upgradeProject(s, p.id, now - r.pick([0, 1e6, 1e8])); if (r.chance(.4)) all['room-projects'].buyBlueprint(s, r.pick(all['room-projects'].BLUEPRINTS as Any[]).id, now); });
    maybe(.5, () => { s.manager.hired = true; s.manager.till = r.int(4); s.manager.auto = r.chance(.5); all.orders.startOrder(s, r.pick(all.orders.ORDERS as Any[]).id, now - r.pick([0, 0, 1e8])); });
    maybe(.3, () => { for (const c of all.pets.CATS.slice(0, r.int(4))) all.pets.adoptCat(s, c.id); for (const p of s.pets) p.careSeconds = r.pick([0, 30, all.pets.MAX_CARE_SECONDS - all.pets.CARE_SECONDS + r.pick([-1, 0, 5]), all.pets.MAX_CARE_SECONDS, p.careSeconds]); });
    maybe(.3, () => { all.styles.setCafeStyle(s, r.pick([...all.styles.STYLE_IDS, null])); if (r.chance(.6) && s.cafeStyle.focus) all.styles.startStyleWelcome(s, s.cafeStyle.focus); });
    maybe(.3, () => { all.promotion.bookPromotion(s, r.pick(all.promotion.PROMOTION_PLANS as Any[]).id); if (r.chance(.4)) all.promotion.togglePromotion(s); });
    maybe(.3, () => { s.kitchen = true; for (const m of IDS.menu) if (r.chance(.5)) s.items[m as Any] = Math.max(1, s.items[m as Any] ?? 0); s.onMenu = IDS.menu.filter((m) => r.chance(.4) && s.items[m as Any] > 0) as Any; });
    maybe(.3, () => { for (const id of IDS.ingredient) s.pantry[id as Any] = r.pick([0, 1, 3, 40]); });
    maybe(.25, () => { s.coins = r.pick([0, 1.5, 12]); s.pantry.beans = 0; });
    maybe(.35, () => { for (const id of IDS.menu) s.taste.served[id as Any] = r.pick([0, 12, 40, 130]); });
  }
  maybe(.4, () => { s.goal = all.goals.GOALS.length; const chapters = all.milestones.CHAPTERS as Any[]; const far = r.int(4); s.milestones.done = chapters.slice(0, far + 1).flatMap((c, i) => c.milestones.filter(() => i < far || r.chance(.75)).map((m: Any) => m.id)) as Any; s.milestones.claimed = chapters.slice(0, r.int(far + 1)).map((c) => c.id) as Any; Object.assign(s.milestones.records, { bestDay: r.int(200), bestSmoothDay: r.int(200), momentsAnswered: r.int(80) }); s.served = r.pick([s.served, 900, 4000]); });
  maybe(.2, () => { s.goal = r.int(all.goals.GOALS.length); });
  maybe(.25, () => { s.goal = all.goals.GOALS.length; s.milestones.done = []; s.milestones.claimed = []; });
  maybe(.5, () => { for (const u of IDS.upgrade) s.upgrades[u as Any] = r.int(6); });
  maybe(.5, () => { const c = s.cafeStyle as Any; for (const k of Object.keys(c.handoffs ?? {})) c.handoffs[k] = r.pick([0, 5, 40, 600]); s.served = r.pick([s.served, 40, 700]); s.taste.signature = IDS.menu.filter(() => r.chance(.3)) as Any; });
  maybe(.3, () => { s.chain.franchises = all.locations.LOCATION_IDS.slice(0, 1 + r.int(5)).map((location: string) => ({ location, hourly: 40 })); s.chain.collectedAt = now - r.pick([0, 1e6, 1e9]); s.chain.branches = Math.max(s.chain.branches, s.chain.franchises.length); });
  maybe(.5, () => { for (const guest of (all['regular-guests-content'] as Any).REGULAR_GUESTS) if (r.chance(.5)) { const n = r.int(guest.chapters.length + 1); s.regularGuests.guests[guest.id as Any] = { firstMetDay: 1, served: n + r.int(3), unlockedChapters: Array.from({ length: n }, (_, i) => i), readChapters: Array.from({ length: n }, (_, i) => i).filter(() => r.chance(.5)), lastUnlockDay: 1, servedVisitIds: [], pendingVisitIds: [], pendingDay: 1 } as Any; } });
  maybe(.5, () => { s.regularGuests.guests.mina ??= { firstMetDay: 1, served: 2, unlockedChapters: [0], readChapters: [], lastUnlockDay: 1, servedVisitIds: [], pendingVisitIds: [], pendingDay: 1 } as Any; const rehearsed = r.chance(.5) ? s.day : null; s.regularWishes = { mina: r.chance(.2) ? null : { choice: r.pick(['quiet', 'milky']), acceptedDay: 1, paused: r.chance(.2), rehearsedDay: rehearsed, completedDay: rehearsed && r.chance(.5) ? s.day : null, displayed: r.chance(.5) } } as Any; });
  maybe(.5, () => { for (const id of [3, 7, 11, 18]) if (r.chance(.6)) (s.guestMemories as Any)[id] = { item: r.pick(IDS.menu), source: r.pick(['recommend', 'trial']), learnedDay: r.pick([s.day, Math.max(1, s.day - 1)]), lastServedDay: s.day, returns: r.int(3) }; });
  maybe(.5, () => { s.reputation.recent = Array.from({ length: r.int(12) }, () => ({ stars: r.pick([1, 2, 3.5, 4, 4.5, 5]), reason: r.pick(all.reputation.REVIEW_REASONS), day: s.day, ...(r.chance(.5) ? { taste: 4.5, items: [r.pick(IDS.menu)] } : {}) })) as Any; });
  maybe(.4, () => { const at = all['signature-drinks'], ids = [['coffee', { beans: 1, milk: 1 }], ['coffee', { beans: 2, sugar: 1 }], ['tea', { tea: 1, milk: 1 }], ['tea', { tea: 1, sugar: 2 }]].map(([base, recipe]) => at.makeSignatureId(base, recipe)).filter(Boolean) as string[]; const all3 = r.chance(.5); s.signatureDrinks.recipes = ids.slice(0, all3 ? 4 : 1 + r.int(4)).map((id, n) => ({ id, name: `特调 ${n}`, onMenu: n < 3 && (all3 || r.chance(.6)) })) as Any; s.signatureDrinks.tested = ids as Any; for (const id of ids) s.signatureDrinks.served[id as Any] = r.pick([0, 31, 120]); });
  maybe(.4, () => { const off = s.signatureDrinks.recipes.find((x) => !x.onMenu)?.id as string | undefined, drink = off && r.chance(.6) ? off : r.pick([...s.signatureDrinks.recipes.map((x) => x.id as string), 'latte', 'mocha', 'americano', 'espresso']); const last = { day: s.day, item: drink, prepared: 3, served: r.int(4), revenue: 12.5, ingredientCost: 4, feedback: { loved: 1, balanced: 1, mismatch: 0 }, qualityBefore: 4, qualityAfter: 4.1 }; (s.trialSales as Any).last = { ...(s.trialSales as Any).last, ...last }; });
  let report = structuredClone(shot.report) as Any;
  if (report) {
    const some = (chance: number, n: number) => (r.chance(chance) ? 1 + r.int(n) : 0);
    maybe(.5, () => { report.soldOut = some(.5, 9); report.extraLost = some(.5, 5); report.queueLost = some(.5, 9); report.doorLost = some(.4, 9); report.tableLost = some(.4, 5); report.missed = report.soldOut + report.queueLost + report.tableLost; });
    maybe(.5, () => { for (const id of IDS.menu) { if (r.chance(.15)) report.stale[id] = 1 + r.int(9); if (r.chance(.15)) report.shortages[id] = 1 + r.int(9); if (r.chance(.1)) report.baked[id] = 5 + r.int(9); } report.staleCost = some(.8, 40); report.shelfSoldOut = IDS.menu.filter(() => r.chance(.06)); report.outOfStock = IDS.menu.filter(() => r.chance(.06)); });
    maybe(.3, () => { report.profit = r.pick([-30.5, -2, 0, 12]); report.petCost = some(.5, 20); report.promotionCost = some(.5, 60); });
    maybe(.2, () => { report.served = 0; report.bestSeller = null; report.duration = r.pick([0.2, 5]); });
    maybe(.3, () => { report.newMilestones = ['served1000', 'rating40'].filter(() => r.chance(.7)); });
    maybe(.4, () => { report.partners = (all.partners.PARTNERS as Any[]).filter(() => r.chance(.2)).map((p) => ({ id: p.id, jobs: 1 + r.int(9), xp: 1 + r.int(9), unlocked: r.int(2) })); for (const p of report.partners) (s.partners.roster as Any)[p.id] = { ...(s.partners.roster as Any)[p.id], ...all.partners.freshPartner?.(), unlocked: 2, read: [] }; });
    maybe(.4, () => { if ((s.trialSales as Any).last) report.trialSale = structuredClone((s.trialSales as Any).last); });
    maybe(.3, () => { for (const k of all['customer-demand'].GUEST_KINDS) report.guests[k] = { ...report.guests[k], arrived: 9, served: r.int(9), paired: r.int(4), revenue: 12.25, stockLost: r.int(2), waitLost: r.int(2), cancelled: r.int(2), dismissed: r.int(2) }; });
    maybe(.3, () => { for (const reason of all.reputation.REVIEW_REASONS) if (r.chance(.4)) report.reviews.reasons[reason] = 1 + r.int(5); });
  }
  // Only what a save can hold: both sides start from the same one.
  const state = { ...(call('state', 'deserialize', [call('state', 'serialize', [s]), now]) as GameState) };
  return { ...shot, state: shot.snapshot ? shot.state : state, report };
}

function walkThrough(shot: Shot, locale: 'en' | 'zh', screen: string, arg: unknown, seed: number, presses: number): unknown {
  const r = new Random(lcg(seed));
  setLocale(locale);
  Date.now = () => Math.floor(shot.now);
  Math.random = () => .5;
  closeModal(); markup();
  const state = structuredClone(shot.state), sim = new (MODS.sim.Sim as new (r: () => number) => Sim)(lcg(seed + 1));
  if (shot.snapshot && !sim.restore(structuredClone(shot.snapshot), state)) return null;
  const w: Walk = { state, sim, clock: Math.floor(shot.now), panel: null, ledger: false, done: false };
  w.panel = ledger(w); w.panel.setSimplifiedTabs(false); w.panel.refresh();
  const root = () => (document.querySelector('.modal') ? document.querySelector('.modal .street-view') ?? document.querySelector('.modal') : w.ledger ? $('management-panel') : null);
  const steps: Any[] = [];
  const look = (act: unknown) => {
    // The page's heartbeat, four times a second.
    ticks += r.pick([350, 1000, 1000]); ui.updateStreetMap(); ui.updateRoomProjectsBook();
    if (w.ledger && !isModalOpen()) w.panel.update();
    const list = root() ? tokens(root()) : [];
    steps.push({ act, ticks, note: $('toast').hidden ? '' : squash($('toast').textContent), seen: list.map(({ k, v, on }) => (k === 'text' ? v : [k, v, on])) });
    return list;
  };
  SCREENS[screen](w, arg, shot);
  const used = new Set<string>(), walkSeed = seed;
  let list = look(null);
  for (let i = 0; i < presses && list.length && !w.done; i++) {
    const can = list.filter((x) => x.k !== 'text' && x.on);
    if (!can.length) break;
    // Rather a button of the screen than the last one, which closes it.
    const most = Math.max(1, can.length - (w.ledger && !isModalOpen() || can.length < 4 || r.chance(.15) ? 0 : 1));
    // The street's open lot and the bench's next steps come last on their screens.
    const likely = ['street', 'lab'].includes(screen) && r.chance(.5) ? Math.max(0, most - 1 - r.int(6)) : r.int(most);
    // At the bench, half of the time what leads to a saved drink, and then to its end.
    const led = screen === 'lab' && i % 8 < 7 && walkSeed % 2 ? BENCH.map((k) => can.findIndex((c) => !used.has(k) && (k === 'name' ? c.k === 'entry' : c.el.dataset.signatureAction?.split(':')[0] === k))).find((n) => n >= 0) : undefined;
    const at = led ?? likely, x = can[at];
    if (led !== undefined) used.add(x.k === 'entry' ? 'name' : x.el.dataset.signatureAction.split(':')[0]);
    $('toast').hidden = true;
    let value: unknown = null;
    if (x.k === 'button') x.el.click();
    else if (x.k === 'box') { x.el.checked = !x.el.checked; x.el.dispatchEvent(new page.Event('change', { bubbles: true })); }
    else if (x.k === 'fold') { x.el.open = !x.el.open; x.el.dispatchEvent(new page.Event('toggle')); }
    else if (x.k === 'list') { const open = [...x.el.options].map((o: Any, n: number) => [o, n]).filter(([o]: Any) => !o.disabled).map(([, n]: Any) => n); const next = open[(open.indexOf(x.el.selectedIndex) + 1) % open.length]; value = next; x.el.selectedIndex = next; x.el.dispatchEvent(new page.Event('change', { bubbles: true })); }
    else { value = screen === 'lab' && used.has('name') ? `夜雨特调${r.int(9)}` : r.pick(NAMES); x.el.value = x.el.type === 'number' ? (value = String(r.int(60))) : value; x.el.dispatchEvent(new page.Event('input', { bubbles: true })); x.el.dispatchEvent(new page.Event('change', { bubbles: true })); }
    list = look([at, value]);
  }
  return { screen, arg: wire(arg), locale, clock: wire(shot.now), seed: seed + 1, state: wire(shot.state), snapshot: wire(shot.snapshot), report: wire(shot.report), steps, end: call('state', 'serialize', [w.state]) };
}

// Several processes share the walks: <out> <which of four> [screen,…].
const out = process.argv[2], part = Number(process.argv[3]), only = process.argv[4];
mkdirSync(out, { recursive: true }); rmSync(join(out, `${part}.jsonl`), { force: true });
const shots: Shot[] = [];
for (let seed = 1; seed <= 24; seed++) play(seed, 10, (shot) => shots.push(shot));
const r = new Random(lcg(4242)), prep = shots.filter((s) => s.tag === 'prep'), open = shots.filter((s) => s.snapshot && s.state.phase === 'open'), closed = shots.filter((s) => s.report);
const varied = (list: Shot[], n: number) => pickOf(list, n).map((s) => vary(s, r));
const pickOf = (list: Shot[], n: number) => Array.from({ length: n }, (_, i) => list[Math.floor(i * list.length / n)]).filter(Boolean);
const plan: [Shot, string, unknown][] = [];
const add = (list: Shot[], n: number, screen: string, arg: (s: Shot) => unknown = () => null, where: (s: Shot) => boolean = () => true) => { for (const s of pickOf(list.filter(where), n)) plan.push([s, screen, arg(s)]); };
for (const tab of tabs) { add(prep, 14, 'ledger', () => tab); add(open, 6, 'ledger', () => tab); }
add(prep, 6, 'intro'); add(prep, 30, 'prepare'); add(prep, 6, 'firstOpening', () => r.pick(['stock', 'menu']), (s) => s.state.day === 1);
add(closed, 26, 'report'); add(shots, 8, 'reputation'); add(prep, 6, 'money', () => r.pick([null, 10, 1e9]));
add(prep, 10, 'partners', () => null); add(prep, 14, 'partners', () => r.pick((MODS.partners as Any).PARTNERS).id); add(open, 8, 'partners', () => r.pick((MODS.partners as Any).PARTNERS).id);
add(shots, 14, 'regulars', () => null, (s) => Object.keys(s.state.regularGuests.guests).length > 0); add(prep, 4, 'regulars'); add(prep, 16, 'styles'); add(open, 4, 'styles');
add(prep, 16, 'taste', () => r.pick(IDS.menu)); add(shots, 10, 'book'); add(prep, 8, 'perks'); add(prep, 8, 'perks', () => null, (s) => s.state.chain.stars > 0); add(pickOf(prep, 10).map((s) => { const state = structuredClone(s.state); state.regions = ['reading', 'greenhouse', 'terrace'] as GameState['regions']; call('economy', 'earn', [state, 1e9]); return { ...s, state }; }), 10, 'map', () => null, (s) => call('chain', 'canOpenBranch', [s.state]) as boolean);
add(prep, 20, 'lab'); add(prep, 12, 'lab', () => null, (s) => s.state.signatureDrinks.recipes.length > 0); add(open, 4, 'lab');
add(prep, 20, 'street'); add(prep, 16, 'street', () => null, (s) => Object.keys(s.state.streets.lots).length > 0); add(prep, 12, 'projects'); add(open, 10, 'soldOut');
add(open, 12, 'recommend', (s) => (s.customers as Any[]).find((c) => c.phase === 'queue')?.id, (s) => (s.customers as Any[]).some((c) => c.phase === 'queue')); add(prep, 8, 'cat', (s) => s.state.pets[0].id, (s) => s.state.pets.length > 0);

// The same screens on cafés further along, or worse off.
for (const tab of tabs) add(varied(prep, 24), 24, 'ledger', () => tab);
add(varied(prep, 40), 40, 'prepare'); add(varied(closed, 150), 150, 'report'); add(varied(prep, 14), 14, 'reputation'); add(varied(prep, 24), 24, 'styles'); add(varied(prep, 16), 16, 'book'); add(varied(prep, 12), 12, 'perks'); add(varied(prep, 60), 60, 'street'); add(varied(prep, 16), 16, 'projects');
add(varied(prep, 24), 24, 'regulars'); add(varied(prep, 12), 12, 'map', () => null, (s) => call('chain', 'canOpenBranch', [s.state]) as boolean); add(varied(prep, 50), 50, 'taste', () => r.pick(IDS.menu)); add(varied(prep, 16), 16, 'lab'); add(varied(prep, 14), 14, 'partners', () => r.pick((MODS.partners as Any).PARTNERS).id);
const pressed = new Map<string, number>();
let walks = 0, looks = 0;
add(varied(prep, 40), 40, 'lab');
// How a trial went: of a house drink, with room for it on the menu or without.
add(pickOf(prep, 24).map((s) => { const state = structuredClone(s.state), at = MODS['signature-drinks'] as Any, ids = [['coffee', { beans: 1, milk: 1 }], ['coffee', { beans: 2, sugar: 1 }], ['tea', { tea: 1, milk: 1 }], ['tea', { tea: 1, sugar: 2 }]].map(([base, recipe]) => at.makeSignatureId(base, recipe)) as string[], full = r.chance(.5);
  state.signatureDrinks.recipes = ids.map((id, n) => ({ id, name: `特调 ${n}`, onMenu: n < (full ? 3 : 1) })) as Any;
  (state.trialSales as Any).last = { day: state.day, item: r.pick([ids[3], ids[3], ids[0], 'espresso']), name: '特调', prepared: 4, served: r.int(5), revenue: 12.5, ingredientCost: 4, feedback: { loved: 1, balanced: 2, mismatch: 0 }, qualityBefore: 4, qualityAfter: 4.1 }; return { ...s, state }; }), 24, 'trial');
plan.forEach(([shot, screen, arg], i) => {
  if (i % 4 !== part || (only && !only.split(',').includes(screen))) return;
  const walk = walkThrough(shot, i % 3 ? 'zh' : 'en', screen, arg, 9000 + i * 7, ['ledger', 'prepare', 'lab', 'street', 'report'].includes(screen) ? 14 : 8) as Any;
  if (!walk) return;
  walks++; looks += walk.steps.length;
  pressed.set(screen, (pressed.get(screen) ?? 0) + walk.steps.length - 1);
  appendFileSync(join(out, `${part}.jsonl`), `${JSON.stringify(walk)}\n`);
});
// Every hint a style's goal can give, also those no short career comes to.
if (part === 0 && !only) {
  const source = styleSource.slice(styleSource.indexOf('function goalHint'), styleSource.indexOf('export function updateCafeStyleButton')).replace('(goal: StyleGoal, focus: CafeStyleId): string', '(goal, focus)');
  const goalHint = new Function('t', `${source}; return goalHint;`)((key: string) => key) as (goal: Any, focus: string) => string, rows: unknown[] = [];
  for (const style of (MODS.styles as Any).STYLE_IDS) for (const stage of call('styles', 'styleStages', [shots[0].state, style]) as Any[]) for (const goal of stage.goals) rows.push([goal.id, style, goalHint(goal, style)]);
  appendFileSync(join(out, '0.jsonl'), `${JSON.stringify({ screen: 'hints', rows })}\n`);
  walks++;
}
console.log(JSON.stringify({ walks, looks, pressed: Object.fromEntries(pressed), screens: Object.keys(SCREENS) }));
