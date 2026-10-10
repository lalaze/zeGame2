import type { ThoughtCandidate } from './thoughts';

export interface ThoughtRect { x: number; y: number; w: number; h: number }
export const intersectsThought = (a: ThoughtRect, b: ThoughtRect): boolean =>
  a.x < b.x + b.w + 3 && a.x + a.w + 3 > b.x && a.y < b.y + b.h + 3 && a.y + a.h + 3 > b.y;

export interface ThoughtPlacement extends ThoughtRect {
  speakerId: string;
  /** The current head, retained for tests and to prevent stale screen-space anchors. */
  anchor: { x: number; y: number };
  dots: ThoughtRect[];
}

const touches = (a: ThoughtRect, b: ThoughtRect, gap = 1): boolean =>
  a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
/** Even canvas width keeps an integer head on the exact cloud/text centerline. */
export const thoughtBubbleWidth = (contentWidth: number): number => Math.ceil((contentWidth + 12) / 2) * 2;

const dotAt = (x: number, y: number, size: number): ThoughtRect => ({ x: Math.round(x - size / 2), y: Math.round(y - size / 2), w: size, h: size });

/**
 * One indivisible speaker attachment: a close cloud AND its entire dotted trail.
 * Never lift a cloud away to find space or silently drop its identifying dots.
 * Side trails skirt crowns/progress bars and finish beside the same head.
 */
export function placeThought(c: Pick<ThoughtCandidate, 'id' | 'x' | 'y'>, w: number, h: number, bounds: ThoughtRect, occupied: ThoughtRect[]): ThoughtPlacement | null {
  // Sprites and rects render on whole art pixels; use the same grid for collision
  // checks so fractional walking coordinates cannot flip a tail from side to side.
  c = { ...c, x: Math.round(c.x), y: Math.round(c.y) };
  w = Math.ceil(w / 2) * 2;
  occupied = occupied.map(o => ({ ...o, x: Math.round(o.x), y: Math.round(o.y) }));
  const inside = (r: ThoughtRect) => r.x >= bounds.x + 3 && r.y >= bounds.y + 3 && r.x + r.w <= bounds.x + bounds.w - 3 && r.y + r.h <= bounds.y + bounds.h - 3;
  // Center first. Only a real collision/boundary may move it, by the minimum
  // safe amount; avoid the former automatic twelve-pixel jump to the left.
  // Stable per speaker, so equally safe fallbacks never flip across room center.
  const preferredSide = [...c.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 2 ? 1 : -1;
  const shifts = [0, ...[2, 4, 6, 8, 10, 12].flatMap(n => [n * preferredSide, -n * preferredSide])];
  const tried = new Set<number>();
  for (const shift of shifts) {
    const x = Math.round(Math.max(bounds.x + 3, Math.min(bounds.x + bounds.w - w - 3, c.x - w / 2 + shift)));
    if (tried.has(x)) continue;
    tried.add(x);
    const rect = { x, y: Math.round(c.y - h - 12), w, h };
    // Edge clamping may move the cloud a little; never send it across the room.
    if (Math.abs(x + w / 2 - c.x) > 28 || !inside(rect) || occupied.some(other => touches(rect, other))) continue;
    const trails = [
      [dotAt(c.x, c.y - 9, 4), dotAt(c.x, c.y - 5, 2), dotAt(c.x, c.y - 2, 2)],
      ...[preferredSide, -preferredSide].map(side => [dotAt(c.x + side * 18, c.y - 9, 4), dotAt(c.x + side * 17, c.y - 5, 3), dotAt(c.x + side * 15, c.y - 1, 3), dotAt(c.x + side * 12, c.y + 3, 2)]),
    ];
    for (const dots of trails) {
      // The first dot must visibly emerge from this cloud, rather than a neighbor.
      if (dots[0].x < rect.x + 2 || dots[0].x + dots[0].w > rect.x + rect.w - 2) continue;
      if (dots.some(dot => !inside(dot) || occupied.some(other => touches(dot, other)))) continue;
      return { ...rect, speakerId: c.id, anchor: { x: c.x, y: c.y }, dots };
    }
  }
  return null;
}

/** Renderer-only state: real seconds, no random draws, never part of a save. */
export class ThoughtBubbles {
  private active = new Map<string, { context: string; until: number }>();
  private cooldown = new Map<string, { until: number; context: string }>();
  private now = 0;
  private room = '';
  private next = 0;

  clear(): void { this.active.clear(); this.cooldown.clear(); this.next = this.now + 0.7; }

  update(dt: number, room: string, enabled: boolean, candidates: ThoughtCandidate[]): ThoughtCandidate[] {
    this.now += Math.min(0.25, Math.max(0, dt));
    if (!enabled || room !== this.room) {
      this.clear(); this.room = room;
      return [];
    }
    const live = new Map(candidates.map(c => [c.id, c]));
    for (const [id, a] of this.active) {
      if (!live.has(id) || live.get(id)!.context !== a.context || a.until <= this.now) this.active.delete(id);
    }
    for (const id of this.cooldown.keys()) if (!live.has(id)) this.cooldown.delete(id);
    if (this.active.size < 2 && this.now >= this.next) {
      const c = candidates.filter(c => {
        const previous = this.cooldown.get(c.id);
        // A first taste must still fit into a short visit after a queue/service thought.
        const firstTaste = c.context.startsWith('taste:') && previous && !previous.context.startsWith('taste:');
        return !this.active.has(c.id) && (!previous || previous.until <= this.now || firstTaste);
      })
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0];
      if (c) {
        this.active.set(c.id, { context: c.context, until: this.now + 4.8 });
        this.cooldown.set(c.id, { until: this.now + 19, context: c.context });
        this.next = this.now + 2.4;
      }
    }
    return [...this.active.keys()].map(id => live.get(id)!);
  }
}
