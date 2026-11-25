// Pure builders and helpers shared between `scripts/godot-sync.mjs` and `scripts/godot-data.test.ts`.
// Every numeric constant, coordinate, layer order, and translation string is imported from,
// evaluated via, or strictly extracted from TS source modules — zero hand-copied constants.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const I18N_SOURCE_KEYS = [
  'app.title',
  'tab.menu',
  'panel.collapse',
  'settings.language',
  'btn.unlock',
  'btn.levelUp',
  'btn.buy',
  'btn.maxed',
  'row.teaser',
  'row.each',
  'row.sellsFor',
  'row.milestone',
  'row.milestonesDone',
  'row.after',
  'menu.on',
  'menu.off',
  'menu.left',
  'menu.lockedOpen',
  'day.label',
  'day.closed',
  'day.open',
  'day.close',
  'day.closing',
  'day.speed',
  'day.finishNow',
  'hud.today',
  'hud.closed',
  'floors.sign.open',
  'floors.sign.closed',
  'report.title',
  'report.served',
  'report.missed',
  'report.missedValue',
  'report.revenue',
  'report.ingredients',
  'report.profit',
  'report.best',
  'report.outOfStock',
  'report.none',
  'report.next',
  'report.queueLost',
  'report.tableLost',
  'cat.all',
  'cat.coffee',
  'cat.tea',
  'cat.bread',
  'cat.pastry',
  'list.sep',
  'pantry.restock',
  'pantry.budgetRestock',
  'pantry.full',
  'prep.restockAction',
  'prep.budgetAction',
];

export const B0_COPY = {
  zh: {
    'b0.openShop': '开店营业',
    'b0.closeShop': '打烊结算',
    'b0.langToggle': 'EN',
    'b0.benchBtn': '性能测试',
    'b0.benchTitle': '性能测试（30秒）',
    'b0.benchWarmup': '热身中… 剩余 {sec} 秒（加载 {load} ms）',
    'b0.benchRunning': '测试运行中… 剩余 {sec} 秒',
    'b0.benchDone': '测试完成 · 已写入 user://bench.json',
    'b0.benchStartFull': '全尺寸测试 (full)',
    'b0.benchStartHalf': '半尺寸测试 (half)',
    'b0.benchStop': '返回咖啡馆',
    'b0.benchDesc': '固定种子与镜头，30位动画人物 + 整栋楼静态层，2秒热身后采样30秒。',
    'b0.presetFull': '全尺寸',
    'b0.presetHalf': '半尺寸',
    'b0.stockOk': '可做 {n} 份',
    'b0.stockOut': '已售罄',
    'b0.locked': '未解锁',
    'b0.level': 'Lv {n}',
    'b0.needKitchen': '需要厨房（B0 暂未开放）',
    'b0.pantryPrefix': '库存：',
    'b0.closingNote': '20:00 打烊中 · 等待已接订单完成',
    'b0.benchHzUnknown': '未知',
    'b0.benchPacingInvalid': '注意：平均帧率 {avgFps} fps 高于屏幕刷新率 {hz} Hz 的 1.05 倍，帧节拍无效，不可用于性能对比。',
    'b0.benchPacingUnchecked': '提示：未能读取屏幕刷新率，无法完成帧节拍自检。',
    'b0.benchMetrics':
      '预设：{preset} · 渲染器：{renderer}\n设备：{device}\n分辨率：{res} · 刷新率：{hz} · 垂直同步：{vsync}\n加载与上传：{load} ms\n平均帧率：{avgFps} fps\n帧时间 p50 / p95 / 最大：{p50} / {p95} / {max} ms\n超过 25ms 帧数：{slow} / {frames}\nDraw Calls：{draws}\n显存 (VRAM)：{vram} MB\n贴图内存：{tex} MB\n静态内存：{staticMem} MB',
  },
  en: {
    'b0.openShop': 'Open Shop',
    'b0.closeShop': 'Close Shop',
    'b0.langToggle': '中文',
    'b0.benchBtn': 'Bench',
    'b0.benchTitle': 'Performance Benchmark (30s)',
    'b0.benchWarmup': 'Warming up… {sec}s left (load {load} ms)',
    'b0.benchRunning': 'Running… {sec}s left',
    'b0.benchDone': 'Done · saved to user://bench.json',
    'b0.benchStartFull': 'Run Full (full)',
    'b0.benchStartHalf': 'Run Half (half)',
    'b0.benchStop': 'Back to Café',
    'b0.benchDesc': 'Fixed seed and camera, 30 animated characters + full static building, 2s warmup then 30s sampling.',
    'b0.presetFull': 'Full',
    'b0.presetHalf': 'Half',
    'b0.stockOk': '{n} in stock',
    'b0.stockOut': 'Sold out',
    'b0.locked': 'Locked',
    'b0.level': 'Lv {n}',
    'b0.needKitchen': 'Needs kitchen (not in B0)',
    'b0.pantryPrefix': 'Pantry: ',
    'b0.closingNote': 'Closing (20:00) · finishing accepted orders',
    'b0.benchHzUnknown': 'Unknown',
    'b0.benchPacingInvalid': 'WARNING: Avg {avgFps} fps exceeds 1.05× refresh rate ({hz} Hz). Frame pacing is invalid — do not use for comparison.',
    'b0.benchPacingUnchecked': 'Note: Display refresh rate unavailable — pacing self-check could not run.',
    'b0.benchMetrics':
      'Preset: {preset} · Renderer: {renderer}\nDevice: {device}\nResolution: {res} · Refresh: {hz} · VSync: {vsync}\nLoad + Upload: {load} ms\nAvg FPS: {avgFps} fps\nFrame time p50 / p95 / max: {p50} / {p95} / {max} ms\nFrames > 25ms: {slow} / {frames}\nDraw Calls: {draws}\nVideo RAM: {vram} MB\nTexture Mem: {tex} MB\nStatic Mem: {staticMem} MB',
  },
};

