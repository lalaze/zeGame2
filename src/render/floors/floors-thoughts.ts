// What guests and staff think, in words: the pixel view's thoughts (render/thoughts.ts) and its pacing
// (render/thought-bubbles.ts), in a paper bubble over whoever thinks it here. They are the only place
// a guest's taste, the day's weather and the answers to the player show.
import Phaser from 'phaser';
import type { Sim } from '../../game/sim';
import type { GameState } from '../../game/state';
import { getLocale, t } from '../../i18n';
import type { CafeView } from '../cafe-view';
import { ThoughtBubbles, URGENT_THOUGHT } from '../thought-bubbles';
import { thoughtCandidates, type ThoughtCandidate } from '../thoughts';
import { WORLD_W } from './floors-layout';

/** A head in the building: its top, in world pixels, and whether its owner has got where the Sim has them. */
export interface ThinkingHead { x: number; y: number; arrived: boolean }
/** The part of the screen thoughts show in, clear of the page's bars: shares of its height. */
const SCREEN = { top: .16, bottom: .8 } as const;
const DEPTH = 100001.5;
const FONT = { size: 46, wrap: 470 } as const;

/**
 * The thoughts that can show: of people in `view` (world pixels) who are where the thought says they
 * are. A guest the Sim has at a table may still be on the stairs here, and a moment's guest keeps quiet.
 */
export function showableThoughts(candidates: readonly ThoughtCandidate[], head: (id: string) => ThinkingHead | null,
  view: { x: number; y: number; w: number; h: number }, quiet?: number): ThoughtCandidate[] {
  return candidates.flatMap(candidate => {
    if (quiet !== undefined && candidate.id === `customer:${quiet}` && candidate.priority < URGENT_THOUGHT) return [];
    const at = head(candidate.id);
    if (!at || (/^(table|taste|memory):/.test(candidate.context) && !at.arrived)) return [];
    const x = (at.x - view.x) / view.w, y = (at.y - view.y) / view.h;
    return x > .02 && x < .98 && y > SCREEN.top && y < SCREEN.bottom ? [{ ...candidate, x: at.x, y: at.y }] : [];
  });
}

export class FloorsThoughts {
  /** Who is thinking aloud now (`customer:7`, `barista:0`): the picture over their head makes way. */
  readonly speaking = new Set<string>();
  private pacing = new ThoughtBubbles();
  private shown = new Map<string, { key: string; box: Phaser.GameObjects.Container; w: number; h: number; tail: Phaser.GameObjects.Graphics }>();

  constructor(private scene: Phaser.Scene, private sim: Sim, private view: CafeView, private head: (id: string) => ThinkingHead | null) {}

  update(dt: number, state: GameState, enabled: boolean): void {
    const rect = this.scene.cameras.main.worldView, view = { x: rect.x, y: rect.y, w: rect.width || 1, h: rect.height || 1 };
    let candidates: ThoughtCandidate[] = thoughtCandidates(this.sim, state);
    // A guest's answer to the player speaks at once.
    const reply = this.view.momentReaction;
    if (reply && this.sim.customers.some(c => c.id === reply.customerId)) {
      const id = `customer:${reply.customerId}`;
      candidates = [...candidates.filter(c => c.id !== id), { id, key: reply.key, x: 0, y: 0, priority: URGENT_THOUGHT, context: reply.context }];
    }
    const open = showableThoughts(candidates, this.head, view, this.view.moment?.customerId);
    const selected = this.pacing.update(dt, `building:${getLocale()}`, enabled && state.phase === 'open' && !document.hidden, open);
    this.speaking.clear();
    for (const thought of selected) {
      this.speaking.add(thought.id);
      this.say(thought);
    }
    for (const [id, bubble] of this.shown) {
      if (this.speaking.has(id)) continue;
      this.shown.delete(id);
      this.scene.tweens.add({ targets: bubble.box, alpha: 0, duration: 160, onComplete: () => bubble.box.destroy() });
    }
  }

  private say(thought: ThoughtCandidate): void {
    let bubble = this.shown.get(thought.id);
    if (bubble && bubble.key !== thought.key) { bubble.box.destroy(); this.shown.delete(thought.id); bubble = undefined; }
    if (!bubble) {
      const words = this.scene.add.text(0, 0, t(thought.key), {
        fontFamily: 'ui-rounded, "PingFang SC", system-ui, sans-serif', fontStyle: 'bold', fontSize: `${FONT.size}px`, color: '#4f3b2f',
        align: 'center', wordWrap: { width: FONT.wrap, useAdvancedWrap: true },
      }).setOrigin(.5);
      const w = words.width + 64, h = words.height + 40;
      const paper = this.scene.add.graphics();
      paper.fillStyle(0x4f3b2f, .24).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 34);
      paper.fillStyle(0xfffaf0, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 34).lineStyle(6, 0x7a5a44, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 34);
      const tail = this.scene.add.graphics();
      bubble = { key: thought.key, w, h, tail, box: this.scene.add.container(0, 0, [tail, paper, words]).setDepth(DEPTH).setAlpha(0) };
      this.scene.tweens.add({ targets: bubble.box, alpha: 1, duration: 160 });
      this.shown.set(thought.id, bubble);
    }
    // The bubble keeps inside the building; its dots always lead to the head.
    const { box, w, h, tail } = bubble;
    const x = Phaser.Math.Clamp(thought.x, 96 + w / 2, WORLD_W - 96 - w / 2), y = thought.y - 44 - h / 2;
    box.setPosition(x, y);
    tail.clear();
    const lean = Phaser.Math.Clamp(thought.x - x, -w / 2 + 40, w / 2 - 40);
    for (const [share, radius] of [[.28, 13], [.72, 9]] as const) {
      tail.fillStyle(0xfffaf0, 1).lineStyle(5, 0x7a5a44, 1);
      const tx = Phaser.Math.Linear(lean, thought.x - x, share), ty = h / 2 + 4 + 36 * share;
      tail.fillCircle(tx, ty, radius).strokeCircle(tx, ty, radius);
    }
  }
}
