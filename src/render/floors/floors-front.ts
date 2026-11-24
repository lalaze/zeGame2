// The café's front, lettered by the game: its name on a plaque over the awning with a tag saying
// whether it is open, a cup on the shopfront's hanging sign, and today's menu on a board by the step.
// Drawn in the paper look of the page (src/ui/floors-ui.css), over the painted building.
import Phaser from 'phaser';
import { itemPrice, menuItems } from '../../game/economy';
import type { MenuItemDef } from '../../game/data';
import { formatTransactionMoney } from '../../game/format';
import type { GameState } from '../../game/state';
import { t } from '../../i18n';
import { FX, FX_ITEMS, itemFrame } from './floors-fx';
import { BOARD, DOOR, SHOP_SIGN, type Building } from './floors-layout';

const FONT = 'ui-rounded, "PingFang SC", system-ui, sans-serif';
const INK = 0x7a5a44, PAPER = 0xfbf3e4, SAGE = 0x6c8c68, SLATE = 0x4d4a44, WOOD = 0xb8804f, WOOD_DARK = 0x6a452c;
const text = (size: number, color: string) => ({ fontFamily: FONT, fontStyle: 'bold', fontSize: `${size}px`, color });
/** The plaque's lettering, and how wide it may get before it is set smaller. */
const NAME = { size: 54, max: 820, height: 92 } as const;
/** How many dishes the board shows at a time, and for how long. */
const ROWS = 2, PAGE_SECONDS = 5;

/** The dishes on the board at a moment, the menu's pages taking turns. */
export function boardRows<T>(menu: readonly T[], seconds: number): T[] {
  const pages = Math.max(1, Math.ceil(menu.length / ROWS));
  const page = Math.floor(Math.max(0, seconds) / PAGE_SECONDS) % pages;
  return menu.slice(page * ROWS, page * ROWS + ROWS);
}

/** What a board writes as a dish's price: the rounded one the shop charges, without the ledger's "≈". */
export const boardPrice = (state: GameState, item: MenuItemDef): string =>
  formatTransactionMoney(item.id.startsWith('sig:') ? item.basePrice : itemPrice(item, state.items[item.id as keyof typeof state.items])).replace(/^≈/, '');

export class FloorsFront {
  private plaque: Phaser.GameObjects.Container;
  private board: Phaser.GameObjects.Container;
  private cup: Phaser.GameObjects.Image | null = null;
  private signature = '';
  private boardSignature = '';
  private clock = 0;
  private shopSign = { x: 0, y: 0 };

  /** `depth`: just in front of the frame's awning and beams, and what stands on the street at a height. */
  constructor(private scene: Phaser.Scene, private depth: { frame: number; street: (y: number) => number; wall: number }) {
    this.plaque = scene.add.container(0, 0).setDepth(depth.frame + .5);
    this.board = scene.add.container(0, 0);
  }

  layout(b: Building): void {
    const ground = b.offsets.ground ?? 0;
    this.plaque.setPosition(DOOR.x, ground - 6);
    this.board.setPosition(BOARD.x, b.street + BOARD.y).setDepth(this.depth.street(b.street + BOARD.y));
    this.shopSign = { x: SHOP_SIGN.x, y: ground + SHOP_SIGN.y };
  }

  /** `walls`: how far the front walls have faded in. */
  update(dt: number, state: GameState, walls: number): void {
    this.clock += dt;
    this.letter(state.profile?.cafeName ?? t('app.title'), state.phase === 'open');
    this.chalk(state);
    if (!this.cup && this.scene.textures.exists(FX) && this.scene.textures.get(FX).has('cup')) this.cup = this.scene.add.image(0, 0, FX, 'cup').setDepth(this.depth.wall + .5);
    this.cup?.setPosition(this.shopSign.x, this.shopSign.y).setScale(SHOP_SIGN.cup / 56).setAlpha(walls).setVisible(walls > 0);
  }