function requireMatch(text, regex, label) {
  const m = text.match(regex);
  if (!m) throw new Error(`Failed to extract ${label} from TS source`);
  return m;
}

function parseNum(raw, label) {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric value for ${label}: ${raw}`);
  return n;
}

/** Read TS source files needed for non-exported constant extraction. */
export function readTsSources(rootDir) {
  return {
    mainTs: readFileSync(join(rootDir, 'src/main.ts'), 'utf8'),
    simTs: readFileSync(join(rootDir, 'src/game/sim.ts'), 'utf8'),
    economyTs: readFileSync(join(rootDir, 'src/game/economy.ts'), 'utf8'),
    trafficTs: readFileSync(join(rootDir, 'src/game/traffic.ts'), 'utf8'),
    formatTs: readFileSync(join(rootDir, 'src/game/format.ts'), 'utf8'),
    floorsLayoutTs: readFileSync(join(rootDir, 'src/render/floors/floors-layout.ts'), 'utf8'),
    floorsSceneTs: readFileSync(join(rootDir, 'src/render/floors/floors-scene.ts'), 'utf8'),
  };
}

function extractSimConstants(sources) {
  const simStep = parseNum(
    requireMatch(sources.mainTs, /\bconst\s+SIM_STEP\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'SIM_STEP (src/main.ts)')[1],
    'SIM_STEP',
  );
  const trayPlates = parseNum(
    requireMatch(sources.simTs, /\bconst\s+TRAY_PLATES\s*=\s*([0-9]+)\s*;/, 'TRAY_PLATES (src/game/sim.ts)')[1],
    'TRAY_PLATES',
  );
  const orderSeconds = parseNum(
    requireMatch(sources.simTs, /\bconst\s+ORDER_SECONDS\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'ORDER_SECONDS (src/game/sim.ts)')[1],
    'ORDER_SECONDS',
  );
  const callSeconds = parseNum(
    requireMatch(sources.simTs, /\bconst\s+CALL_SECONDS\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'CALL_SECONDS (src/game/sim.ts)')[1],
    'CALL_SECONDS',
  );
  const initialSpawnTimerField = parseNum(
    requireMatch(sources.simTs, /\bprivate\s+spawnTimer\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'spawnTimer field (src/game/sim.ts)')[1],
    'spawnTimer field',
  );
  const initialSpawnTimerReset = parseNum(
    requireMatch(sources.simTs, /\bthis\.spawnTimer\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'spawnTimer reset (src/game/sim.ts)')[1],
    'spawnTimer reset',
  );
  if (initialSpawnTimerField !== initialSpawnTimerReset) {
    throw new Error(`Mismatched initial spawnTimer in src/game/sim.ts: ${initialSpawnTimerField} vs ${initialSpawnTimerReset}`);
  }
  const jitterMatch = requireMatch(
    sources.simTs,
    /\bthis\.spawnTimer\s*=\s*rate\s*>\s*0\s*\?\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*\+\s*this\.rng\(\)\s*\)\s*\/\s*rate\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*;/,
    'arrival jitter (src/game/sim.ts)',
  );
  const arrivalJitterBase = parseNum(jitterMatch[1], 'arrivalJitterBase');
  const arrivalEmptyFallback = parseNum(jitterMatch[2], 'arrivalEmptyFallback');

  const lookMatch = requireMatch(
    sources.simTs,
    /private\s+randomLook\(\)\s*:\s*Look\s*\{\s*return\s*\{\s*skin:\s*this\.randInt\((\d+)\)\s*,\s*hair:\s*this\.randInt\((\d+)\)\s*,\s*hairStyle:\s*this\.randInt\((\d+)\)\s*,\s*shirt:\s*this\.randInt\((\d+)\)\s*,\s*pants:\s*this\.randInt\((\d+)\)\s*,?\s*\}\s*;\s*\}/,
    'randomLook ranges (src/game/sim.ts)',
  );
  const randomLookRanges = {
    skin: parseNum(lookMatch[1], 'randomLookRanges.skin'),
    hair: parseNum(lookMatch[2], 'randomLookRanges.hair'),
    hairStyle: parseNum(lookMatch[3], 'randomLookRanges.hairStyle'),
    shirt: parseNum(lookMatch[4], 'randomLookRanges.shirt'),
    pants: parseNum(lookMatch[5], 'randomLookRanges.pants'),
  };
  const lookPackMatch = requireMatch(
    sources.simTs,
    /this\.castRandomState\s*=\s*1\s*\+\s*\(\(\(\(seedLook\.skin\s*\*\s*(\d+)\s*\+\s*seedLook\.hair\)\s*\*\s*(\d+)\s*\+\s*seedLook\.hairStyle\)\s*\*\s*(\d+)\s*\+\s*seedLook\.shirt\)\s*\*\s*(\d+)\s*\+\s*seedLook\.pants\)\s*;/,
    'castRandomState look packing (src/game/sim.ts)',
  );
  if (
    parseNum(lookPackMatch[1], 'pack.hair') !== randomLookRanges.hair ||
    parseNum(lookPackMatch[2], 'pack.hairStyle') !== randomLookRanges.hairStyle ||
    parseNum(lookPackMatch[3], 'pack.shirt') !== randomLookRanges.shirt ||
    parseNum(lookPackMatch[4], 'pack.pants') !== randomLookRanges.pants
  ) {
    throw new Error('randomLook ranges disagree with castRandomState packing multipliers in src/game/sim.ts');
  }

  const sitMatch = requireMatch(
    sources.simTs,
    /\bc\.timer\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*\+\s*this\.rng\(\)\s*\*\s*([0-9]+(?:\.[0-9]+)?)\b/,
    'sit dwell timer (src/game/sim.ts)',
  );
  const sitMinSeconds = parseNum(sitMatch[1], 'sitMinSeconds');
  const sitRangeSeconds = parseNum(sitMatch[2], 'sitRangeSeconds');

  const calmEnd = parseNum(
    requireMatch(sources.trafficTs, /\bconst\s+CALM_END\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'CALM_END (src/game/traffic.ts)')[1],
    'CALM_END',
  );
  const riseEnd = parseNum(
    requireMatch(sources.trafficTs, /\bconst\s+RISE_END\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'RISE_END (src/game/traffic.ts)')[1],
    'RISE_END',
  );
  const busyEnd = parseNum(
    requireMatch(sources.trafficTs, /\bconst\s+BUSY_END\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'BUSY_END (src/game/traffic.ts)')[1],
    'BUSY_END',
  );
  const rampSeconds = parseNum(
    requireMatch(sources.trafficTs, /\bconst\s+RAMP_SECONDS\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'RAMP_SECONDS (src/game/traffic.ts)')[1],
    'RAMP_SECONDS',
  );

  const milestoneMultiplierFactor = parseNum(
    requireMatch(
      sources.economyTs,
      /for\s*\(\s*const\s+m\s+of\s+PRICE_MILESTONES\s*\)\s*if\s*\(\s*level\s*>=\s*m\s*\)\s*mult\s*\*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/,
      'milestone multiplier factor (src/game/economy.ts)',
    )[1],
    'milestoneMultiplierFactor',
  );
  const milestoneProgressSlope = parseNum(
    requireMatch(
      sources.economyTs,
      /\(1\s*\+\s*([0-9]+(?:\.[0-9]+)?)\s*\*\s*progress\)/,
      'milestone progress slope (src/game/economy.ts)',
    )[1],
    'milestoneProgressSlope',
  );
  const economyBaseSeatChance = parseNum(
    requireMatch(
      sources.economyTs,
      /\bBASE_SEAT_CHANCE\s*=\s*([0-9]+(?:\.[0-9]+)?)\b/,
      'BASE_SEAT_CHANCE (src/game/economy.ts)',
    )[1],
    'BASE_SEAT_CHANCE',
  );
  const drinkReserveMatch = requireMatch(
    sources.economyTs,
    /\bservings\s*\*\s*([0-9]+(?:\.[0-9]+)?)\s*\+\s*([0-9]+(?:\.[0-9]+)?)\s*\*\s*Math\.sqrt/,
    'drink demand buffer (src/game/economy.ts)',
  );
  const drinkDemandBuffer = parseNum(drinkReserveMatch[1], 'drinkDemandBuffer');
  const drinkMixSigma = parseNum(drinkReserveMatch[2], 'drinkMixSigma');

  const suffixMatch = requireMatch(
    sources.formatTs,
    /\bconst\s+SUFFIXES\s*=\s*\[([^\]]+)\]\s*;/,
    'SUFFIXES (src/game/format.ts)',
  );
  const formatSuffixes = [...suffixMatch[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  if (formatSuffixes.length === 0) {
    throw new Error('Failed to parse SUFFIXES items from src/game/format.ts');
  }

  return {
    simStep,
    trayPlates,
    orderSeconds,
    callSeconds,
    initialSpawnTimer: initialSpawnTimerField,
    arrivalJitterBase,
    arrivalEmptyFallback,
    randomLookRanges,
    sitMinSeconds,
    sitRangeSeconds,
    trafficCalmEnd: calmEnd,
    trafficRiseEnd: riseEnd,
    trafficBusyEnd: busyEnd,
    trafficRampSeconds: rampSeconds,
    milestoneMultiplierFactor,
    milestoneProgressSlope,
    economyBaseSeatChance,
    drinkDemandBuffer,
    drinkMixSigma,
    formatSuffixes,
  };
}

function extractFloorsLayoutConstants(sources, layoutMod) {
  const src = sources.floorsLayoutTs;
  const restMatch = requireMatch(
    src,
    /export\s+function\s+restFocus\([^)]*\)\s*:\s*number\s*\{\s*const\s+margin\s*=\s*view\s*\*\s*([0-9]*\.[0-9]+|[0-9]+)\s*;\s*return\s+b\.street\s*\+\s*margin\s*<=\s*view\s*\*\s*([0-9]*\.[0-9]+|[0-9]+)\s*\?\s*view\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*-\s*margin\s*:\s*b\.street\s*-\s*view\s*\*\s*([0-9]*\.[0-9]+|[0-9]+)\s*;\s*\}/,
    'restFocus (floors-layout.ts)',
  );
  const restFocus = {
    marginRatio: parseNum(restMatch[1], 'restFocus.marginRatio'),
    fitRatio: parseNum(restMatch[2], 'restFocus.fitRatio'),
    centerDivisor: parseNum(restMatch[3], 'restFocus.centerDivisor'),
    streetRatio: parseNum(restMatch[4], 'restFocus.streetRatio'),
  };
  // Cross-check extracted restFocus constants against live layout.restFocus() on both branches.
  const evalRest = (b, view) => {
    const margin = view * restFocus.marginRatio;
    return b.street + margin <= view * restFocus.fitRatio
      ? view / restFocus.centerDivisor - margin
      : b.street - view * restFocus.streetRatio;
  };
  const bFull = layoutMod.building(8, true);
  const bStarter = layoutMod.building(2, false);
  for (const [b, view] of [[bFull, 3000], [bStarter, 5000]]) {
    const live = layoutMod.restFocus(b, view);
    const calc = evalRest(b, view);
    if (Math.abs(live - calc) > 1e-9) {
      throw new Error(`Extracted restFocus disagrees with live restFocus (${calc} vs ${live})`);
    }
  }
  const routeMinStep = parseNum(
    requireMatch(
      src,
      /if\s*\(\s*Math\.hypot\(\s*p\.x\s*-\s*last\.x\s*,\s*p\.y\s*-\s*last\.y\s*\)\s*<\s*([0-9]+(?:\.[0-9]+)?)\s*\)\s*continue\s*;/,
      'routeMinStep (floors-layout.ts)',
    )[1],
    'routeMinStep',
  );
  return { restFocus, routeMinStep };
}

function extractFloorsSceneConstants(sources, layoutMod) {
  const src = sources.floorsSceneTs;
  const eave = parseNum(
    requireMatch(src, /\bconst\s+EAVE\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'EAVE (floors-scene.ts)')[1],
    'EAVE',
  );
  const awningMatch = requireMatch(
    src,
    /\bconst\s+AWNING\s*=\s*\{\s*top:\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*height:\s*([0-9]+(?:\.[0-9]+)?)\s*\}/,
    'AWNING (floors-scene.ts)',
  );
  const awning = {
    top: parseNum(awningMatch[1], 'AWNING.top'),
    height: parseNum(awningMatch[2], 'AWNING.height'),
  };
  const sideWinMatch = requireMatch(
    src,
    /\bconst\s+SIDE_WINDOW\s*=\s*\{\s*x:\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*y:\s*([0-9]+(?:\.[0-9]+)?)\s*\}/,
    'SIDE_WINDOW (floors-scene.ts)',
  );
  const sideWindow = {
    x: parseNum(sideWinMatch[1], 'SIDE_WINDOW.x'),
    y: parseNum(sideWinMatch[2], 'SIDE_WINDOW.y'),
  };
  const edgesMatch = requireMatch(
    src,
    /\bconst\s+FRAME_EDGES\s*=\s*\{\s*sky:\s*0x([0-9a-fA-F]{6})\s*,\s*street:\s*0x([0-9a-fA-F]{6})\s*,\s*soil:\s*0x([0-9a-fA-F]{6})\s*\}/,
    'FRAME_EDGES (floors-scene.ts)',
  );
  const frameEdges = {
    sky: `#${edgesMatch[1].toLowerCase()}`,
    street: `#${edgesMatch[2].toLowerCase()}`,
    soil: `#${edgesMatch[3].toLowerCase()}`,
  };
  const overscrollMatch = requireMatch(
    src,
    /\bconst\s+OVERSCROLL\s*=\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\/\s*([0-9]+(?:\.[0-9]+)?))?\s*;/,
    'OVERSCROLL (floors-scene.ts)',
  );
  const overscroll = overscrollMatch[2]
    ? parseNum(overscrollMatch[1], 'OVERSCROLL num') / parseNum(overscrollMatch[2], 'OVERSCROLL den')
    : parseNum(overscrollMatch[1], 'OVERSCROLL');
  const overscrollBottomDivisor = parseNum(
    requireMatch(
      src,
      /\bhigh\s*=\s*Math\.max\(\s*rest\s*,\s*b\.height\s*-\s*half\s*\)\s*\+\s*slack\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*;/,
      'overscrollBottomDivisor (floors-scene.ts)',
    )[1],
    'overscrollBottomDivisor',
  );
  const sitPoseMatch = requireMatch(
    src,
    /actor\.clock\s*%\s*([0-9]*\.[0-9]+|[0-9]+)\s*<\s*([0-9]*\.[0-9]+|[0-9]+)\s*\?\s*MOVES\.hold\s*:\s*actor\.clock\s*%\s*([0-9]*\.[0-9]+|[0-9]+)\s*<\s*([0-9]*\.[0-9]+|[0-9]+)\s*\?\s*MOVES\.sip\s*:\s*MOVES\.laugh/,
    'sitPose rhythm (floors-scene.ts)',
  );
  const sitPose = {
    holdPeriod: parseNum(sitPoseMatch[1], 'sitPose.holdPeriod'),
    holdCutoff: parseNum(sitPoseMatch[2], 'sitPose.holdCutoff'),
    sipPeriod: parseNum(sitPoseMatch[3], 'sitPose.sipPeriod'),
    sipCutoff: parseNum(sitPoseMatch[4], 'sitPose.sipCutoff'),
  };
  const walkAnimDivisor = parseNum(
    requireMatch(src, /\bconst\s+rate\s*=\s*WALK\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'walkAnimDivisor (floors-scene.ts)')[1],
    'walkAnimDivisor',
  );
  const walkFps = layoutMod.WALK / walkAnimDivisor;
  const maxLegRate = parseNum(
    requireMatch(src, /\bconst\s+LEGS\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/, 'LEGS (floors-scene.ts)')[1],
    'maxLegRate',
  );
  const skyOffsetY = parseNum(
    requireMatch(src, /this\.sky\.setY\(\s*eave\s*\+\s*([0-9]+(?:\.[0-9]+)?)\s*\)/, 'skyOffsetY (floors-scene.ts)')[1],
    'skyOffsetY',
  );
  const stepOffsetY = parseNum(
    requireMatch(
      src,
      /this\.add\.image\(\s*DOOR\.x\s*,\s*b\.street\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*'frame\/step'\s*\)/,
      'stepOffsetY (floors-scene.ts)',
    )[1],
    'stepOffsetY',
  );
  const cupMatch = requireMatch(
    src,
    /actor\.cup\?\.setPosition\(\s*p\.x\s*\+\s*\(\s*actor\.sprite\.flipX\s*\?\s*-([0-9]+(?:\.[0-9]+)?)\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*\)\s*,\s*p\.y\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*\)/,
    'cupOffset (floors-scene.ts)',
  );
  const cupXNeg = parseNum(cupMatch[1], 'cupOffset.xNeg');
  const cupXPos = parseNum(cupMatch[2], 'cupOffset.xPos');
  if (cupXNeg !== cupXPos) {
    throw new Error(`Asymmetric cup X offset in floors-scene.ts: -${cupXNeg} vs +${cupXPos}`);
  }
  const cupOffset = { x: cupXPos, y: parseNum(cupMatch[3], 'cupOffset.y') };

  const walkSideRatio = parseNum(
    requireMatch(
      src,
      /\bway\s*=\s*Math\.abs\(dx\)\s*>=\s*Math\.abs\(dy\)\s*\*\s*([0-9]*\.[0-9]+|[0-9]+)\s*\?\s*'side'/,
      'walkSideRatio (floors-scene.ts)',
    )[1],
    'walkSideRatio',
  );
  const walkFlipDeadzone = parseNum(
    requireMatch(
      src,
      /if\s*\(\s*Math\.abs\(dx\)\s*>\s*([0-9]*\.[0-9]+|[0-9]+)\s*\)\s*actor\.sprite\.setFlipX/,
      'walkFlipDeadzone (floors-scene.ts)',
    )[1],
    'walkFlipDeadzone',
  );

  const sideFramesMatch = requireMatch(
    src,
    /\bconst\s+SIDE\s*=\s*\{\s*walk:\s*\[([^\]]+)\]\s*,\s*front:\s*(\d+)\s*,\s*happy:\s*(\d+)\s*,\s*side:\s*(\d+)\s*,\s*back:\s*(\d+)\s*\}/,
    'SIDE frames (floors-scene.ts)',
  );
  const sideFrames = {
    walk: sideFramesMatch[1].split(',').map((s) => parseNum(s.trim(), 'SIDE.walk')),
    front: parseNum(sideFramesMatch[2], 'SIDE.front'),
    happy: parseNum(sideFramesMatch[3], 'SIDE.happy'),
    side: parseNum(sideFramesMatch[4], 'SIDE.side'),
    back: parseNum(sideFramesMatch[5], 'SIDE.back'),
  };
  const movesFramesMatch = requireMatch(
    src,
    /\bconst\s+MOVES\s*=\s*\{\s*down:\s*\[([^\]]+)\]\s*,\s*up:\s*\[([^\]]+)\]\s*,\s*sit:\s*(\d+)\s*,\s*hold:\s*(\d+)\s*,\s*sip:\s*(\d+)\s*,\s*laugh:\s*(\d+)\s*\}/,
    'MOVES frames (floors-scene.ts)',
  );
  const movesFrames = {
    down: movesFramesMatch[1].split(',').map((s) => parseNum(s.trim(), 'MOVES.down')),
    up: movesFramesMatch[2].split(',').map((s) => parseNum(s.trim(), 'MOVES.up')),
    sit: parseNum(movesFramesMatch[3], 'MOVES.sit'),
    hold: parseNum(movesFramesMatch[4], 'MOVES.hold'),
    sip: parseNum(movesFramesMatch[5], 'MOVES.sip'),
    laugh: parseNum(movesFramesMatch[6], 'MOVES.laugh'),
  };
  const guestArtMatch = requireMatch(
    src,
    /\bexport\s+const\s+GUEST_ART\s*=\s*\[([^\]]+)\]/,
    'GUEST_ART (floors-scene.ts)',
  );
  const guestArt = [...guestArtMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (guestArt.length === 0) {
    throw new Error('Failed to extract GUEST_ART from floors-scene.ts');
  }

  return {
    eave,
    awning,
    sideWindow,
    frameEdges,
    overscroll,
    overscrollBottomDivisor,
    sitPose,
    walkFps,
    maxLegRate,
    skyOffsetY,
    stepOffsetY,
    cupOffset,
    walkSideRatio,
    walkFlipDeadzone,
    sideFrames,
    movesFrames,
    guestArt,
  };
}

