import './room-projects.css';
import { BLUEPRINTS, PROJECT_MODES, ROOM_PROJECTS, buyBlueprint, collectAllProjects, collectProject, hasBlueprint, projectAvailable, projectCapacity, projectCycleSeconds, projectProduction, projectUpgradeBlock, projectUpgradeCost, setProjectMode, upgradeProject, type ProjectId, type ProjectMode } from '../game/room-projects';
import { isAreaOpen, type AreaId } from '../game/regions';
import { formatDuration, formatTransactionMoney as money } from '../game/format';
import type { GameState } from '../game/state';
import { t, type MessageKey } from '../i18n';
import { furnitureIcon } from '../render/furniture-art';
import { closeModal, showModal, toast } from './modal';

const name = (id: ProjectId) => t(`projects.${id}.name` as MessageKey);
const areaName = (id: AreaId) => t(`area.${id}.name` as MessageKey);
let activeBook: { body: HTMLElement; update: () => void } | null = null;
/** Called by the normal UI heartbeat; no timers survive a closed book. */
export function updateRoomProjectsBook(): void {
  if (!activeBook?.body.isConnected) { activeBook = null; return; }
  activeBook.update();
}
export function projectsEntryLabel(s: GameState, now: number): string {
  const ready = ROOM_PROJECTS.filter(p => projectProduction(s, p.id, now).batches > 0).length;
  return t(ready ? 'projects.entryReady' : 'projects.entry', { n: ready });
}

