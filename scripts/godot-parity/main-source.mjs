// Takes the rules out of src/main.ts for Node: its own functions, word for word, around a page that only writes down
// what it is told. When main.ts changes, so does what Godot is compared with.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSync } from 'vite';
import { PARITY_DIR, ROOT } from './bundle.mjs';

/** What `godot/core/game_session.gd` ports: functions of `startGame`, then its variables, then its statements. */
const FUNCTIONS = ['saveGame', 'fitCanvas', 'tickCatGifts', 'pickUpGift', 'announceReadyOrder', 'settleLegacyInterior', 'updateDayHud', 'startDay', 'managerStartDay', 'managerTick', 'managerReport',
  'leaveCafe', 'settleAway', 'prepareDay', 'closeDay', 'showReport', 'onPanelChange', 'applyProfile', 'startOnboarding', 'startBranch', 'resetGame', 'locateResident', 'greetResident', 'openMoment', 'momentStage',
  'serviceHelpAllowed', 'serviceHelpOptions', 'helpBrew', 'frame', 'setPanelCollapsed'];
const VARIABLES = ['startupComplete', 'managerWait', 'managerCounting', 'state', 'sim', 'cuedMoment', 'awaySettled', 'settleFurniture', 'unsettledFurniture', 'announcedOrder', 'menuEmpty', 'uiTimer', 'shownCoins', 'shownRate', 'autosaveTimer'];
const TOP = ['HINT_KEY', 'MOMENT_HINT_KEY', 'AUTOSAVE_MS', 'MANAGER_DELAY', 'SIM_STEP'];
/** Statements that hang rules on the page's events, by the start of their text. */
const STATEMENTS = ['for (const b of speedBtns)', "document.addEventListener('visibilitychange'", 'savePage.onClose(', 'waitForStartupReady('];

/** What the functions find on the page; `scripts/godot-parity/session.ts` provides it. */
const PAGE = ['session', 'storage', 'moments', 'scene', 'panel', 'drawer', 'toast', 't', 'showModal', 'isModalOpen', 'document', '$', 'sessionNotice', 'chinese', 'stage', 'sign', 'stats', 'cafe',
  'fitFullscreenRoom', 'window', 'roomViewport', 'guide', 'regionsUI', 'playFlow', 'operationMonitor', 'operationBtn', 'openBtn', 'closeBtn', 'speedBtns', 'hint', 'dayClockBase', 'dayClockTraffic',
  'trafficSummary', 'dayClock', 'trafficHud', 'conditionHud', 'updateLedgerTheme', 'updateReputationButton', 'updateRegularGuestsButton', 'updatePartnersButton', 'updateCafeStyleButton', 'updateGuide',
  'showPrepare', 'showFirstOpening', 'showSettlement', 'ownerIcon', 'showPanelTab', 'showOnboarding', 'rememberLocale', 'updateBrand',
  'itemName', 'displayItemName', 'milestoneName', 'showRecommendation', 'locateCat', 'reducedMotion', 'catLocateExit', 'updateRoomProjectsBook', 'updateStreetMap', 'updateStats', 'cafeLife', 'coinsEl',
  'drawerBalance', 'rateEl', 'showSoldOut', 'panelRoot', 'previewExit', 'sceneWrap', 'arrangeFocus', 'restoreTitle', 'updateAwayTitle', 'setInterval', 'waitForStartupReady', 'loading',
  'requestAnimationFrame', 'setTimeout', 'savePage', 'formatDuration', 'updatePanelVisibility', 'showArrange', 'startArrange', 'clearInterval', 'floorsView', 'cafeInteractionEnabled', 'canvas', 'areaName', 'holdPiece'];

/** Writes `godot/.parity/main-session.ts`: `makeGame(page)` with everything above inside. */
export async function writeMainSession() {
  const src = readFileSync(join(ROOT, 'src/main.ts'), 'utf8');
  const { program } = await parseSync('main.ts', src, { lang: 'ts' });
  const text = (node) => src.slice(node.start, node.end);
  const missing = [], game = program.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'startGame').body.body;
  const declared = (body, name) => body.find((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id.name === name));
  const find = (what, node) => { if (!node) missing.push(what); return node; };
  const parts = [];
  const at = (node) => parts.push({ start: node.start, text: text(node) });
  for (const name of TOP) { const node = find(name, declared(program.body, name)); if (node) parts.push({ start: 0, text: text(node) }); }
  for (const name of VARIABLES) { const node = find(name, declared(game, name)); if (node) at(node); }
  for (const name of FUNCTIONS) { const node = find(name, game.find((n) => n.type === 'FunctionDeclaration' && n.id.name === name)); if (node) at(node); }
  for (const start of STATEMENTS) { const node = find(start, game.find((n) => text(n).startsWith(start))); if (node) at(node); }
  const panel = find('new Panel', declared(game, 'panel'))?.declarations[0].init;
  if (panel) parts.push({ start: panel.start, text: `const panelChanged = ${text(panel.arguments[4])};` });
  const regions = find('new RegionsUI', declared(game, 'regionsUI'))?.declarations[0].init;
  if (regions) parts.push({ start: regions.start, text: `const areaSelected = ${text(regions.arguments[3])};` });
  if (missing.length) throw new Error(`src/main.ts no longer has: ${missing.join(', ')}`);
  parts.sort((a, b) => a.start - b.start);
  const imports = program.body.filter((n) => n.type === 'ImportDeclaration' && n.source.value.startsWith('./game/')).map((n) => text(n).replace(/'\.\/game\//, "'../../src/game/"));
  const out = `// Generated from src/main.ts by scripts/godot-parity/main-source.mjs.\n${imports.join('\n')}
export function makeGame(page: any): any {
  // Functions use the page's names; what may change while playing is read through \`page\`.
  const { ${PAGE.join(', ')} } = page;
  let arrange: any = null, panelCollapsed = true, detachedTablePreview = false, catLocateContext: any = null, awayTitleTimer: any, mobileHud: any = page.mobileHud;
${parts.map((p) => p.text).join('\n')}
  return {
    frame, saveGame, startDay, closeDay, prepareDay, startBranch, resetGame, pickUpGift, openMoment, helpBrew, serviceHelpOptions, panelChanged, areaSelected, applyProfile, greetResident, locateResident, fitCanvas, showReport, paused: () => scene.paused,
    get state() { return state; }, get sim() { return sim; },
    set(name: string, value: any) { if (name === 'arrange') arrange = value ? { mode: 'browse' } : null; else if (name === 'panelCollapsed') panelCollapsed = value; },
    inside: () => ({ startupComplete, managerWait, managerCounting, awaySettled, announcedOrder, uiTimer, hint: !hint.hidden, panelCollapsed, arranging: !!arrange }),
  };
}
`;
  mkdirSync(PARITY_DIR, { recursive: true });
  writeFileSync(join(PARITY_DIR, 'main-session.ts'), out);
  writeFileSync(join(PARITY_DIR, 'session-entry.ts'), "import { makeGame } from './main-session';\nimport { main } from '../../scripts/godot-parity/session';\nvoid main(makeGame);\n");
}
