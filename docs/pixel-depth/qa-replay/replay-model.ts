import source from '../fixtures/main-art.json?raw';
import { openShop } from '../../../src/game/day';
import { LivingCats } from '../../../src/game/living-cats';
import { MIN_SCENE_H, setSceneHeight } from '../../../src/game/layout';
import { adoptCat } from '../../../src/game/pets';
import { Sim } from '../../../src/game/sim';
import { deserialize, type GameState } from '../../../src/game/state';

export const STEP_SECONDS = 0.05;
// Re-found after the dining redesign (d11d93c) moved seats and slowed the original cat: with
// seed 1234581938 the Siamese now reaches Mina only after she has left.
export const REPLAY_STOPS = { idle: 177, nuzzleA: 260, nuzzleB: 273, petA: 300, petB: 313 } as const;
const CAT_SEED = 694;
export type ReplayStop = keyof typeof REPLAY_STOPS;
const seeded = (initial: number) => {
  let seed = initial;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};

/** QA owns these engines; there is no save storage or fabricated interaction. */
export class MinaReplay {
  private simRandom = seeded(52);
  private catRandom = seeded(CAT_SEED);
  readonly sim = new Sim(() => this.simRandom());
  readonly cats = new LivingCats(() => this.catRandom());
  state!: GameState;
  steps = 0;

  constructor() { this.reset('petA'); }

  reset(stop: ReplayStop): void {
    setSceneHeight(MIN_SCENE_H);
    this.sim.reset();
    this.cats.reset();
    this.simRandom = seeded(52);
    this.catRandom = seeded(CAT_SEED);
    this.state = deserialize(source, 0);
    if (!adoptCat(this.state, 'siamese')) throw new Error('Synthetic adoption could not be reproduced.');
    openShop(this.state);
    this.steps = 0;
    while (this.steps < REPLAY_STOPS[stop]) this.step();
    const mina = this.mina;
    if (!mina || mina.appearanceId !== 0 || mina.seat !== 0 || mina.phase !== 'sitting') {
      throw new Error(`Synthetic ${stop} replay no longer reaches seated Mina.`);
    }
    if (stop !== 'idle' && this.cat?.interaction?.phase !== (stop.startsWith('nuzzle') ? 'nuzzle' : 'response')) {
      throw new Error(`Synthetic ${stop} replay no longer reaches the natural cat response.`);
    }
  }

  step(): void {
    this.sim.update(this.state, STEP_SECONDS);
    this.cats.update(this.state, STEP_SECONDS, this.sim);
    this.steps++;
  }

  get mina() { return this.sim.customers.find(customer => customer.id === 1 && customer.appearanceId === 0); }
  get cat() { return this.cats.actors.get('siamese'); }
  get seconds() { return this.steps * STEP_SECONDS; }
  get petFrame(): 0 | 1 | null {
    return this.cat?.interaction?.phase === 'response'
      ? Math.floor(this.cat.interaction.elapsed / 0.65) % 2 as 0 | 1 : null;
  }
}