export function showRoomProjects(s: GameState, changed: () => void, visit?: (area: AreaId) => void, back?: () => void): void {
  const projects = ROOM_PROJECTS.filter(p => p.area === 'main');
  const body = document.createElement('div'); body.className = 'projects-book';
  body.innerHTML = `<p class="projects-intro">${t('projects.intro')}</p>
    <div class="projects-summary"><strong data-project-wallet></strong><button class="pixel-btn small" data-project-collect-all></button></div>
    <p class="note">${t('projects.strategy')}</p><div class="project-grid"></div>
    <h3>${t('projects.blueprints')}</h3><p class="note">${t('projects.carry')}</p><div class="project-blueprints"></div>`;
  const grid = body.querySelector('.project-grid')!;
  const rows = new Map<ProjectId, HTMLElement>();
  const finish = () => { changed(); update(); };
  const rewardToast = (reward: { coins: number; inspiration: number }) => toast(t('projects.collected', { money: money(reward.coins), n: reward.inspiration }));
  projects.forEach((def) => {
    const card = document.createElement('section'); card.className = `project-card project-${def.id}`; card.dataset.project = def.id;
    card.innerHTML = `<header><img alt="" /><div><small>${areaName(def.area)}</small><h3>${name(def.id)}</h3></div><span class="project-level"></span></header>
      <p class="project-desc">${t(`projects.${def.id}.desc` as MessageKey)}</p>
      <p class="project-status"></p><progress max="1" value="0" aria-label="${t('projects.progress')}"></progress>
      <p class="note project-yield"></p><div class="project-modes" role="group" aria-label="${t('projects.schedule')}"></div>
      <p class="note project-timing-note">${t('projects.restartHint')}</p>
      <div class="project-actions"><button class="pixel-btn small" data-project-collect></button><button class="pixel-btn small ghost" data-project-upgrade></button></div>
      <p class="note project-reason" id="project-reason-${def.id}"></p><button class="project-visit chip"></button>`;
    card.querySelector<HTMLImageElement>('img')!.src = furnitureIcon(def.art).toDataURL();
    for (const mode of Object.keys(PROJECT_MODES) as ProjectMode[]) {
      const button = document.createElement('button'); button.className = 'chip'; button.dataset.projectMode = mode;
      button.addEventListener('click', () => { if (setProjectMode(s, def.id, mode, Date.now())) finish(); });
      card.querySelector('.project-modes')!.append(button);
    }
    card.querySelector('[data-project-collect]')!.addEventListener('click', () => {
      const reward = collectProject(s, def.id, Date.now());
      if (reward.batches) { rewardToast(reward); finish(); }
    });
    const upgrade = card.querySelector<HTMLButtonElement>('[data-project-upgrade]')!;
    upgrade.setAttribute('aria-describedby', `project-reason-${def.id}`);
    upgrade.addEventListener('click', () => {
      if (upgradeProject(s, def.id, Date.now())) { toast(t('projects.upgraded', { name: name(def.id) })); finish(); }
    });
    const go = card.querySelector<HTMLButtonElement>('.project-visit')!;
    go.hidden = !visit;
    go.addEventListener('click', () => { closeModal(); visit?.(def.area); });
    rows.set(def.id, card); grid.append(card);
  });
  const blueprintRows = BLUEPRINTS.map(def => {
    const row = document.createElement('div'); row.className = 'project-blueprint';
    row.innerHTML = `<div><h4>${t(`projects.blueprint.${def.id}.name` as MessageKey)}</h4><p class="note">${t(`projects.blueprint.${def.id}.desc` as MessageKey)}</p></div><button class="pixel-btn small"></button>`;
    row.querySelector('button')!.addEventListener('click', () => { if (buyBlueprint(s, def.id, Date.now())) finish(); });
    body.querySelector('.project-blueprints')!.append(row);
    return { def, row };
  });
  const collectAll = body.querySelector<HTMLButtonElement>('[data-project-collect-all]')!;
  collectAll.addEventListener('click', () => { const reward = collectAllProjects(s, Date.now()); rewardToast(reward); finish(); });

  function update(): void {
    const now = Date.now();
    body.querySelector('[data-project-wallet]')!.textContent = t('projects.wallet', { n: s.roomProjects.inspiration });
    let totalCoins = 0;
    for (const def of projects) {
      const card = rows.get(def.id)!, facility = s.roomProjects.facilities[def.id];
      const output = projectProduction(s, def.id, now), cost = projectUpgradeCost(s, def.id), block = projectUpgradeBlock(s, def.id);
      totalCoins += output.coins;
      card.classList.toggle('project-locked', !projectAvailable(s, def.id));
      card.classList.toggle('project-ready', output.batches > 0);
      card.querySelector('.project-level')!.textContent = facility ? `Lv.${facility.level}/3` : t('projects.unbuilt');
      card.querySelector('.project-status')!.textContent = !projectAvailable(s, def.id)
        ? t('projects.dayLocked')
        : !facility ? t('projects.startHint') : output.full ? t('projects.full', { n: output.capacity })
          : t('projects.running', { n: output.batches, cap: output.capacity, time: formatDuration(Math.ceil(output.left)) });
      const progress = card.querySelector('progress')!; progress.hidden = !facility; progress.value = output.progress;
      const mode = facility?.mode ?? 'short', terms = PROJECT_MODES[mode];
      card.querySelector('.project-yield')!.textContent = t('projects.yield', {
        money: money(def.coins * terms.yield * (facility?.level ?? 1)), n: def.inspiration * terms.yield * (facility?.level ?? 1),
        time: formatDuration(projectCycleSeconds(s, mode)), storage: formatDuration(projectCycleSeconds(s, mode) * projectCapacity(s, mode)),
      });
      card.querySelector<HTMLElement>('.project-modes')!.hidden = !facility;
      card.querySelector<HTMLElement>('.project-timing-note')!.hidden = !facility;
      for (const button of card.querySelectorAll<HTMLButtonElement>('[data-project-mode]')) {
        const option = button.dataset.projectMode as ProjectMode;
        button.textContent = t(`projects.mode.${option}`, { time: formatDuration(projectCycleSeconds(s, option)) });
        button.setAttribute('aria-pressed', String(option === mode)); button.classList.toggle('active', option === mode);
      }
      const collect = card.querySelector<HTMLButtonElement>('[data-project-collect]')!;
      collect.hidden = !facility; collect.disabled = output.batches === 0;
      collect.textContent = t('projects.collect', { money: money(output.coins), n: output.inspiration });
      const upgrade = card.querySelector<HTMLButtonElement>('[data-project-upgrade]')!;
      upgrade.disabled = block !== null;
      upgrade.textContent = cost ? t(facility ? 'projects.upgrade' : 'projects.unlock', { money: money(cost.coins), n: cost.inspiration }) : t('projects.max');
      card.querySelector('.project-reason')!.textContent = block === 'coins' ? t('projects.needCoins', { money: money(cost!.coins - s.coins) })
        : block === 'inspiration' ? t('projects.needInspiration', { n: cost!.inspiration - s.roomProjects.inspiration })
          : '';
      card.querySelector('.project-visit')!.textContent = t(isAreaOpen(s, def.area) ? 'projects.visit' : 'projects.preview', { name: areaName(def.area) });
    }
    collectAll.disabled = totalCoins === 0;
    collectAll.textContent = t('projects.collectAll', { money: money(totalCoins) });
    for (const { def, row } of blueprintRows) {
      const owned = hasBlueprint(s, def.id), button = row.querySelector('button')!;
      button.disabled = owned || s.roomProjects.inspiration < def.cost;
      button.textContent = t(owned ? 'projects.researched' : 'projects.research', { n: def.cost });
    }
  }
  update();
  showModal({ title: t('projects.title'), body, focusableBody: true, buttons: [{ label: t('map.back'), onClick: back }] });
  body.closest('.modal')?.classList.add('projects-modal');
  activeBook = { body, update };
}
