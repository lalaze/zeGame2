/** Pure, room-local walking geometry. Coordinates describe a walker's feet. */
export interface FloorPoint { x: number; y: number }
export interface FloorObstacle { x: number; y: number; w: number; h: number }

export interface FloorRouteOptions {
  /** Allowed walker-center area. Inset it from the walls when body clearance matters. */
  bounds?: FloorObstacle;
  /** Space left between a walker's feet and an obstacle. Defaults to 3 logical pixels. */
  clearance?: number;
  /**
   * Explicit short steps between a chair and its clear apron. Only these legs may
   * cross an obstacle containing the corresponding endpoint; all other obstacles
   * still block them. This avoids treating a seated guest as a trapped walker.
   */
  startApproach?: FloorPoint;
  endApproach?: FloorPoint;
}

const EPSILON = 1e-7;
const finitePoint = (p: FloorPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
const finiteRect = (r: FloorObstacle) => finitePoint(r) && Number.isFinite(r.w) && Number.isFinite(r.h);
const samePoint = (a: FloorPoint, b: FloorPoint) => Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
const contains = (r: FloorObstacle, p: FloorPoint) =>
  p.x >= r.x - EPSILON && p.x <= r.x + r.w + EPSILON && p.y >= r.y - EPSILON && p.y <= r.y + r.h + EPSILON;
const interior = (r: FloorObstacle, p: FloorPoint) =>
  p.x > r.x + EPSILON && p.x < r.x + r.w - EPSILON && p.y > r.y + EPSILON && p.y < r.y + r.h - EPSILON;

/** A boundary tangent is clear; crossing any positive portion of the interior is not. */
export function segmentCrossesObstacle(a: FloorPoint, b: FloorPoint, r: FloorObstacle): boolean {
  if (r.w <= 0 || r.h <= 0) return false;
  let enter = 0, leave = 1;
  for (const [start, delta, low, high] of [
    [a.x, b.x - a.x, r.x + EPSILON, r.x + r.w - EPSILON],
    [a.y, b.y - a.y, r.y + EPSILON, r.y + r.h - EPSILON],
  ]) {
    if (Math.abs(delta) < EPSILON) {
      if (start < low || start > high) return false;
      continue;
    }
    const t1 = (low - start) / delta, t2 = (high - start) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return false;
  }
  return enter <= leave;
}

/**
 * Find a shortest collision-free polyline in one room using a rectangle-corner
 * visibility graph. Returns points AFTER `from`, including `to`, or null when no
 * route exists. It never falls back to walking through furniture or across walls.
 *
 * Use separate calls between shared doorway waypoints for multi-room journeys.
 * Obstacles and bounds use the same coordinates as the supplied endpoints.
 */
export function routeFloorSegment(
  from: FloorPoint,
  to: FloorPoint,
  obstacles: readonly FloorObstacle[],
  options: FloorRouteOptions = {},
): FloorPoint[] | null {
  const clearance = options.clearance ?? 3;
  const bounds = options.bounds;
  if (!finitePoint(from) || !finitePoint(to) || !Number.isFinite(clearance) || clearance < 0 ||
      (bounds && (!finiteRect(bounds) || bounds.w <= 0 || bounds.h <= 0)) ||
      obstacles.some((r) => !finiteRect(r))) return null;
  const inBounds = (p: FloorPoint) => !bounds || contains(bounds, p);
  if (!inBounds(from) || !inBounds(to)) return null;
  if (samePoint(from, to)) return [];
  const boxes = obstacles.filter((r) => r.w > 0 && r.h > 0).map((r) => ({
    x: r.x - clearance, y: r.y - clearance, w: r.w + clearance * 2, h: r.h + clearance * 2,
  }));
  const start = options.startApproach ?? from;
  const end = options.endApproach ?? to;
  if (!finitePoint(start) || !finitePoint(end) || !inBounds(start) || !inBounds(end)) return null;
  if (boxes.some((r) => interior(r, start) || interior(r, end))) return null;
  // A chair portal exempts only the obstacle(s) that actually contain the chair.
  if (boxes.some((r) => segmentCrossesObstacle(from, start, r) && !contains(r, from)) ||
      boxes.some((r) => segmentCrossesObstacle(end, to, r) && !contains(r, to))) return null;

  const clear = (a: FloorPoint, b: FloorPoint) => !boxes.some((r) => segmentCrossesObstacle(a, b, r));
  let middle: FloorPoint[];
  if (samePoint(start, end)) middle = [];
  else if (clear(start, end)) middle = [end];
  else {
    // Corners inside another obstacle are not on the free-space boundary.
    const vertices: FloorPoint[] = [start, end];
    for (const r of boxes) {
      for (const p of [
        { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
        { x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y + r.h },
      ]) {
        if (inBounds(p) && !boxes.some((other) => interior(other, p)) && !vertices.some((v) => samePoint(v, p))) vertices.push(p);
      }
    }
    const distance = vertices.map(() => Infinity);
    const previous = vertices.map(() => -1);
    const visited = vertices.map(() => false);
    distance[0] = 0;
    for (;;) {
      let current = -1;
      for (let i = 0; i < vertices.length; i++) {
        if (!visited[i] && Number.isFinite(distance[i]) &&
            (current === -1 || distance[i] < distance[current])) current = i;
      }
      if (current === -1) return null;
      if (current === 1) break;
      visited[current] = true;
      for (let next = 0; next < vertices.length; next++) {
        if (visited[next] || next === current) continue;
        const a = vertices[current], b = vertices[next];
        const candidate = distance[current] + Math.hypot(b.x - a.x, b.y - a.y);
        if (candidate + EPSILON >= distance[next] || !clear(a, b)) continue;
        distance[next] = candidate;
        previous[next] = current;
      }
    }
    middle = [];
    for (let i = 1; i !== 0; i = previous[i]) middle.push(vertices[i]);
    middle.reverse();
  }
  const result: FloorPoint[] = [];
  let previous = from;
  for (const p of [start, ...middle, end, to]) {
    if (samePoint(previous, p)) continue;
    result.push({ x: p.x, y: p.y });
    previous = p;
  }
  return result;
}
