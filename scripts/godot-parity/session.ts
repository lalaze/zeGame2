// Plays whole careers through main.ts's own functions (see main-source.mjs) and writes down every step for
// `godot/tests/run_session.gd` to repeat with `godot/core/game_session.gd`: thirty days for several seeds and three
// ways of running a café, with absences, restarts and storage that fails along the way.
// A line is a few frames: what the player did before the first, and after the last the state, the simulation, the
// moments, the cats, the save, the session's own variables, the random numbers drawn and everything the page was told.
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startCoverage, stopCoverage, stretches } from './coverage';
import { MODS, call } from './mods';
import { EPOCH, IDS, Random, prepOp, recipe, run, serviceOp, type Op } from './ops';
import { lcg, wire, type Rng } from './wire';
import { setLocale } from '../../src/i18n';
import { cafeInteractionEnabled } from '../../src/ui/cafe-interaction';
import { acquireSaveSession, type SaveSession } from '../../src/game/save-session';
import { GuardedStorage } from '../../src/game/storage';
import type { LivingCats } from '../../src/game/living-cats';
import type { MomentDirector } from '../../src/game/moments';
import type { OperationMonitor } from '../../src/game/operations';
import type { GameState } from '../../src/game/state';
import type { Sim } from '../../src/game/sim';

type Dict = Record<string, unknown>;
type Any = (...a: unknown[]) => unknown;
/** Anything the page has that the rules only poke at. */
interface Element { textContent: string; hidden: boolean; children: Element[]; [key: string]: unknown }
export interface Game {
  frame(dt: number): void; saveGame(): void; startDay(): void; closeDay(confirmed?: boolean): void; prepareDay(): void; startBranch(location: string): void; resetGame(): void; pickUpGift(id: number): void; openMoment(): void;
  helpBrew(): boolean; serviceHelpOptions(): { title: string; detail: string; guest?: { id: number }; perform(): boolean }[]; panelChanged(kind: string, id: string): void; applyProfile(r: Dict): void; greetResident(id: string): void;
  locateResident(id: string): void; areaSelected(area: string): void; fitCanvas(): void; readonly state: GameState; readonly sim: Sim; set(name: string, value: unknown): void; inside(): Dict;
}
export type MakeGame = (page: Dict) => Game;

const view = Buffer.alloc(8);
function canon(v: unknown): string {
  if (v === undefined) return 'u';
  if (v === null) return 'n';
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (typeof v === 'number') { view.writeDoubleLE(Number.isNaN(v) ? NaN : v); return Number.isNaN(v) ? 'd000000000000f87f' : `d${view.toString('hex')}`; }
  if (typeof v === 'string') return `s${JSON.stringify(v)}`;
  if (Array.isArray(v)) return `[${v.map(canon).join()}]`;
  return `{${Object.keys(v as Dict).filter((k) => typeof (v as Dict)[k] !== 'function').map((k) => `${k}:${canon((v as Dict)[k])}`).join()}}`; // Functions are code, not data.
}
const digest = (v: unknown): string => createHash('sha256').update(canon(v)).digest('hex').slice(0, 20);
const layout = MODS.layout as Record<string, Any>;

class MemoryStore {
  items = new Map<string, string>(); failReads = false; failWrites = false;
  getItem(key: string): string | null { if (this.failReads) throw new Error('denied'); return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { if (this.failWrites) throw new Error('full'); this.items.set(key, value); }
}
const element = (): Element => {
  const el: Element = { textContent: '', hidden: false, children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, body: null };
  Object.assign(el, { append: (...c: Element[]) => { el.children.push(...c); }, prepend() {}, after() {}, setAttribute() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], remove() {}, focus() {}, replaceChildren() {} });
  return el;
};
/** Numbers and text the same whatever the page shows. */
const t = (key: string, params?: Dict): string => key + (params && Object.keys(params).length ? JSON.stringify(params) : '');

/** One launch of the game: the page main.ts's functions run in. */
class Page {
  log: unknown[] = [];
  modal = false; onboarding = false; notice = false; hidden = false; drawer = false; street = false; mobile = false;
  step: string | null = null; simplify = false;
  game!: Game;
  cats: LivingCats; moments: MomentDirector; monitor: OperationMonitor;
  buttons: { onClick?(): void }[] = [];
  changed: () => void = () => {};
  trialAgain: () => void = () => {};
  storyRead: () => void = () => {};
  soldOut: { resume(): void; finish(): void } | null = null;
  recommend: { pick(item: string): void; dismiss(): void } | null = null;
  onboarded: ((r: Dict) => void) | null = null;
  scene!: Dict;
  private sparkles = 0;
  private visibility: () => void = () => {};
  private closing: () => void = () => {};
  private startup: () => void = () => {};
  private autosave: () => void = () => {};
  private autosaveSeconds = 0;
  private autosaveLeft = 0;

  constructor(make: MakeGame, readonly session: SaveSession, storage: GuardedStorage, mrng: Rng, crng: Rng) {
    this.cats = new (MODS['living-cats'].LivingCats as new (r: Rng) => LivingCats)(crng);
    this.moments = new (MODS.moments.MomentDirector as new (r: Rng) => MomentDirector)(mrng);
    this.monitor = new (MODS.operations.OperationMonitor as new () => OperationMonitor)();
    const save = session.save.bind(session);
    session.save = (state) => { const result = save(state); this.note('saved', result); return result; };
    this.game = make(this.surroundings(storage));
  }
  /** What the page was told; sparkles arrive one by one. */
  note(what: string, ...args: unknown[]): void { this.flush(); this.log.push([what, ...args]); }
  private flush(): void { if (this.sparkles) { this.log.push(['sparkles', this.sparkles]); this.sparkles = 0; } }
  taken(): unknown[] { this.flush(); const out = this.log; this.log = []; return out; }
  start(): void { this.startup(); }
  setHidden(v: boolean): void { this.hidden = v; this.visibility(); }
  close(): void { this.closing(); }
  /** Timers run on real seconds, paused or not. */
  pass(dt: number): void { this.autosaveLeft -= dt; while (this.autosaveLeft <= 1e-9) { this.autosaveLeft += this.autosaveSeconds; this.autosave(); } }

