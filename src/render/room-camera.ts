/** Camera over the building's continuous, two-dimensional floor plan. */
export class RoomCamera {
  x = 0;
  y = 0;
  zoom = 1;
  private from = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };
  private elapsed = 0;
  private fromZoom = 1;
  private targetZoom = 1;
  private readonly duration = 0.45;

  get moving(): boolean {
    return this.x !== this.target.x || this.y !== this.target.y || this.zoom !== this.targetZoom;
  }

  moveTo(point: { x: number; y: number }, immediate = false, zoom = 1): void {
    if (point.x === this.target.x && point.y === this.target.y && zoom === this.targetZoom && !immediate) return;
    this.from = { x: this.x, y: this.y };
    this.fromZoom = this.zoom;
    this.targetZoom = zoom;
    this.target = point;
    this.elapsed = 0;
    if (immediate) { this.x = point.x; this.y = point.y; this.zoom = zoom; }
  }

  update(dt: number): void {
    if (!this.moving) return;
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
    const progress = this.elapsed / this.duration;
    const ease = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    this.x = progress === 1 ? this.target.x : this.from.x + (this.target.x - this.from.x) * ease;
    this.y = progress === 1 ? this.target.y : this.from.y + (this.target.y - this.from.y) * ease;
    this.zoom = progress === 1 ? this.targetZoom : this.fromZoom + (this.targetZoom - this.fromZoom) * ease;
  }
}
