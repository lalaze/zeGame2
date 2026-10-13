import '@fontsource/pixelify-sans/400.css';
import './replay.css';
import { SCENE_W, sceneHeight } from '../../../src/game/layout';
import { setLocale } from '../../../src/i18n';
import { CafeView } from '../../../src/render/cafe-view';
import { CafeGame } from '../../../src/render/phaser/game';
import { MinaReplay, STEP_SECONDS, type ReplayStop } from './replay-model';

setLocale('en');
const replay = new MinaReplay();
const view = new CafeView();
Object.assign(view, { livingCats: replay.cats });
view.moveToArea('main', true);
// Freeze economic/companion clocks independently of the modal-pause rendering
// branch, so the real response elapsed can still select the actual petB frame.
view.paused = false;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('cafe');
let running = false, ready = false, accumulated = 0, statusSeconds = 0;
const advance = () => {
  replay.step();
  view.update(STEP_SECONDS, replay.sim);
};
const cafe = new CafeGame(canvas, view, replay.sim, () => replay.state, {
  tick: dt => {
    if (running) {
      accumulated += dt;
      while (accumulated + 1e-9 >= STEP_SECONDS) {
        accumulated -= STEP_SECONDS;
        advance();
      }
    }
    statusSeconds += dt;
    if (statusSeconds >= 0.2) { statusSeconds = 0; status(); }
  },
  pointerDown: () => {}, pointerMove: () => {}, interactionEnabled: () => false,
});
// QA-only inspection and explicit pose preference; production methods and
// generated character adapters remain unchanged and execute normally.
type QAComponent = {
  motionPreference: { matches: boolean };
  generatedStaff: { ready: boolean } | null;
  generatedCustomers: { ready: boolean } | null;
  generatedCats: { ready: boolean } | null;
};
const component = (cafe as unknown as { scene: QAComponent }).scene;
Object.assign(component, { motionPreference: { matches: false } });

function resize(): void {
  const availableHeight = Math.max(220, window.innerHeight - $('stage').getBoundingClientRect().top - 190);
  const cssWidth = Math.min(1120, $('stage').clientWidth, availableHeight * SCENE_W / sceneHeight());
  const cssHeight = cssWidth * sceneHeight() / SCENE_W;
  // A stable 4× authored buffer, fitted to desktop/mobile without changing layout.
  cafe.resize({ width: SCENE_W * 4, height: sceneHeight() * 4, cssWidth, cssHeight, backing: 4, smooth: false });
}
function status(): void {
  const mina = replay.mina, cat = replay.cat;
  const reduced = $<HTMLInputElement>('reduced').checked;
  $('status').textContent = [
    `${running ? 'RUNNING' : 'SIMULATION FROZEN'} · ${replay.steps} × 0.05 s = ${replay.seconds.toFixed(2)} s`,
    `Mina: id=${mina?.id ?? 'absent'} appearanceId=${mina?.appearanceId ?? 'absent'} phase=${mina?.phase ?? 'exited'} seat=${mina?.seat ?? 'none'} seated time=${mina?.timer.toFixed(2) ?? '0'} s`,
    `Cat: ${cat?.interaction?.phase ?? cat?.behavior ?? 'absent'} · guest=${cat?.interaction?.guestId ?? 'none'} · elapsed=${cat?.interaction?.elapsed.toFixed(2) ?? '0'} s`,
    `Requested real pose: ${replay.cat?.interaction?.phase === 'nuzzle' ? `Nuzzle ${reduced || Math.floor(replay.cat.interaction.elapsed / .65) % 2 === 0 ? 'A' : 'B'}` : replay.petFrame === null ? 'seated idle' : reduced ? 'Pet A (reduced motion)' : replay.petFrame === 0 ? 'Pet A' : 'Pet B'}`,
    `Generated asset adapters: owner=${component.generatedStaff?.ready ?? false}, Mina=${component.generatedCustomers?.ready ?? false}, Siamese=${component.generatedCats?.ready ?? false}. False means production fallback is active.`,
    `No inventory shortcuts · served=${replay.state.today.served} · shortages=${JSON.stringify(replay.state.today.shortages)}`,
  ].join('\n');
}
function reset(stop: ReplayStop): void {
  running = false; accumulated = 0;
  replay.reset(stop);
  view.effects.length = 0; view.sales.length = 0;
  view.kitchenDoor = 0; view.selectedCat = null; view.catSelectionSeconds = 0;
  view.moveToArea('main', true);
  $('run').textContent = 'Run';
  status();
}
document.querySelectorAll<HTMLButtonElement>('[data-stop]').forEach(button => {
  button.addEventListener('click', () => reset(button.dataset.stop as ReplayStop));
});
$('step').addEventListener('click', () => {
  running = false; accumulated = 0; $('run').textContent = 'Run'; advance(); status();
});
$('run').addEventListener('click', () => {
  if (!ready) return;
  running = !running; accumulated = 0; $('run').textContent = running ? 'Pause' : 'Run'; status();
});
$('reset').addEventListener('click', () => reset('petA'));
$('reduced').addEventListener('change', () => {
  Object.assign(component, { motionPreference: { matches: $<HTMLInputElement>('reduced').checked } });
  status();
});
window.addEventListener('resize', resize);
resize();
void cafe.ready.then(() => {
  ready = true;
  document.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
  $('loading').textContent = 'Renderer ready. Pet A was reached by 378 normal seeded updates; simulation is frozen.';
  resize(); status();
}).catch(error => {
  $('loading').textContent = `Renderer did not become ready: ${String(error)}`;
});
