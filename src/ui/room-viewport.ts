import { getLocale } from '../i18n';

export const MAX_ROOM_ZOOM = 3;
/** Leave room for the compact phone HUD while making people large enough to tap. */
export function mobileRoomZoom(width: number, height: number, roomHeight: number): number {
  if (width > 860 || width >= height || roomHeight <= 0) return 1;
  return Math.max(1, Math.min(1.8, (height - 176) / roomHeight));
}
export function clampRoomPan(value: number, room: number, viewport: number, zoom: number): number {
  const limit = Math.max(0, (room * zoom - viewport) / 2);
  return Math.max(-limit, Math.min(limit, value));
}

interface RoomOverview {
  isActive(): boolean;
  toggle(): void;
}

/** Magnify the canvas only. Input continues mapping its DOM bounds to buffer coordinates. */
export class RoomViewport {
  private zoom = 1;
  private x = 0;
  private y = 0;
  private points = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  private gestureContext: string | null = null;
  private controls = document.createElement('div');
  private resetButton = document.createElement('button');
  private plus = document.createElement('button');
  private minus = document.createElement('button');
  private abort = new AbortController();
  private previousTouchAction: string;
  private presentation = '';
  private wasOverview = false;
  constructor(private canvas: HTMLCanvasElement, private stage: HTMLElement,
    private enabled: () => boolean, private context: () => string, private overview?: RoomOverview,
    private defaultZoom: () => number = () => 1) {
    this.previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    this.controls.className = 'room-zoom-controls';
    this.controls.setAttribute('role', 'group');
    this.controls.id = 'room-zoom-controls';
    for (const [button, id] of [[this.minus, 'room-zoom-out'], [this.resetButton, 'room-zoom-reset'], [this.plus, 'room-zoom-in']] as const) {
      button.type = 'button'; button.id = id; button.className = 'pixel-btn';
      this.controls.append(button);
    }
    this.stage.append(this.controls);
    const signal = this.abort.signal;
    this.plus.addEventListener('click', () => { if (enabled() && !this.overview?.isActive()) this.setZoom(this.zoom + .5); }, { signal });
    this.minus.addEventListener('click', () => { if (enabled() && !this.overview?.isActive()) this.setZoom(this.zoom - .5); }, { signal });
    this.resetButton.addEventListener('click', () => {
      if (!this.enabled()) return;
      this.overview?.toggle();
      this.reset();
    }, { signal });
    window.addEventListener('pointerdown', this.down, { capture: true, signal });
    window.addEventListener('pointermove', this.move, { capture: true, signal });
    window.addEventListener('pointerup', this.up, { capture: true, signal });
    window.addEventListener('pointercancel', this.cancel, { capture: true, signal });
    window.addEventListener('blur', this.cancel, { signal });
    window.addEventListener('resize', this.onResize, { signal });
    document.addEventListener('visibilitychange', this.cancel, { signal });
    this.reset();
  }
  refresh(): void {
    if (this.wasOverview !== !!this.overview?.isActive()) this.reset();
    if (this.points.size && (!this.enabled() || this.overview?.isActive() || this.gestureContext !== this.context())) this.cancel();
    if (this.presentation !== `${this.enabled()}:${!!this.overview?.isActive()}`) this.apply();
  }
  refreshLabels(): void { this.apply(); }
  reset(): void {
    this.cancel();
    this.wasOverview = !!this.overview?.isActive();
    this.zoom = this.wasOverview ? 1 : Math.max(1, Math.min(MAX_ROOM_ZOOM, this.defaultZoom()));
    this.x = this.y = 0; this.apply();
  }
  private onResize = () => this.reset();
  private cancel = () => { this.points.clear(); this.gestureContext = null; this.dragStart = null; this.dragging = false; };
  private down = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || event.target !== this.canvas || !this.enabled() || this.overview?.isActive()) return;
    if (!this.points.size) { this.gestureContext = this.context(); this.dragStart = { x: event.clientX, y: event.clientY }; this.dragging = false; }
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  private up = (event: PointerEvent) => { this.points.delete(event.pointerId); if (!this.points.size) this.gestureContext = null; };
  private move = (event: PointerEvent) => {
    if (!this.points.has(event.pointerId)) return;
    if (!this.enabled() || this.overview?.isActive() || this.gestureContext !== this.context()) { this.cancel(); return; }
    const before = [...this.points.values()];
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...this.points.values()];
    if (before.length >= 2) {
      this.dragging = true;
      const midpoint = (p: typeof before) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const a = midpoint(before), b = midpoint(after);
      const distance = (p: typeof before) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const oldDistance = distance(before);
      if (oldDistance < 4) return;
      const next = Math.max(1, Math.min(MAX_ROOM_ZOOM, this.zoom * distance(after) / oldDistance));
      const ratio = next / this.zoom;
      const bounds = this.stage.getBoundingClientRect();
      const cx = bounds.left + bounds.width / 2, cy = bounds.top + bounds.height / 2;
      this.x = b.x - cx - (a.x - cx - this.x) * ratio;
      this.y = b.y - cy - (a.y - cy - this.y) * ratio;
      this.zoom = next;
      this.apply();
    } else if (this.zoom > 1) {
      if (!this.dragging && this.dragStart) {
        if (Math.hypot(after[0].x - this.dragStart.x, after[0].y - this.dragStart.y) <= 8) return;
        this.x += after[0].x - this.dragStart.x; this.y += after[0].y - this.dragStart.y; this.dragging = true;
      } else { this.x += after[0].x - before[0].x; this.y += after[0].y - before[0].y; }
      this.apply();
    }
  };
  private setZoom(zoom: number): void {
    this.cancel(); this.zoom = Math.max(1, Math.min(MAX_ROOM_ZOOM, zoom)); this.apply();
  }
  private apply(): void {
    const room = this.canvas.parentElement!;
    this.x = clampRoomPan(this.x, room.clientWidth, this.stage.clientWidth, this.zoom);
    this.y = clampRoomPan(this.y, room.clientHeight, this.stage.clientHeight, this.zoom);
    this.canvas.style.transformOrigin = '50% 50%';
    this.canvas.style.transform = this.zoom === 1 ? '' : 'translate(' + this.x + 'px, ' + this.y + 'px) scale(' + this.zoom + ')';
    this.canvas.dataset.roomZoom = String(this.zoom);
    this.canvas.dataset.roomPan = this.x + ',' + this.y;
    const zh = getLocale() === 'zh';
    const overview = !!this.overview?.isActive(), enabled = this.enabled();
    this.presentation = `${enabled}:${overview}`;
    this.controls.classList.toggle('is-overview', overview);
    this.controls.setAttribute('aria-label', zh ? '房间视图缩放' : 'Room zoom');
    this.minus.textContent = '−'; this.plus.textContent = '+';
    this.minus.setAttribute('aria-label', zh ? '缩小房间' : 'Zoom out');
    this.plus.setAttribute('aria-label', zh ? '放大房间' : 'Zoom in');
    this.resetButton.textContent = zh ? '全景' : 'Fit room';
    this.resetButton.title = zh ? '双指缩放，放大后单指拖动；点击恢复全景' : 'Pinch to zoom, drag to pan; click to fit the room';
    this.resetButton.setAttribute('aria-label', (zh ? '恢复房间全景，当前 ' : 'Fit room, current ') + Math.round(this.zoom * 100) + '%');
    if (this.overview) {
      this.resetButton.textContent = overview ? (zh ? '返回房间' : 'Back to room') : (zh ? '全景' : 'Overview');
      this.resetButton.title = overview ? (zh ? '返回当前房间' : 'Return to the current room') : (zh ? '查看全店地图，点击房间进入' : 'View the whole café; select a room to enter');
      this.resetButton.setAttribute('aria-label', this.resetButton.title);
      this.resetButton.setAttribute('aria-pressed', String(overview));
    }
    this.resetButton.disabled = !enabled;
    this.minus.disabled = !enabled || overview || this.zoom <= 1;
    this.plus.disabled = !enabled || overview || this.zoom >= MAX_ROOM_ZOOM;
  }
  destroy(): void {
    this.abort.abort(); this.cancel(); this.controls.remove();
    this.canvas.style.transform = ''; this.canvas.style.touchAction = this.previousTouchAction;
  }
}