  private surroundings(storage: GuardedStorage): Dict {
    const page = this, parts = new Map<string, Element>(), $ = (id: string) => { if (!parts.has(id)) parts.set(id, element()); return parts.get(id)!; };
    const names = (el: Element): string[] => (el.textContent ? [el.textContent] : el.children.flatMap(names));
    const openBtn = element(), scene = {
      paused: true, area: 'main', overview: false, panning: false, livingCats: this.cats, selectedCat: null, ghost: null, gifts: [], moment: null, momentReaction: null, catSpot: null, tablePreview: false, renderSuspended: false,
      addEvents: (e: unknown[]) => { if (e.length) this.note('events', digest(e)); }, sparkle: () => { this.sparkles++; }, update() {}, setOverview() {}, moveToArea(area: string) { this.area = area; this.overview = false; }, selectResidentCat() {}, focusResidentCat() {},
      // As CafeView.petResidentCat and petCat, without the picture.
      petResidentCat: (id: string) => { if (!this.cats.actors.has(id as never) || !this.cats.interact(id as never)) return false; this.note('petCat', id); return true; }, petCat: () => this.note('petCat', null),
      tipAtMoment: (n: number) => this.note('tipAtMoment', n), flashAtMoment: () => this.note('flashAtMoment'), tipAtGift: (id: number, n: number) => this.note('tipAtGift', id, n),
      assistance: (text: string, who: Dict, kind?: string) => this.note('assist', text, kind === 'brew' ? digest(who) : who.id),
    };
    this.scene = scene;
    const document = {
      get hidden() { return page.hidden; }, fonts: { ready: null }, documentElement: element(), body: element(), title: '',
      getElementById: (id: string) => (id === 'save-session-notice' && page.notice ? { remove() { page.notice = false; } } : null),
      querySelector: (q: string) => (q === '.onboard-overlay' && page.onboarding || q === '.street-overlay' && page.street ? element() : null), querySelectorAll: () => [], createElement: () => Object.assign(element(), { querySelector: element }),
      addEventListener: (kind: string, f: () => void) => { if (kind === 'visibilitychange') page.visibility = f; },
    };
    const speedBtns = (MODS.data.SPEEDS as number[]).map((v) => ({ ...element(), dataset: { speed: String(v) }, addEventListener: (_: string, f: () => void) => { page.speeds.set(v, f); } }));
    (globalThis as unknown as Dict).document = document; // For cafeInteractionEnabled.
    return {
      cafeInteractionEnabled, session: this.session, storage, moments: this.moments, scene, operationMonitor: this.monitor, $, document, t, speedBtns, floorsView: true, reducedMotion: { matches: true },
      panel: { refresh: () => this.note('refresh'), update() {}, setState: () => this.note('state'), clearTablePreview() {}, tablePreviewRequested: false, captureBrowsingContext: () => null, showTab() {} },
      drawer: { get paused() { return page.drawer; }, media: { matches: true } }, guide: { get simplify() { return page.simplify; }, get openingStep() { return page.step; }, reset() {}, update() {}, confirmStock() {} },
      get mobileHud() { return { get expanded() { return page.mobile; }, update() {}, close() {}, destroy() {} }; }, isModalOpen: () => this.modal, toast: (text: string) => this.note('toast', text),
      showModal: (o: { title: string; body: unknown; buttons: { onClick?(): void }[] }) => { this.modal = true; this.buttons = o.buttons; if (!o.title.startsWith('report.title')) this.note('modal', o.title, typeof o.body === 'string' ? [o.body] : (o.body as Element).children.map((c) => c.textContent)); },
      settlementHtml: (report: { day: number }) => { this.trialAgain = () => {}; this.note('report', digest(report)); return { body: '', recommendedTab: 'menu', advice: { claimableGoal: report.day % 2 === 0, action: {} } }; },
      guestMemoryReport: element, trialResultCard: (_s: unknown, again: () => void) => { this.trialAgain = again; return element(); }, closingStory: (_s: unknown, _r: unknown, read: () => void) => { this.storyRead = read; return element(); }, ownerIcon: () => '', showPanelTab() {}, rememberLocale() {},
      showSoldOut: (_s: unknown, resume: () => void, finish: () => void) => { this.modal = true; this.note('soldOut'); this.soldOut = { resume: () => { if (call('economy', 'restock', [this.game.state])) resume(); }, finish }; },
      showRecommendation: (_s: unknown, guest: { id: number }, options: string[], pick: (item: string) => void, dismiss: () => void) => { this.modal = true; this.note('recommend', guest.id, [...options]); this.recommend = { pick, dismiss }; },
      showPrepare: (_s: unknown, _o: unknown, changed: () => void) => { this.modal = true; this.changed = changed; this.note('prepare'); }, showFirstOpening: (_s: unknown, _o: unknown, changed: () => void, o: { step: string }) => { this.modal = true; this.changed = changed; this.note('firstOpening', o.step); },
      showOnboarding: (o: { onDone(r: Dict): void }) => { this.onboarding = true; this.note('onboarding'); this.onboarded = o.onDone; },
      sessionNotice: () => { this.notice = true; }, chinese: () => this.hidden, updateBrand: () => this.note('brand'), updateStats: () => this.note('tick'), updateLedgerTheme() {}, updateGuide: () => this.note('hud', openBtn.textContent.startsWith('manager.opening') ? openBtn.textContent : null),
      itemName: (id: string) => `item:${id}`, displayItemName: (id: string) => `item:${id}`, milestoneName: (id: string) => t(`milestone.${id}`), formatDuration: (s: number) => `dur:${s}`,
      regionsUI: { select: (area: string) => { this.note('area', area); this.game.areaSelected(area); }, update() {} }, startArrange: () => this.note('arrange'), showArrange: () => this.note('showArrange'), updatePanelVisibility: () => this.note('panel'), canvas: element(), areaName: (area: string) => area, holdPiece() {}, locateCat: () => true, catLocateExit: element(),
      stage: { ...element(), clientWidth: 390, clientHeight: 800 }, sign: element(), stats: element(), cafe: { resize() {}, ready: null, startupStatus: '', destroy() {} }, fitFullscreenRoom: () => null, roomViewport: { reset() {}, refresh() {}, destroy() {} },
      playFlow: { returnToPrevious() {}, cancelPantry() {}, update() {}, openPantry() {} }, operationBtn: element(), openBtn, closeBtn: element(), hint: { ...element(), hidden: true }, dayClockBase: element(), dayClockTraffic: element(),
      trafficSummary: element(), dayClock: element(), trafficHud: (s: GameState) => (s.phase === 'prep' ? null : { story: `at ${Math.floor(s.dayTime / 60)}` }), conditionHud: (s: GameState) => (s.day % 2 ? '' : 'rain'), updateReputationButton() {}, updateRegularGuestsButton() {}, updatePartnersButton() {}, updateCafeStyleButton() {},
      updateRoomProjectsBook() {}, updateStreetMap() {}, cafeLife: { update() {} }, coinsEl: element(), drawerBalance: element(), rateEl: element(), panelRoot: element(), previewExit: element(), sceneWrap: element(), arrangeFocus: { update() {} },
      restoreTitle() {}, updateAwayTitle() {}, setInterval: (f: () => void, ms: number) => { if (f.name !== 'updateAwayTitle') { this.autosave = f; this.autosaveSeconds = this.autosaveLeft = ms / 1000; } return 1; }, clearInterval() {}, setTimeout() {},
      waitForStartupReady: () => ({ then: (f: () => void) => { this.startup = f; return { catch() {} }; } }), requestAnimationFrame: (f: () => void) => f(), loading: { complete() {}, describe: () => '' },
      window: { devicePixelRatio: 1, dispatchEvent() {}, matchMedia: () => ({ matches: false }) }, savePage: { onClose: (f: () => void) => { this.closing = f; } },
    };
  }
  readonly speeds = new Map<number, () => void>();
}

/** Everything a Sim, the moments, the cats and the status hold; named as in lockstep.ts. */
const inside = (sim: Sim): Dict => {
  const s = sim as unknown as Dict & { customerCast: { snapshot(): unknown } };
  return { customers: s.customers, baristas: s.baristas, queue: s.queue, seats: s.seats, servers: s.servers, pass: s.pass, cooks: s.cooks, rack: s.rack, spawnTimer: s.spawnTimer, nextId: s.nextId,
    castRandomState: s.castRandomState, boostCooldown: s.boostCooldown, kitchenStage: s.kitchenStage, navigationTables: s.navigationTables, cast: s.customerCast.snapshot() };
};
const around = ({ moments, cats, monitor }: Page): Dict => {
  const m = moments as unknown as Dict & { offered: Set<number> }, c = cats as unknown as Record<string, Map<unknown, unknown>> & { reselectAfterArrival: Set<unknown>; greetedGuests: Set<unknown> }, o = monitor as unknown as Dict;
  return {
    moments: [m.active, m.reaction, m.since, m.nextGap, [...m.offered], m.deliveries, m.last, m.day, m.serial, m.recommended],
    cats: [[...c.actors], [...c.arrivals], [...c.preferences], [...c.reselectAfterArrival], c.height, [...c.guests], [...c.guestBindings], [...c.guestCooldowns], [...c.greetedGuests], c.guestCooldown, [...c.blockedSeconds]],
    monitor: [o.candidate, o.since, o.current],
  };
};