export function buildGameData(mods, sources) {
  const { data, economy, state, clock, traffic, sim, customerCast, gameLayout } = mods;
  if (!sources) throw new Error('buildGameData requires TS sources for constant extraction');
  const extracted = extractSimConstants(sources);
  const initial = state.createInitialState(0);

  // Evaluate live TS functions on starter state rather than hand-copying defaults.
  const basePatience = economy.patienceSeconds(initial);
  const baseTablePatience = economy.tablePatience(initial);
  const baseSeatChance = economy.orderSeatChance(initial, [initial.onMenu[0]]);
  if (Math.abs(baseSeatChance - extracted.economyBaseSeatChance) > 1e-9) {
    throw new Error(
      `orderSeatChance (${baseSeatChance}) disagrees with economy.ts BASE_SEAT_CHANCE (${extracted.economyBaseSeatChance})`,
    );
  }
  const serverSpeedMultiplier = sim.SERVER_SPEED / sim.WALK_SPEED;
  const front = gameLayout.queueSpot(0);
  const counter = gameLayout.serviceSpot(0);
  const counterWalkSeconds = Math.hypot(counter.x - front.x, counter.y - front.y) / data.CUSTOMER_WALK_SPEED;

  // Cross-check extracted milestoneMultiplierFactor & milestoneProgressSlope against live economy functions.
  const firstMilestone = data.PRICE_MILESTONES[0];
  const liveMilestoneMult = economy.milestoneMultiplier(firstMilestone);
  if (Math.abs(liveMilestoneMult - extracted.milestoneMultiplierFactor) > 1e-9) {
    throw new Error(
      `Extracted milestoneMultiplierFactor (${extracted.milestoneMultiplierFactor}) disagrees with milestoneMultiplier(${firstMilestone}) (${liveMilestoneMult})`,
    );
  }
  const probePrice = economy.itemPrice({ ...data.MENU[0], basePrice: 1 }, 2);
  const expectedProbe = 2 * (1 + extracted.milestoneProgressSlope * (1 / (firstMilestone - 1)));
  if (Math.abs(probePrice - expectedProbe) > 1e-9) {
    throw new Error(`Extracted milestoneProgressSlope (${extracted.milestoneProgressSlope}) disagrees with itemPrice`);
  }

  const menu = data.MENU.map((m) => ({
    id: m.id,
    category: m.category,
    isDrink: data.isDrink(m.category),
    requiresKitchen: economy.requiresKitchen(m.id),
    basePrice: m.basePrice,
    prepTime: m.prepTime,
    baseCost: m.baseCost,
    recipe: data.RECIPES[m.id] ?? {},
  }));

  const ingredients = data.INGREDIENTS.map((ing) => ({
    id: ing.id,
    cost: ing.cost,
  }));

  return {
    categories: [...data.CATEGORIES],
    menu,
    ingredients,
    constants: {
      daySeconds: data.DAY_SECONDS,
      simStep: extracted.simStep,
      speeds: [...data.SPEEDS],
      businessOpenHour: clock.BUSINESS_OPEN_HOUR,
      businessHours: clock.BUSINESS_HOURS,
      maxQueue: data.MAX_QUEUE,
      baseArrivalRate: data.BASE_ARRIVAL_RATE,
      vipChance: data.VIP_CHANCE,
      vipMultiplier: data.VIP_MULTIPLIER,
      passSlots: data.PASS_SLOTS,
      ringAgain: data.RING_AGAIN,
      customerWalkSpeed: data.CUSTOMER_WALK_SPEED,
      serverSpeedMultiplier,
      counterWalkSeconds,
      itemCostGrowth: data.ITEM_COST_GROWTH,
      levelCostMultiplier: data.LEVEL_COST_MULTIPLIER,
      priceMilestones: [...data.PRICE_MILESTONES],
      milestoneMultiplierFactor: extracted.milestoneMultiplierFactor,
      milestoneProgressSlope: extracted.milestoneProgressSlope,
      comboChance: data.COMBO_CHANCE,
      varietyBonus: data.VARIETY_BONUS,
      maxVarietyBonus: data.MAX_VARIETY_BONUS,
      starterBeans: state.STARTER_BEANS,
      initialSpawnTimer: extracted.initialSpawnTimer,
      arrivalJitterBase: extracted.arrivalJitterBase,
      arrivalEmptyFallback: extracted.arrivalEmptyFallback,
      randomLookRanges: extracted.randomLookRanges,
      castCount: customerCast.CUSTOMER_CAST.length,
      formatSuffixes: extracted.formatSuffixes,
      orderSeconds: extracted.orderSeconds,
      callSeconds: extracted.callSeconds,
      trayPlates: extracted.trayPlates,
      sitMinSeconds: extracted.sitMinSeconds,
      sitRangeSeconds: extracted.sitRangeSeconds,
      basePatience,
      baseTablePatience,
      baseSeatChance,
      drinkDemandBuffer: extracted.drinkDemandBuffer,
      drinkMixSigma: extracted.drinkMixSigma,
      trafficCycleSeconds: traffic.TRAFFIC_CYCLE_SECONDS,
      trafficAmplitude: traffic.TRAFFIC_AMPLITUDE,
      trafficCalmEnd: extracted.trafficCalmEnd,
      trafficRiseEnd: extracted.trafficRiseEnd,
      trafficBusyEnd: extracted.trafficBusyEnd,
      trafficRampSeconds: extracted.trafficRampSeconds,
    },
    starterState: {
      coins: initial.coins,
      day: initial.day,
      speed: initial.speed,
      kitchen: initial.kitchen,
      onMenu: [...initial.onMenu],
      items: { ...initial.items },
      pantry: { ...initial.pantry },
      equippedDecor: { ...initial.decor.equipped },
    },
  };
}

