import type { Look } from './state';

export type CustomerOutfit = 'cardigan' | 'stripe' | 'overalls' | 'scarf' | 'jacket' | 'vest' | 'dress' | 'hoodie' | 'sailor' | 'duffle';
export type CustomerAccessory = 'none' | 'glasses' | 'bow' | 'headband' | 'satchel';
export interface CustomerDesign {
  readonly id: number;
  readonly name: string;
  readonly look: Readonly<Look>;
  /** Customer-only silhouettes; the owner's four hairstyle indexes are unchanged. */
  readonly hairstyle: number;
  readonly outfit: CustomerOutfit;
  readonly accessory: CustomerAccessory;
  readonly accent: string;
}

type CastRow = readonly [string, number, number, number, number, number, CustomerOutfit, CustomerAccessory, string];
const rows: readonly CastRow[] = [
  ['晨读常客', 0, 0, 0, 0, 1, 'cardigan', 'glasses', '#d6b66d'],
  ['海盐条纹', 1, 1, 2, 1, 0, 'stripe', 'none', '#ecdfba'],
  ['花店姑娘', 2, 0, 4, 2, 1, 'overalls', 'bow', '#d58e98'],
  ['蜂蜜围巾', 0, 2, 3, 3, 2, 'scarf', 'none', '#e4c873'],
  ['紫藤画家', 3, 4, 5, 4, 0, 'jacket', 'satchel', '#d5ad73'],
  ['草莓裙摆', 0, 1, 6, 5, 1, 'dress', 'headband', '#efe1c2'],
  ['薄荷骑手', 1, 0, 7, 6, 2, 'hoodie', 'none', '#eddbb8'],
  ['奶油书迷', 2, 0, 0, 7, 0, 'vest', 'glasses', '#9e7357'],
  ['枫叶邮差', 0, 3, 4, 0, 1, 'duffle', 'satchel', '#e8c68c'],
  ['蓝莓水手', 3, 0, 6, 1, 0, 'sailor', 'bow', '#e8d9b6'],
  ['苔绿园丁', 1, 1, 3, 2, 1, 'overalls', 'satchel', '#e6d39d'],
  ['杏黄毛衣', 2, 0, 5, 3, 2, 'stripe', 'glasses', '#eee1c0'],
  ['丁香发带', 0, 4, 2, 4, 0, 'dress', 'headband', '#d8b168'],
  ['桃子开衫', 1, 2, 1, 5, 1, 'cardigan', 'bow', '#8caa9a'],
  ['湖绿旅人', 3, 0, 7, 6, 2, 'jacket', 'satchel', '#d6b175'],
  ['燕麦绒帽', 0, 1, 3, 7, 1, 'hoodie', 'glasses', '#bd8663'],
  ['砖红背心', 2, 0, 6, 0, 0, 'vest', 'none', '#eddbb6'],
  ['雨天风衣', 1, 4, 0, 1, 1, 'duffle', 'glasses', '#e5c483'],
  ['青苹果领结', 0, 3, 4, 2, 2, 'sailor', 'bow', '#dfaf66'],
  ['向日葵裙', 3, 0, 1, 3, 1, 'dress', 'headband', '#f0dfb9'],
  ['葡萄连帽衫', 2, 4, 5, 4, 0, 'hoodie', 'none', '#dfbd83'],
  ['玫瑰围巾', 0, 5, 7, 5, 2, 'scarf', 'glasses', '#9e687a'],
  ['松石背带', 1, 0, 6, 6, 1, 'overalls', 'headband', '#e7ca90'],
  ['香草针织', 3, 1, 2, 7, 0, 'stripe', 'satchel', '#ba8c6a'],
  ['肉桂短夹克', 0, 3, 5, 0, 1, 'jacket', 'none', '#ebd4a4'],
  ['雾蓝发辫', 2, 0, 4, 1, 2, 'cardigan', 'bow', '#cea0ac'],
  ['橄榄学者', 1, 1, 7, 2, 1, 'vest', 'glasses', '#e2bd77'],
  ['金盏牛角扣', 0, 2, 0, 3, 0, 'duffle', 'none', '#9c775c'],
  ['紫苏小领衫', 3, 0, 1, 4, 2, 'sailor', 'headband', '#eeddb6'],
  ['蜜桃旅行包', 1, 5, 2, 5, 1, 'scarf', 'satchel', '#ae7159'],
];
export const CUSTOMER_CAST: readonly CustomerDesign[] = Object.freeze(rows.map((r, id) => Object.freeze({
  id, name: r[0], look: Object.freeze({ skin: r[1], hair: r[2], hairStyle: r[3] % 4, shirt: r[4], pants: r[5] }),
  hairstyle: r[3], outfit: r[6], accessory: r[7], accent: r[8],
})));

export interface CustomerCastSnapshot {
  remaining: number[];
  previous: number;
}

/** Saved visual state never changes the random stream used for café economics. */
export function validCustomerCastSnapshot(value: unknown): value is CustomerCastSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as CustomerCastSnapshot;
  return Number.isInteger(s.previous) && s.previous >= -1 && s.previous < CUSTOMER_CAST.length &&
    Array.isArray(s.remaining) && s.remaining.length <= CUSTOMER_CAST.length &&
    s.remaining.every((id) => Number.isInteger(id) && id >= 0 && id < CUSTOMER_CAST.length && id !== s.previous) &&
    new Set(s.remaining).size === s.remaining.length;
}

/** Each cast member visits once per shuffled cycle; this controls appearance only. */
export class CustomerCastCycle {
  private remaining: number[] = [];
  private previous = -1;
  constructor(private readonly random: () => number = Math.random) {}
  snapshot(): CustomerCastSnapshot {
    return { remaining: [...this.remaining], previous: this.previous };
  }
  restore(value: unknown): boolean {
    if (!validCustomerCastSnapshot(value)) return false;
    this.remaining = [...value.remaining];
    this.previous = value.previous;
    return true;
  }
  next(): CustomerDesign {
    if (!this.remaining.length) {
      this.remaining = CUSTOMER_CAST.map(c => c.id);
      for (let i = this.remaining.length - 1; i > 0; i--) {
        const j = Math.min(i, Math.max(0, Math.floor(this.random() * (i + 1))));
        [this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]];
      }
      const last = this.remaining.length - 1;
      if (this.remaining[last] === this.previous) [this.remaining[0], this.remaining[last]] = [this.remaining[last], this.remaining[0]];
    }
    this.previous = this.remaining.pop()!;
    return CUSTOMER_CAST[this.previous];
  }
}