/** One way of running a café; `null` leaves the day alone. */
interface Strategy { name: string; money: number; prepare(s: GameState, r: Random, day: number): Op[]; serve(s: GameState, sim: Sim, r: Random): Op[]; speed(r: Random): number; social: number; away: number; trouble: number }
const baseCost = (id: string) => (MODS.data.MENU as { id: string; baseCost: number }[]).find((m) => m.id === id)!.baseCost;
const buyable = (s: GameState) => IDS.menu.filter((id) => !(s.items as Dict)[id]).sort((a, b) => baseCost(a) - baseCost(b));
const STRATEGIES: Strategy[] = [
  { // Keeps money back, buys little, watches the café.
    name: 'careful', money: 0, social: 0.5, away: 0.25, trouble: 0.05, speed: () => 1,
    prepare: (s, r) => [['economy', 'restock', '$S'], ...(r.chance(0.6) ? [['economy', 'bakeForForecast', '$S'] as Op] : []), ['goals', 'claimGoal', '$S'], ['milestones', 'claimChapter', '$S'],
      ...(buyable(s).length && (s.coins > 400 || IDS.menu.length - buyable(s).length < 4) ? [['economy', 'buyItem', '$S', buyable(s)[0], 1] as Op] : []), ...(s.coins > 900 ? [['economy', 'buyUpgrade', '$S', r.pick(['barista', 'tables', 'server', 'machine', 'decor']), 1] as Op] : []),
      ['economy', 'restock', '$S']],
    serve: () => [],
  },
  { // Spends everything on growth, then opens branches.
    name: 'grow', money: 4e6, social: 0.2, away: 0.5, trouble: 0.05, speed: (r) => r.pick([2, 4, 4]),
    prepare: (s, r, day) => {
      const ops: Op[] = [...Array.from({ length: 8 }, () => ['goals', 'claimGoal', '$S'] as Op), ['milestones', 'claimChapter', '$S'], ['chain', 'collectFranchises', '$S', '$N'], ['streets', 'collectStreetShops', '$S', '$N']];
      for (let n = 0; n < 6; n++) ops.push(['economy', 'buyItem', '$S', r.pick(buyable(s).slice(0, 4).concat(IDS.menu.slice(0, 3))), 1]);
      for (let n = 0; n < 8; n++) ops.push(['economy', 'buyUpgrade', '$S', r.pick(IDS.upgrade), r.pick([1, 10, 'max'] as const)]);
      for (const id of IDS.menu) if (r.chance(0.3)) ops.push(['economy', 'setOnMenu', '$S', id, true]);
      if (day === 4) ops.push(['$STATE', 'goal', (MODS.goals.GOALS as unknown[]).length]); // Past the first goals: the chapters begin.
      if (day > 3) ops.push(['manager', 'hireManager', '$S'], ['kitchen', 'unlockKitchen', '$S'], ['manager', 'upgradeTill', '$S']);
      ops.push(['promotion', 'bookPromotion', '$S', r.pick(IDS.promotion)], ['streets', 'buyStreetPlot', '$S', s.chain.location, r.pick(IDS.plot), '$N'], ['streets', 'fitOutStreetPlot', '$S', r.pick(IDS.lot), r.pick(IDS.region), '$N'],
        ['chain-bonuses', 'buyPerk', '$S', r.pick(IDS.perk)], ['regions', 'startConstruction', '$S', r.pick(IDS.region), '$N'], ['economy', 'restock', '$S'], ['economy', 'bakeForForecast', '$S']);
      return ops;
    },
    serve: (s, sim, r) => (r.chance(0.3) ? [serviceOp(s, sim, r)] : []),
  },
  { // Touches everything the game has.
    name: 'everything', money: 3e5, social: 0.6, away: 0.5, trouble: 0.15, speed: (r) => r.pick([1, 2, 4]),
    prepare: (s, r, day) => {
      const ops: Op[] = [];
      for (let n = 12 + r.int(20); n > 0; n--) ops.push(prepOp(s, r));
      if (day % 3 === 0) for (const id of IDS.ingredient) ops.push(['economy', 'buyIngredient', '$S', id, 5 + r.int(40)]);
      if (day % 5 === 1) ops.push(['pets', 'adoptCat', '$S', r.pick(IDS.cat)], ['partners', 'recruitPartner', '$S', r.pick(IDS.partner)], ['manager', 'hireManager', '$S'], ['kitchen', 'unlockKitchen', '$S'], ['signature-drinks', 'trialSignature', '$S', ...recipe(r)]);
      for (let n = 0; n < 4; n++) ops.push(['goals', 'claimGoal', '$S']);
      if (r.chance(0.25)) { // Furniture on the old grid, then tables where it stands.
        for (let n = 0; n < 6; n++) { const id = r.pick(IDS.furniture); ops.push(['$STATE', 'decor', { ...structuredClone(s.decor), stored: { ...s.decor.stored, [id]: 1 } }], ['furniture', 'placeFurniture', '$S', id, r.int(38), r.int(16), call('regions', 'mainTableCount', [s])]); }
        if (s.decor.placed.length) ops.push(['$STATE', 'decor', { ...structuredClone(s.decor), placed: [...structuredClone(s.decor.placed), structuredClone(s.decor.placed[0])] }]); // Two pieces in one place.
        ops.push(['economy', 'buyUpgrade', '$S', 'tables', r.pick([1, 10, 'max'] as const)], ['$G', 'panelChanged', 'upgrade', 'tables']);
      }
      const drinks = IDS.menu.filter((id) => call('trial-sales', 'canTrialDrink', [s, id]));
      if (drinks.length && r.chance(0.6)) { const drink = r.pick(drinks); ops.push(['trial-sales', 'selectTrialSale', '$S', drink], ...(call('economy', 'recipe', [drink]) as [string, number][]).map(([id]) => ['economy', 'buyIngredient', '$S', id, 30] as Op)); }
      if (day === 8) ops.push(['$STATE', 'goal', (MODS.goals.GOALS as unknown[]).length]);
      ops.push(['orders', 'startOrder', '$S', r.pick(IDS.order), '$N'], ['goals', 'claimGoal', '$S'], ['milestones', 'claimChapter', '$S'], ['economy', 'restock', '$S']);
      return ops;
    },
    serve: (s, sim, r) => (r.chance(0.5) ? [serviceOp(s, sim, r)] : []),
  },
];

