// Vision: what a warden can see. A target is seen when it lies inside the
// warden's cone and a straight line to it crosses no wall or crate.
import { GUARD } from './config.js';

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the segment (x0,y0)->(x1,y1) crosses no sight-blocking tile. */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (grid.blocksSightAt(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/**
 * How strongly a guard sees the player right now, 0 when unseen.
 * Returns { seen, strength } where strength is 0..1 (near + lit + moving = stronger).
 * `hidden` is true when the player crouches in a bush; `lit` when under a lamp.
 */
export function visionCheck(grid, guard, player, hidden, lit) {
  const range = hidden ? GUARD.hiddenSightRange : GUARD.sightRange;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { seen: false, strength: 0 };
  const facing = angleTo(guard.x, guard.y, guard.x + Math.cos(guard.angle), guard.y + Math.sin(guard.angle));
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toPlayer, facing)) > GUARD.fovHalf) return { seen: false, strength: 0 };
  if (!hasLineOfSight(grid, guard.x, guard.y, player.x, player.y)) return { seen: false, strength: 0 };
  const closeness = 1 - dist / range;
  let strength = 0.35 + 0.65 * closeness;
  if (lit) strength *= 1.35;
  if (player.moving) strength *= 1.15;
  if (player.sneaking) strength *= 0.7;
  return { seen: true, strength: Math.min(1.4, strength) };
}