export function buildLayoutData(mods, sources) {
  const { layout, decorLayers, floorsUpgrades } = mods;
  if (!sources) throw new Error('buildLayoutData requires TS sources for constant extraction');
  const layoutConsts = extractFloorsLayoutConstants(sources, layout);
  const sceneConsts = extractFloorsSceneConstants(sources, layout);

  const activeAll = [0, 1, 2, 3, 4, 5, 6, 7];
  const tables = [];
  for (let i = 0; i < layout.TABLE_SLOTS; i++) {
    const pair = layout.tableSeats(i, activeAll);
    tables.push([pair[0], pair[1]]);
  }

  return {
    worldWidth: layout.WORLD_W,
    floorArt: layout.FLOOR_ART,
    frame: layout.FRAME,
    groundShift: layout.GROUND_SHIFT,
    stairsHall: layout.STAIRS_HALL,
    stairsRail: layout.STAIRS_RAIL,
    door: layout.DOOR,
    queue: layout.QUEUE,
    baristas: layout.BARISTAS,
    service: layout.SERVICE,
    pass: layout.PASS,
    serverHomes: layout.SERVER_HOMES,
    counterFront: layout.COUNTER_FRONT,
    steam: layout.STEAM,
    display: layout.DISPLAY,
    tableFront: layout.TABLE_FRONT,
    tableBox: { ...floorsUpgrades.TABLE_BOX },
    tables,
    walk: layout.WALK,
    catchUp: layout.CATCH_UP,
    restFocus: layoutConsts.restFocus,
    routeMinStep: layoutConsts.routeMinStep,
    overscroll: sceneConsts.overscroll,
    overscrollBottomDivisor: sceneConsts.overscrollBottomDivisor,
    sitPose: sceneConsts.sitPose,
    walkFps: sceneConsts.walkFps,
    maxLegRate: sceneConsts.maxLegRate,
    skyOffsetY: sceneConsts.skyOffsetY,
    stepOffsetY: sceneConsts.stepOffsetY,
    cupOffset: sceneConsts.cupOffset,
    walkSideRatio: sceneConsts.walkSideRatio,
    walkFlipDeadzone: sceneConsts.walkFlipDeadzone,
    sideFrames: sceneConsts.sideFrames,
    movesFrames: sceneConsts.movesFrames,
    guestArt: sceneConsts.guestArt,
    eave: sceneConsts.eave,
    awning: sceneConsts.awning,
    sideWindow: sceneConsts.sideWindow,
    frameEdges: sceneConsts.frameEdges,
    decorLayers: {
      back: [...decorLayers.BACK_LAYERS],
      front: [...decorLayers.FRONT_LAYERS],
      layerDepth: decorLayers.LAYER_DEPTH,
      layerStep: decorLayers.LAYER_STEP,
      hallDepth: decorLayers.HALL_DEPTH,
      inWellDepth: decorLayers.IN_WELL_DEPTH,
    },
    buildingFull: layout.building(8, true),
    buildingStarter: layout.building(2, false),
  };
}