export async function career(make: MakeGame, strategy: Strategy, seed: number, days: number): Promise<{ text: string; days: number; lines: number; frames: number; counts: Record<string, number> }> {
  const name = `${strategy.name}-${seed}`, n = STRATEGIES.indexOf(strategy) * 1000 + seed;
  const r = new Random(lcg(n * 131 + 7)), srng = lcg(n * 17 + 1), mrng = lcg(n * 19 + 2), crng = lcg(n * 23 + 3), store = new MemoryStore(), lines: string[] = [], counts: Record<string, number> = {};
  let clock = EPOCH + n * 77_777_777 + 0.5, frames = 0, reports = 0, page!: Page;
  Date.now = () => Math.floor(clock);
  setLocale('en');
  const storage = () => new GuardedStorage(() => store as unknown as Storage);
  const launch = async (height = 240): Promise<Page> => {
    Math.random = srng; // The simulation's own source; the page's sparkles use another.
    const guarded = storage(), session = await acquireSaveSession(guarded, { request: (_n: string, _o: unknown, f: () => Promise<void>) => f() } as never, new AbortController().signal);
    Math.random = lcg(5);
    layout.setSceneHeight(height);
    return new Page(make, session, guarded, mrng, crng);
  };
  const head = { name, seed: n, clock: wire(clock) };
  const drawn = () => [srng.draws(), mrng.draws(), crng.draws()];
  page = await launch(); page.game.fitCanvas(); page.start();

  const sent: { op: unknown; ret: string }[] = [];
  /** Does one thing, and writes it down. */
  const act = async (op: Op): Promise<unknown> => {
    counts[`${op[0]}.${op[1]}`] = (counts[`${op[0]}.${op[1]}`] ?? 0) + 1;
    const said = wire(op), g = page.game;
    let ret: unknown = null;
    if (op[0] === '$G') {
      const f = op[1], a = op.slice(2);
      if (f === 'saveGame') g.saveGame(); else if (f === 'prepareDay') g.prepareDay(); else if (f === 'startDay') g.startDay(); else if (f === 'closeDay') g.closeDay(a[0] as boolean); else if (f === 'speed') page.speeds.get(a[0] as number)!();
      else if (f === 'press') page.buttons[a[0] as number]?.onClick?.(); else if (f === 'changed') page.changed(); else if (f === 'trialAgain') page.trialAgain(); else if (f === 'storyRead') page.storyRead();
      else if (f === 'soldOutResume') page.soldOut!.resume(); else if (f === 'soldOutFinish') page.soldOut!.finish();
      else if (f === 'openMoment') g.openMoment(); else if (f === 'answer') { if (a[0] === null) page.recommend!.dismiss(); else page.recommend!.pick(a[0] as string); }
      else if (f === 'pickUpGift') g.pickUpGift(a[0] as number); else if (f === 'helpBrew') ret = g.helpBrew(); else if (f === 'help') { const list = g.serviceHelpOptions(); ret = [list.map((o) => [o.title, o.detail, o.guest?.id ?? null]), list.length ? list[(a[0] as number) % list.length].perform() : null]; }
      else if (f === 'helpTwice') { const list = g.serviceHelpOptions(); ret = [list.length, list[0]?.perform() ?? null, list[list.length - 1]?.perform() ?? null]; } // The second comes too soon.
      else if (f === 'helpLate') { const list = g.serviceHelpOptions(); page.modal = true; ret = list.map((o) => o.perform()); page.modal = false; }
      else if (f === 'startBranch') g.startBranch(a[0] as string); else if (f === 'resetGame') g.resetGame(); else if (f === 'panelChanged') g.panelChanged(a[0] as string, a[1] as string); else if (f === 'onboarded') { page.onboarding = false; page.onboarded!(structuredClone(a[0]) as Dict); }
      else if (f === 'applyProfile') g.applyProfile(structuredClone(a[0]) as Dict); else if (f === 'greet') g.greetResident(a[0] as string); else if (f === 'locate') g.locateResident(a[0] as string); else throw new Error(f);
    } else if (op[0] === '$UI') {
      const v = op[2];
      if (op[1] === 'modal') page.modal = v as boolean; else if (op[1] === 'drawer') page.drawer = v as boolean; else if (op[1] === 'street') page.street = v as boolean; else if (op[1] === 'mobile') page.mobile = v as boolean;
      else if (op[1] === 'step') page.step = v as string | null; else if (op[1] === 'simplify') page.simplify = v as boolean; else if (['area', 'overview', 'panning'].includes(op[1])) page.scene[op[1]] = v; else g.set(op[1], v);
    } else if (op[0] === '$MOMENT') page.moments.active = structuredClone(op[2]) as MomentDirector['active'];
    else if (op[0] === '$WAIT') clock += op[2] as number;
    else if (op[0] === '$HIDE') page.setHidden(true);
    else if (op[0] === '$SHOW') page.setHidden(false);
    else if (op[0] === '$STORE') { if (op[1] === 'edit') store.items.set(MODS.state.SAVE_KEY as string, op[2] as string); else store[op[1] as 'failReads' | 'failWrites'] = op[2] as boolean; }
    else if (op[0] === '$RESTART') { // `close` saves on the way out; a crash does not.
      if (op[1] === 'close') page.close();
      const before = page.taken(); page = await launch(op[2] as number | undefined); page.log.push(...before); page.game.fitCanvas(); page.start();
      ret = page.session.mode;
    } else try { ret = run(op, g.state, clock, g.sim); } catch { return undefined; }
    sent.push({ op: said, ret: digest(ret) });
    return ret;
  };
  const line = (dt: number, most: number) => {
    let count = 0, asked = page.moments.active;
    while (count < most) {
      clock += dt * 1000; page.game.frame(dt); page.pass(dt); count++;
      if (page.moments.active !== asked && page.moments.active?.kind === 'recommend') break; // Someone asks what to order: the player sees it at once.
      asked = page.moments.active;
    }
    frames += count;
    const log = page.taken(), g = page.game;
    for (const entry of log) if ((entry as unknown[])[0] === 'report' || (entry as string[])[0] === 'toast' && /^manager\.dayDone/.test((entry as string[])[1])) reports++;
    for (const entry of log) { const key = `ui.${(entry as string[])[0]}`; counts[key] = (counts[key] ?? 0) + 1; if ((entry as string[])[0] === 'toast') { const kind = `toast.${(entry as string[])[1].split('{')[0]}`; counts[kind] = (counts[kind] ?? 0) + 1; } }
    if (process.env.LOCKSTEP_DUMP === `${name}:${lines.length + 1}`) writeFileSync(join(process.argv[2], 'dump.json'), JSON.stringify({ i: wire(inside(g.sim)), s: wire(g.state), x: wire(around(page)), log: wire(log), g: wire(g.inside()) }));
    lines.push(JSON.stringify({ ...(sent.length ? { ops: sent.splice(0) } : {}), dt: wire(dt), n: count, log: digest(log), told: log.length, s: digest(g.state), i: digest(inside(g.sim)), x: digest(around(page)),
      g: digest({ ...g.inside(), save: store.items.get(MODS.state.SAVE_KEY as string) ?? null, notice: page.notice, area: page.scene.area, overview: page.scene.overview, active: page.session.active, paused: (g as unknown as { paused(): boolean }).paused() }), d: drawn() }));
  };

  // ---------------------------------------------------------------- the player
  const dismiss = async () => { // Answers whatever dialog is up.
    if (page.onboarding) { await act(['$G', 'onboarded', { profile: { cafeName: `Café ${seed}`, ownerName: seed % 2 ? '店主' : '', look: { skin: seed % 4, hair: seed % 6, hairStyle: seed % 32, shirt: seed % 8, pants: seed % 3 } }, ...(r.chance(0.6) ? { theme: r.pick(IDS.theme) } : {}) }]); await act(['$UI', 'modal', false]); }
    if (!page.modal) return;
    await act(['$UI', 'modal', false]);
    if (page.soldOut) { const choice = r.chance(0.7) ? 'soldOutResume' : 'soldOutFinish'; await act(['$G', choice]); page.soldOut = null; }
    if (page.recommend) { const options = page.moments.active?.options ?? []; await act(['$G', 'answer', options.length && r.chance(0.8) ? r.pick(options) : r.chance(0.5) ? null : r.pick(IDS.menu)]); page.recommend = null; }
  };
  if (strategy.name === 'tour') {
    await tour({ get page() { return page; }, store, act, line, dismiss });
    return { text: `${JSON.stringify(head)}\n${lines.join('\n')}\n`, days, lines: lines.length, frames, counts };
  }
  await dismiss();
  const rest = () => r.pick([5_000, 60_000, 400_000, 3_600_000, 9_000_000, 43_200_000, 180_000_000]);
  let stuck = 0, prepared = -1, shownDay = 0;
  while (reports < days && lines.length < days * 900) {
    const g = page.game, s = g.state;
    if (!page.session.active || page.notice && r.chance(0.3)) { await act(['$STORE', 'failWrites', false]); await act(['$STORE', 'failReads', false]); await act(['$RESTART', 'crash']); await dismiss(); line(0.1, 1); continue; }
    if (page.modal || page.onboarding) { line(r.pick([0.05, 0.1]), 1 + r.int(4)); await dismiss(); }
    if (s.phase === 'prep') {
      if (prepared !== reports) { // The morning: plan, spend, perhaps leave for a while.
        prepared = reports; stuck = 0;
        if (strategy.money && r.chance(0.5)) await act(['economy', 'earn', '$S', strategy.money * r.next()]);
        for (const op of strategy.prepare(s, r, reports)) {
          await act(op);
          if (r.chance(0.15)) await act(['$G', 'panelChanged', r.pick(['item', 'upgrade', 'goal', 'milestone', 'decor']), op[1] === 'buyUpgrade' ? String(op[3]) : r.pick(['tables', '120', '35.5', 'x'])]);
        }
        if (strategy.name !== 'careful' && r.chance(0.5) && call('chain', 'canOpenBranch', [g.state])) { await act(['$G', 'startBranch', r.pick(IDS.location)]); continue; }
        if (strategy.name === 'everything' && r.chance(0.02)) { await act(['$G', 'resetGame']); await dismiss(); continue; }
      }
      const runs = call('manager', 'managerRunsDays', [s]) as boolean;
      if (runs && r.chance(0.03)) { // The manager finds nothing to sell and nothing to buy it with.
        await act(['$STATE', 'coins', 0]);
        for (const part of ['pantry', 'shelf'] as const) await act(['$STATE', part, Object.fromEntries(Object.keys(s[part]).map((id) => [id, 0]))]);
        for (const flag of ['arrange', 'mobile', 'drawer', 'street']) await act(['$UI', flag, false]);
        await act(['$UI', 'panelCollapsed', true]); await act(['$UI', 'step', null]);
        line(0.25, 20); continue;
      }
      if (!runs || stuck > 6) {
        if (!(call('economy', 'menuItems', [s]) as unknown[]).length) { await act(['economy', 'setOnMenu', '$S', 'espresso', true]); await act(['$STATE', 'coins', Math.max(s.coins, 60)]); }
        if (!(call('economy', 'hasServiceSupply', [s]) as boolean)) { await act(['$STATE', 'coins', Math.max(s.coins, 60)]); await act(['economy', 'restock', '$S']); }
        await act(['$G', 'prepareDay']); line(0.1, 1); await act(['$UI', 'modal', false]); await act(['$G', 'startDay']);
        if (page.game.state.phase === 'prep') await act(['economy', 'buyIngredient', '$S', r.pick(IDS.ingredient), 20]);
        stuck = 0;
      } else stuck++;
      if (r.chance(0.2)) await act(['$UI', r.pick(['panelCollapsed', 'arrange', 'mobile', 'drawer', 'street']), r.chance(0.5)]);
      else for (const flag of ['arrange', 'mobile', 'drawer', 'street']) if (r.chance(0.6)) await act(['$UI', flag, false]);
      if (r.chance(0.7)) await act(['$UI', 'panelCollapsed', true]);
      if (r.chance(0.02)) await act(['$UI', 'step', r.pick(['stock', 'menu', null, null])]);
    } else {
      if (shownDay !== s.day && r.chance(0.8)) { shownDay = s.day; await act(['$G', 'speed', strategy.speed(r)]); }
      for (const op of strategy.serve(s, g.sim, r)) await act(op);
      if (page.moments.active && r.chance(page.moments.active.kind === 'recommend' ? 0.8 : strategy.social)) await act(['$G', 'openMoment']);
      if (r.chance(strategy.social * 0.3)) await act(r.pick<() => Op>([() => ['$G', 'help', r.int(6)], () => ['$G', 'help', r.int(6)], () => ['$G', 'helpBrew'], () => ['$G', 'greet', r.pick(IDS.cat)], () => ['$G', 'locate', r.pick(IDS.cat)]])());
      if (s.catGifts.waiting.length && r.chance(0.3)) await act(['$G', 'pickUpGift', r.chance(0.9) ? r.pick(s.catGifts.waiting).id : 99]);
      if (s.phase === 'open' && r.chance(0.006)) { await act(['$G', 'closeDay', r.chance(0.5)]); if (page.modal) { line(0.05, 1); await act(['$UI', 'modal', false]); if (r.chance(0.5)) await act(['$G', 'press', 1]); } }
      if (s.phase === 'closing' && r.chance(0.05)) { await act(['$G', 'closeDay', false]); line(0.1, 2); await act(['$UI', 'modal', false]); if (r.chance(0.6)) await act(['$G', 'press', 1]); }
      if (r.chance(0.01)) await act(['$UI', 'simplify', r.chance(0.5)]);
      if (r.chance(0.01)) await act(['$UI', r.pick(['drawer', 'street', 'arrange', 'mobile']), r.chance(0.5)]);
      else if (r.chance(0.3)) for (const flag of ['drawer', 'street', 'arrange']) await act(['$UI', flag, false]);
    }
    if (r.chance(0.004)) { // Supplies run out, sometimes with nothing to buy more.
      await act(['$STATE', 'pantry', Object.fromEntries(Object.keys(page.game.state.pantry).map((id) => [id, r.int(3)]))]);
      if (r.chance(0.4)) await act(['$STATE', 'coins', r.pick([0, 3, 40])]);
    }
    if (r.chance(strategy.away * 0.06)) { // Leaves, and comes back, or is closed by the phone meanwhile.
      await act(['$HIDE']); if (r.chance(0.3)) line(0.1, 1);
      await act(['$WAIT', 'ms', rest()]);
      if (r.chance(0.25)) { await act(['$RESTART', r.pick(['close', 'crash'])]); } else await act(['$SHOW']);
      await dismiss();
    }
    if (r.chance(strategy.away * 0.02)) { await act(['$RESTART', r.pick(['close', 'crash', 'close'])]); if (r.chance(0.3)) { await act(['$WAIT', 'ms', rest()]); } await dismiss(); }
    if (r.chance(strategy.trouble * 0.02)) await act(['$STORE', r.pick(['failWrites', 'failReads']), true]);
    else if (r.chance(0.4)) { if (store.failWrites) await act(['$STORE', 'failWrites', false]); if (store.failReads) await act(['$STORE', 'failReads', false]); }
    if (r.chance(strategy.trouble * 0.006) && store.items.size) await act(['$STORE', 'edit', r.pick([store.items.get(MODS.state.SAVE_KEY as string) ?? '', '{"version":27', JSON.stringify({ ...page.game.state, coins: 777 })])]);
    line(strategy.name === 'careful' ? r.pick([0.1, 0.25]) : r.pick([1 / 60, 0.05, 0.1, 0.1, 0.25, 0.25]), page.game.state.phase === 'prep' ? 1 + r.int(16) : 20 + r.int(40));
  }
  return { text: `${JSON.stringify(head)}\n${lines.join('\n')}\n`, days: reports, lines: lines.length, frames, counts };
}