  private letter(name: string, open: boolean): void {
    const tag = t(open ? 'floors.sign.open' : 'floors.sign.closed'), signature = `${name}|${tag}|${open}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.plaque.removeAll(true);
    const label = this.scene.add.text(0, 0, name, text(NAME.size, '#4f3b2f')).setOrigin(.5);
    if (label.width > NAME.max) label.setScale(NAME.max / label.width);
    const w = Math.max(260, label.displayWidth + 88), h = NAME.height;
    const paper = this.scene.add.graphics();
    paper.fillStyle(0x4f3b2f, .28).fillRoundedRect(-w / 2, -h / 2 + 9, w, h, 26);
    paper.fillStyle(PAPER, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 26).lineStyle(7, INK, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
    paper.lineStyle(3, INK, .35).strokeRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 16);
    // The tag hangs under the plaque on two strings.
    const word = this.scene.add.text(0, h / 2 + 46, tag, text(38, open ? '#fffaf0' : '#4f3b2f')).setOrigin(.5);
    const tw = word.width + 48, th = 60, ty = h / 2 + 16;
    const hung = this.scene.add.graphics();
    hung.lineStyle(5, INK, 1).lineBetween(-tw / 4, h / 2 - 2, -tw / 4, ty).lineBetween(tw / 4, h / 2 - 2, tw / 4, ty);
    hung.fillStyle(open ? SAGE : PAPER, 1).fillRoundedRect(-tw / 2, ty, tw, th, 18).lineStyle(6, open ? 0x526f4f : INK, 1).strokeRoundedRect(-tw / 2, ty, tw, th, 18);
    this.plaque.add([hung, word, paper, label]);
  }

  private chalk(state: GameState): void {
    if (!this.scene.textures.exists(FX_ITEMS)) { this.board.setVisible(false); return; }
    const menu = menuItems(state), rows = boardRows(menu, this.clock).map(item => ({ frame: itemFrame(item.id), price: boardPrice(state, item) }));
    const title = t('board.today'), signature = JSON.stringify([title, rows]);
    if (signature === this.boardSignature) return;
    this.boardSignature = signature;
    this.board.removeAll(true);
    const { w, h } = BOARD, top = -h, frame = 14, legs = 34;
    const wood = this.scene.add.graphics();
    wood.fillStyle(0x4f3b2f, .22).fillEllipse(0, -4, w + 30, 30);
    // Two splayed legs, then the framed slate.
    wood.lineStyle(20, WOOD_DARK, 1).lineBetween(-w / 2 + 22, -legs - 8, -w / 2 + 8, -6).lineBetween(w / 2 - 22, -legs - 8, w / 2 - 8, -6);
    wood.lineStyle(12, WOOD, 1).lineBetween(-w / 2 + 22, -legs - 8, -w / 2 + 8, -7).lineBetween(w / 2 - 22, -legs - 8, w / 2 - 8, -7);
    wood.fillStyle(WOOD, 1).fillRoundedRect(-w / 2, top, w, h - legs, 16).lineStyle(6, WOOD_DARK, 1).strokeRoundedRect(-w / 2, top, w, h - legs, 16);
    wood.fillStyle(SLATE, 1).fillRoundedRect(-w / 2 + frame, top + frame, w - 2 * frame, h - legs - 2 * frame, 9);
    const inside = w - 2 * frame - 18;
    const head = this.scene.add.text(0, top + frame + 8, title, text(36, '#f3e2b3')).setOrigin(.5, 0);
    if (head.width > inside) head.setScale(inside / head.width);
    const parts: Phaser.GameObjects.GameObject[] = [wood, head];
    const rowTop = top + frame + 56, rowHeight = (h - legs - frame - 56 - frame) / ROWS;
    rows.forEach((row, i) => {
      const y = rowTop + rowHeight * (i + .5);
      const has = this.scene.textures.get(FX_ITEMS).has(row.frame);
      const price = this.scene.add.text(has ? inside / 2 : 0, y, row.price, text(38, '#fdf6e3')).setOrigin(has ? 1 : .5, .5);
      const room = inside - (has ? 66 : 0);
      if (price.width > room) price.setScale(room / price.width);
      parts.push(price);
      if (!has) return;
      const icon = this.scene.add.image(-inside / 2 + 30, y, FX_ITEMS, row.frame);
      parts.push(icon.setScale(62 / Math.max(icon.width, icon.height)));
    });
    this.board.add(parts).setVisible(rows.length > 0);
  }
}