export function buildI18nData(mods, zhRaw, enRaw) {
  const { data } = mods;
  const keys = [
    ...I18N_SOURCE_KEYS,
    ...data.MENU.map((m) => `item.${m.id}`),
    ...data.INGREDIENTS.map((i) => `ing.${i.id}`),
  ];

  const zh = { ...B0_COPY.zh };
  const en = { ...B0_COPY.en };

  for (const key of keys) {
    if (zhRaw[key] === undefined) throw new Error(`Missing zh translation key: ${key}`);
    if (enRaw[key] === undefined) throw new Error(`Missing en translation key: ${key}`);
    zh[key] = zhRaw[key];
    en[key] = enRaw[key];
  }

  return { zh, en };
}

/** True for printable ASCII and Latin-1/Extended-A/B letters & marks (including é). */
export function isLatinCodepoint(cp) {
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xc0 && cp <= 0x24f && cp !== 0xd7 && cp !== 0xf7) return true;
  return false;
}

/** True for CJK Unified Ideographs, CJK punctuation, and Fullwidth forms. */
export function isCjkCodepoint(cp) {
  return (
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}

/** Collect every character needed by the Godot B0 sample UI & copy. */
export function collectRequiredChars(i18nData) {
  const chars = new Set();
  for (let cp = 0x20; cp < 0x7f; cp++) chars.add(String.fromCharCode(cp));
  const extra = '¥$×·…—–“”‘’、，。：；！？（）《》【】％＋−→←↑↓★☆♥✓∞°•';
  for (const ch of extra) chars.add(ch);
  for (const map of [i18nData.zh, i18nData.en]) {
    for (const val of Object.values(map)) {
      for (const ch of val) {
        if (ch === '\n' || ch === '\r' || ch === '\t') continue;
        chars.add(ch);
      }
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

/** Collect all Latin characters (ASCII + accented Latin like é) + Latin symbols for Nunito subsetting. */
export function collectNunitoChars(i18nData) {
  const chars = new Set();
  for (let cp = 0x20; cp < 0x7f; cp++) chars.add(String.fromCharCode(cp));
  const nunitoSymbols = '¥×·…—–“”‘’°•';
  for (const ch of nunitoSymbols) chars.add(ch);
  for (const map of [i18nData.zh, i18nData.en]) {
    for (const val of Object.values(map)) {
      for (const ch of val) {
        if (ch === '\n' || ch === '\r' || ch === '\t') continue;
        const cp = ch.codePointAt(0);
        if (isLatinCodepoint(cp)) chars.add(ch);
      }
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

/**
 * Extract all string literals from GDScript source text (skipping `#` comments).
 * Used to catch hardcoded UI characters outside the bundled font subsets.
 */
export function extractGdStringLiterals(source) {
  const out = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    const ch = source[i];
    if (ch === '#') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const triple = source[i + 1] === ch && source[i + 2] === ch;
      const quote = ch;
      i += triple ? 3 : 1;
      let buf = '';
      while (i < n) {
        if (triple) {
          if (source[i] === quote && source[i + 1] === quote && source[i + 2] === quote) {
            i += 3;
            break;
          }
        } else if (source[i] === quote) {
          i++;
          break;
        }
        if (source[i] === '\\' && i + 1 < n) {
          const next = source[i + 1];
          if (next === 'n') { buf += '\n'; i += 2; continue; }
          if (next === 'r') { buf += '\r'; i += 2; continue; }
          if (next === 't') { buf += '\t'; i += 2; continue; }
          if (next === 'u' && i + 5 < n) {
            const hex = source.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              buf += String.fromCharCode(parseInt(hex, 16));
              i += 6;
              continue;
            }
          }
          buf += next;
          i += 2;
          continue;
        }
        buf += source[i];
        i++;
      }
      out.push(buf);
      continue;
    }
    i++;
  }
  return out;
}

/** Collect every non-whitespace character from string literals across `godot/scripts/*.gd`. */
export function collectGdScriptChars(scriptsDir) {
  const chars = new Set();
  for (const name of readdirSync(scriptsDir).sort()) {
    if (!name.endsWith('.gd')) continue;
    const src = readFileSync(join(scriptsDir, name), 'utf8');
    for (const lit of extractGdStringLiterals(src)) {
      for (const ch of lit) {
        if (ch === '\n' || ch === '\r' || ch === '\t') continue;
        chars.add(ch);
      }
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

/**
 * Pure-JS TrueType cmap parser (supports format 4 BMP and format 12 full Unicode).
 * Returns a Set<number> of Unicode codepoints mapped to non-zero glyph IDs.
 */
export function readTtfCodepoints(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const numTables = view.getUint16(4, false);
  let cmapOffset = -1;
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const tag = String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
    if (tag === 'cmap') {
      cmapOffset = view.getUint32(off + 8, false);
      break;
    }
  }
  if (cmapOffset < 0) throw new Error('TTF missing cmap table');
  const numSubtables = view.getUint16(cmapOffset + 2, false);
  const codepoints = new Set();
  for (let i = 0; i < numSubtables; i++) {
    const rec = cmapOffset + 4 + i * 8;
    const platformId = view.getUint16(rec, false);
    const subOffset = cmapOffset + view.getUint32(rec + 4, false);
    if (platformId !== 0 && platformId !== 3) continue;
    const format = view.getUint16(subOffset, false);
    if (format === 4) {
      const segCount = view.getUint16(subOffset + 6, false) / 2;
      const endCountOff = subOffset + 14;
      const startCountOff = endCountOff + segCount * 2 + 2;
      const idDeltaOff = startCountOff + segCount * 2;
      const idRangeOff = idDeltaOff + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const endCode = view.getUint16(endCountOff + s * 2, false);
        const startCode = view.getUint16(startCountOff + s * 2, false);
        if (startCode === 0xffff && endCode === 0xffff) break;
        const idDelta = view.getInt16(idDeltaOff + s * 2, false);
        const rangeOffset = view.getUint16(idRangeOff + s * 2, false);
        for (let cp = startCode; cp <= endCode; cp++) {
          let gid = 0;
          if (rangeOffset === 0) {
            gid = (cp + idDelta) & 0xffff;
          } else {
            const glyphIdxOff = idRangeOff + s * 2 + rangeOffset + (cp - startCode) * 2;
            const rawGid = view.getUint16(glyphIdxOff, false);
            if (rawGid !== 0) gid = (rawGid + idDelta) & 0xffff;
          }
          if (gid !== 0) codepoints.add(cp);
        }
      }
    } else if (format === 12) {
      const numGroups = view.getUint32(subOffset + 12, false);
      for (let g = 0; g < numGroups; g++) {
        const gOff = subOffset + 16 + g * 12;
        const startChar = view.getUint32(gOff, false);
        const endChar = view.getUint32(gOff + 4, false);
        const startGid = view.getUint32(gOff + 8, false);
        for (let cp = startChar; cp <= endChar; cp++) {
          if (startGid + (cp - startChar) !== 0) codepoints.add(cp);
        }
      }
    }
  }
  return codepoints;
}