interface Kit { readonly page: Page; store: MemoryStore; act(op: Op): Promise<unknown>; line(dt: number, most: number): void; dismiss(): Promise<void> }
/** One café led through everything main.ts decides that the careers above come across rarely or never. */
async function tour(k: Kit): Promise<void> {
  const { act, line, dismiss, store } = k, KEY = MODS.state.SAVE_KEY as string, s = () => k.page.game.state;
  const ui = (what: string, v: unknown) => act(['$UI', what, v]), set = (key: string, v: unknown) => act(['$STATE', key, v]), wait = (ms: number) => act(['$WAIT', 'ms', ms]);
  const HOUR = 3_600_000, closeDialog = () => ui('modal', false);
  const stock = async () => { if (s().coins < 1e6) await act(['economy', 'earn', '$S', 1e6]); for (const id of IDS.ingredient) await act(['economy', 'buyIngredient', '$S', id, 120]); };
  const prepared = async () => { await act(['$G', 'prepareDay']); line(0.1, 1); await act(['$G', 'changed']); await closeDialog(); };
  const openDay = async () => { await stock(); await prepared(); await act(['$G', 'startDay']); line(0.1, 2); };
  const finish = async () => { // Ends the day by hand: asks, shuts, asks again, sends everyone home.
    if (s().phase === 'open') { await act(['$G', 'closeDay', false]); await closeDialog(); await act(['$G', 'press', 1]); line(0.1, 2); }
    if (s().phase === 'closing') { await act(['$G', 'closeDay', false]); await closeDialog(); await act(['$G', 'press', 1]); line(0.1, 1); }
    await act(['$G', 'trialAgain']); await act(['$G', 'storyRead']); await act(['$G', 'help', 0]); await closeDialog(); await act(['$G', 'press', 0]); line(0.1, 1); await closeDialog();
  };
  /** A launch from a save changed by hand. */
  const from = async (change: (save: Dict) => void, restart: Op = ['$RESTART', 'crash']) => {
    await act(['$G', 'saveGame']); const save = JSON.parse(store.items.get(KEY)!) as Dict; change(save);
    await act(['$STORE', 'edit', JSON.stringify(save)]); await act(restart); line(0.1, 2); await dismiss(); await closeDialog();
  };
  const queueUp = async (least: number) => { for (let n = 0; n < 200 && s().phase === 'open' && k.page.game.sim.queueChoices().length < least; n++) line(0.1, 5); };

  // ---- The first morning.
  line(0.1, 2); await act(['$HIDE']); await wait(2 * HOUR); await act(['$SHOW']); line(0.1, 1);
  await ui('step', 'stock'); await dismiss(); await ui('step', 'stock'); await act(['$G', 'prepareDay']); await act(['$G', 'changed']); await closeDialog(); await ui('step', 'menu'); line(0.1, 3); await ui('step', null);
  await set('pantry', Object.fromEntries(Object.keys(s().pantry).map((id) => [id, 0]))); await set('onMenu', []); await act(['$G', 'startDay']); await set('onMenu', ['espresso']);
  await ui('simplify', true); await openDay(); await act(['$G', 'prepareDay']); await act(['$G', 'startDay']); line(0.1, 30); await ui('simplify', false); line(0.1, 30);
  await act(['$G', 'speed', 4]); await act(['$G', 'helpBrew']); line(0.1, 20); await act(['$G', 'helpBrew']); await finish();

  // ---- Storage that fails.
  await act(['$STORE', 'failWrites', true]); await act(['$G', 'saveGame']); line(0.1, 3); await act(['$HIDE']); line(0.1, 1); await act(['$SHOW']); await act(['$STORE', 'failWrites', false]); await act(['$G', 'saveGame']); line(0.1, 3);
  await act(['$STORE', 'failReads', true]); await act(['$G', 'saveGame']); line(0.1, 3); await act(['$STORE', 'failReads', false]); line(0.1, 60);
  await act(['$STORE', 'failReads', true]); await act(['$STORE', 'failWrites', true]); await act(['$RESTART', 'close']); await dismiss(); await act(['$G', 'saveGame']); await openDay(); line(0.1, 60); await act(['$G', 'helpBrew']); // Another café, kept nowhere.
  await act(['$STORE', 'failReads', false]); line(0.1, 60); await act(['$STORE', 'failWrites', false]); line(0.1, 60); await act(['$RESTART', 'close']); line(0.1, 2); await dismiss();
  await act(['$STORE', 'edit', JSON.stringify({ ...s(), coins: 776 })]); await act(['$HIDE']); await act(['$SHOW']); line(0.1, 2); await act(['$RESTART', 'close']); await dismiss();
  await act(['$STORE', 'edit', JSON.stringify({ ...s(), coins: 777 })]); await act(['$G', 'saveGame']); line(0.1, 3); await act(['$G', 'saveGame']); await act(['$HIDE']); await act(['$SHOW']); await act(['$G', 'openMoment']); await act(['$RESTART', 'close', 300]); line(0.1, 3); await dismiss();
  const kept = store.items.get(KEY)!;
  for (const text of ['{"version":27', '"text"', 'null', '7', '']) { await act(['$STORE', 'edit', text]); await act(['$RESTART', 'crash']); await dismiss(); line(0.1, 2); await closeDialog(); }
  await act(['$STORE', 'edit', kept]); await act(['$RESTART', 'crash']); await dismiss(); await closeDialog(); line(0.1, 2);

  // ---- Buying and arranging.
  await act(['economy', 'earn', '$S', 5e7]);
  await act(['kitchen', 'unlockKitchen', '$S']);
  for (const id of IDS.menu.slice(0, 14)) { await act(['economy', 'buyItem', '$S', id, 1]); await act(['economy', 'setOnMenu', '$S', id, true]); }
  for (const id of ['tables', 'marketing', 'marketing', 'server']) await act(['economy', 'buyUpgrade', '$S', id, 1]);
  await act(['pets', 'adoptCat', '$S', IDS.cat[0]]); await act(['pets', 'adoptCat', '$S', IDS.cat[1]]); await act(['partners', 'recruitPartner', '$S', IDS.partner[0]]);
  for (const [kind, id] of [['item', 'latte'], ['goal', '120'], ['goal', '35.5'], ['milestone', 'x'], ['upgrade', 'machine'], ['upgrade', 'tables']]) await act(['$G', 'panelChanged', kind, id]);
  await set('decor', { ...structuredClone(s().decor), placed: [...structuredClone(s().decor.placed), structuredClone(s().decor.placed[0])] });
  await ui('arrange', true); await act(['$G', 'panelChanged', 'upgrade', 'tables']); line(0.1, 2); await ui('arrange', false);
  line(0.1, 4); for (const id of IDS.cat.slice(0, 3)) { await act(['$G', 'locate', id]); await ui('panelCollapsed', false); await act(['$G', 'locate', id]); line(0.1, 1); await ui('panelCollapsed', true); await act(['$G', 'greet', id]); line(0.1, 3); }
  await set('goal', (MODS.goals.GOALS as unknown[]).length); line(0.1, 6); // Milestones reached by buying.
  const profile = structuredClone(s().profile); await set('profile', null); await act(['$HIDE']); await wait(3 * HOUR); await act(['$SHOW']); line(0.1, 3); await set('profile', profile);

  // ---- Old saves: furniture on the old room's grid, rooms that became shops on the street, a broken running day.
  await from((save) => { const placed = IDS.furniture.flatMap((id, n) => [0, 1, 2].map((i) => ({ id, col: (n * 5 + i * 13) % 38, row: (n * 3 + i * 5) % 16 }))); save.decor = { ...(save.decor as Dict), building: false, placed }; });
  await from((save) => { // A full wall: more pieces than the building has spots.
    const full = structuredClone(s()), placed: Dict[] = []; full.decor.placed = placed as never;
    for (const id of IDS.furniture.filter((x) => call('furniture', 'furnitureDef', [x]) !== undefined)) for (let row = 0; row < 16; row += 1) for (let col = 0; col < 40; col++) if (call('furniture', 'canPlace', [full, id, col, row, call('regions', 'mainTableCount', [full])])) placed.push({ id, col, row });
    save.decor = { ...(save.decor as Dict), building: false, placed };
  });
  await from((save) => { save.regions = ['reading']; });
  await set('regions', ['greenhouse']); line(0.1, 2);
  await set('streets', { ...structuredClone(s().streets), lots: {} }); await set('items', { ...s().items, croissant: 1 }); await act(['economy', 'setOnMenu', '$S', 'croissant', true]); await stock(); await act(['economy', 'bakeForForecast', '$S']); await openDay(); line(0.1, 20); await from((save) => { save.regions = ['reading', 'terrace']; }); line(0.1, 5);
  await set('pantry', { ...s().pantry, milk: 0 }); line(0.1, 60); await finish();

  // ---- A trial drink, guests to help, every kind of moment.
  const drink = IDS.menu.find((id) => call('trial-sales', 'canTrialDrink', [s(), id])) ?? (await act(['economy', 'setOnMenu', '$S', 'latte', false]), 'latte');
  const serving = async () => { if (s().phase === 'open' && s().dayTime < 120) return; await finish(); await act(['trial-sales', 'selectTrialSale', '$S', drink]); await openDay(); await act(['$G', 'speed', 1]); };
  for (let round = 0; round < 8; round++) {
    await serving(); await queueUp(2); const guests = k.page.game.sim.queueChoices(); if (guests.length) await act(['$GUEST', 'mark', guests[guests.length - 1].id, 'cookie']);
    const trialIdx = k.page.game.serviceHelpOptions().findIndex((o) => o.title.startsWith('flow.helpTrial'));
    if (trialIdx >= 0) { await act(['$G', round % 2 === 0 ? 'helpTwice' : 'help', trialIdx]); line(0.1, 90); }
    await queueUp(2);
    const queueIdx = k.page.game.serviceHelpOptions().findIndex((o) => o.title.startsWith('flow.helpQueue'));
    if (queueIdx >= 0) { await act(['$G', 'help', queueIdx]); line(0.1, 90); }
    for (let n = 0; n < 5; n++) { await act(['$G', n === 0 ? 'helpLate' : n === 1 ? 'helpTwice' : 'help', n + round]); await act(['$G', 'help', 0]); line(0.1, 14); }
    for (const flag of ['arrange', 'panning', 'overview', 'drawer']) { await ui(flag, true); line(0.1, 2); await act(['$G', 'help', round]); await act(['$G', 'helpBrew']); await act(['$G', 'openMoment']); await ui(flag, false); }
  }
  const reserved = async () => { await finish(); await serving(); for (let n = 0; n < 120 && !s().trialSales.active?.reserved; n++) { await queueUp(1); for (const guest of k.page.game.sim.queueChoices()) await act(['$SIM', 'offerTrialTo', '$S', guest.id]); line(0.1, 2); } };
  await reserved(); line(0.1, 40); await act(['$RESTART', 'close', 300]); line(0.1, 20); await from(() => {}); // Goes on with the trial, also from a screen of another height.
  await reserved(); await from((save) => { (save.runtime as Dict).customers = 'broken'; }); line(0.1, 10); // Its places are free again.
  const strangers = [{ kind: 'greet', customerId: 99999, options: [], age: 0 }, { kind: 'photo', customerId: 99999, options: [], age: 0 }, { kind: 'delivery', options: [], age: 0 }, { kind: 'recommend', customerId: 99999, options: ['espresso', 'latte'], age: 0 }];
  await serving();
  for (const moment of strangers) { await act(['$MOMENT', 'force', moment]); await act(['$G', 'openMoment']); line(0.1, 1); await dismiss(); }
  for (const answer of ['latte', null, 'not-offered']) for (let n = 0; n < 12; n++) { // Someone in the queue asks what to order.
    await serving(); await queueUp(2); const guest = k.page.game.sim.queueChoices().find((c) => !c.trialSale && !c.regularGuestId);
    if (guest) { await act(['$MOMENT', 'force', { kind: 'recommend', customerId: guest.id, options: ['espresso', 'latte'], age: 0 }]); await act(['$G', 'openMoment']); await closeDialog(); }
    const asked = k.page.recommend; if (asked) { await act(['$G', 'answer', answer]); k.page.recommend = null; } line(0.1, 4);
    if (asked) break;
  }
  await serving(); await act(['$MOMENT', 'force', { kind: 'delivery', options: [], spot: { x: 20, y: 60, area: 'main' }, gift: { item: 'espresso', servings: 2, ingredients: { beans: 4 } }, age: 0 }]); await act(['$G', 'openMoment']); line(0.1, 2);
  await act(['$MOMENT', 'force', { kind: 'cat', options: [], spot: { x: 20, y: 60, area: 'main', catId: 'window', sill: true }, age: 0 }]); await act(['$G', 'openMoment']); line(0.1, 1);
  for (const cat of IDS.cat.slice(0, 2)) { await act(['$MOMENT', 'force', { kind: 'cat', options: [], spot: { x: 20, y: 60, area: 'main', catId: cat, sill: false }, age: 0 }]); await act(['$G', 'openMoment']); line(0.1, 30); }
  for (let round = 0, done = 0; round < 60 && done < 9; round++) {
    await serving();
    await ui('area', round % 4 === 3 ? 'reading' : 'main');
    for (let n = 0; n < 40 && !k.page.moments.active && s().phase === 'open'; n++) { if (k.page.game.state.coins < 1000) await stock(); line(0.1, 20); }
    const moment = k.page.moments.active; if (!moment) continue;
    done++;
    if (moment.customerId !== undefined && moment.kind === 'recommend') {
      await act(['$G', 'openMoment']); await closeDialog();
      if (k.page.recommend) { await act(['$G', 'answer', done % 3 === 0 ? null : done % 3 === 1 ? moment.options[0] : 'not-offered']); k.page.recommend = null; }
    } else await act(['$G', 'openMoment']);
    line(0.1, 4);
  }
  await serving(); await set('pets', []); await ui('area', 'reading'); line(0.1, 3); await ui('area', 'main'); for (let n = 0; n < 10; n++) line(0.1, 40); await finish(); // The visiting cat on the windowsill.

  // ---- The manager runs the café.
  await act(['economy', 'earn', '$S', 5e7]); await act(['manager', 'hireManager', '$S']); await stock(); await act(['pets', 'adoptCat', '$S', IDS.cat[0]]);
  await act(['trial-sales', 'selectTrialSale', '$S', drink]); await set('manager', { ...structuredClone(s().manager), hired: true, auto: true });
  for (const [flag, value] of [['panelCollapsed', false], ['arrange', true], ['step', 'stock'], ['mobile', true], ['drawer', true], ['modal', true], ['street', true]] as const) { line(0.25, 3); await ui(flag, value); line(0.25, 3); await ui(flag, flag === 'panelCollapsed' ? true : flag === 'step' ? null : false); }
  const closed = async () => { const day = s().day; for (let n = 0; n < 60 && s().day === day; n++) { line(0.25, 20); await closeDialog(); } };
  line(0.25, 20); await act(['$G', 'speed', 4]); await act(['$G', 'press', 0]); line(0.25, 30);
  await set('pantry', Object.fromEntries(Object.keys(s().pantry).map((id) => [id, 0]))); await set('shelf', {}); for (let n = 0; n < 40 && s().phase === 'open'; n++) line(0.25, 10); // Sold out: restocks and goes on.
  line(0.25, 20); await act(['$SIM', 'beginClosing', '$S']); await closed(); line(0.25, 30); await closed();
  await act(['$G', 'speed', 4]); await closed(); line(0.1, 1); await act(['$G', 'press', 0]); await closeDialog();
  await set('coins', 0); await set('pantry', Object.fromEntries(Object.keys(s().pantry).map((id) => [id, 0]))); await set('shelf', {}); line(0.25, 30); // Nothing to sell: gives up.
  await set('manager', { ...structuredClone(s().manager), auto: false });

  // ---- Sold out without a manager: restock, or leave it.
  await finish();
  await act(['$G', 'speed', 1]);
  for (const choice of ['soldOutResume', 'soldOutFinish']) {
    await openDay(); line(0.1, 30); await set('pantry', Object.fromEntries(Object.keys(s().pantry).map((id) => [id, 0]))); await set('shelf', {}); await set('inProduction', {});
    for (let n = 0; n < 60 && !k.page.soldOut && s().phase === 'open'; n++) line(0.25, 10);
    await closeDialog(); if (k.page.soldOut) { await act(['economy', 'earn', '$S', 1e5]); await act(['$G', choice]); k.page.soldOut = null; }
    if (choice === 'soldOutFinish') { for (let n = 0; n < 40 && s().phase === 'closing'; n++) line(0.25, 10); await closeDialog(); }
    line(0.1, 10); await finish();
  }

  // ---- Away: the till, franchises, an order, a street shop and gifts, on their own, together, and behind a dialog.
  await act(['economy', 'earn', '$S', 5e7]); await act(['manager', 'hireManager', '$S']); await set('manager', { ...structuredClone(s().manager), hired: true, auto: false, welcomed: false });
  const away = async (ms: number, modal = false) => { await act(['$HIDE']); line(0.1, 1); await wait(ms); if (modal) await ui('modal', true); await act(['$SHOW']); line(0.1, 1); await closeDialog(); };
  await away(3_000); await away(20 * 60_000); await act(['orders', 'startOrder', '$S', 'office', '$N']); line(0.1, 2); await wait(HOUR); line(0.1, 2); line(0.1, 2); await away(90_000);
  await act(['orders', 'startOrder', '$S', 'office', '$N']); await set('catGifts', { ...structuredClone(s().catGifts), next: 0 }); await away(5 * HOUR);
  await set('chain', { ...structuredClone(s().chain), franchises: [{ location: 'harbor', hourly: 900 }] });
  await set('streets', { ...structuredClone(s().streets), lots: { [`${s().chain.location}:${IDS.plot[0]}`]: { business: 'reading', level: 1, mode: 'short', readyAt: 0, since: 0 } } });
  await away(30 * HOUR); await set('pets', []); await away(40 * HOUR, true); await act(['pets', 'adoptCat', '$S', IDS.cat[0]]); await set('catGifts', { ...structuredClone(s().catGifts), next: 0, waiting: [] }); line(0.1, 4);
  if (s().catGifts.waiting.length) await act(['$G', 'pickUpGift', s().catGifts.waiting[0].id]); await act(['$G', 'pickUpGift', 99]);
  await set('catGifts', { ...structuredClone(s().catGifts), waiting: [0, 1].map((spot) => ({ id: 900 + spot, cat: IDS.cat[0], kind: IDS.gift[0], spot })) }); await act(['$G', 'pickUpGift', 900]); await act(['$G', 'pickUpGift', 901]);
  await set('manager', { ...structuredClone(s().manager), hired: false }); await away(2 * HOUR); await set('chain', { ...structuredClone(s().chain), franchises: [] }); await set('streets', { ...structuredClone(s().streets), lots: {} }); await away(2 * HOUR); await set('pets', []); await away(2 * HOUR);

  // ---- Another branch, opened while arranging another room; then all over again.
  for (const arranging of [true, false]) {
    await act(['economy', 'earn', '$S', 5e8]); await set('regions', ['terrace']); await ui('area', 'kitchen'); await ui('overview', true); await ui('arrange', arranging);
    await act(['$G', 'startBranch', arranging ? 'nowhere' : IDS.location[0]]); await act(['$G', 'startBranch', IDS.location[arranging ? 1 : 2]]); line(0.1, 3); await set('manager', { ...structuredClone(s().manager), hired: true, auto: true }); await ui('panelCollapsed', true); line(0.25, 30);
    await set('manager', { ...structuredClone(s().manager), auto: false }); await finish();
  }
  await ui('arrange', true); await ui('area', 'kitchen'); await act(['$G', 'resetGame']); line(0.1, 2); await dismiss(); await closeDialog(); line(0.1, 3); await ui('arrange', false); await openDay(); for (let n = 0; n < 30; n++) line(0.1, 40); await act(['$RESTART', 'close']); line(0.1, 5); await finish();
  await set('manager', { ...structuredClone(s().manager), hired: true, auto: false, welcomed: false }); await act(['$HIDE']); await wait(HOUR); await act(['$SHOW']); line(0.1, 2); await closeDialog(); // The first time away: welcome back.
}

/** Arguments: where to write, which part of how many, seeds, days, and the start of the runs' names. */
export async function main(make: MakeGame): Promise<void> {
  const [, , out, part, parts, seeds, days, only] = process.argv;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const guide: Strategy = { name: 'tour', money: 0, social: 0, away: 0, trouble: 0, speed: () => 1, prepare: () => [], serve: () => [] };
  const list = [[guide, 1] as const, ...STRATEGIES.flatMap((s) => Array.from({ length: Number(seeds) }, (_, i) => [s, i + 1] as const))].filter(([s, seed], i) => i % Number(parts) === Number(part) && (!only || `${s.name}-${seed}`.startsWith(only)));
  const total = { runs: 0, days: 0, lines: 0, frames: 0, fewest: Infinity, counts: {} as Record<string, number> };
  // The guided career alone must reach every branch.
  let found: ReturnType<typeof stretches> | null = null;
  for (const [strategy, seed] of list) {
    if (strategy === guide) startCoverage();
    const made = await career(make, strategy, seed, Number(days));
    if (strategy === guide) { found = stretches(/(?:^|\/)(main-session|save-session|storage)\.ts/, true); stopCoverage(); }
    writeFileSync(join(out, `${strategy.name}-${seed}.jsonl`), made.text);
    total.runs++; total.days += made.days; total.lines += made.lines; total.frames += made.frames; total.fewest = Math.min(total.fewest, made.days);
    for (const [k, v] of Object.entries(made.counts)) total.counts[k] = (total.counts[k] ?? 0) + v;
  }
  writeFileSync(join(out, 'reached.bin'), found?.map ?? new Uint8Array());
  writeFileSync(join(out, 'gate.json'), JSON.stringify({ ...total, branches: found?.branches ?? [] }));
}
