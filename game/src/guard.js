// Warden AI: patrol, stare, chase, investigate a noise, then return to patrol.
// Suspicion is a meter, not a switch: a warden who half-sees you stops and
// stares, giving you a chance to break line of sight and cool the meter down.
import { GUARD, STEP } from './config.js';
import { angleDiff, angleTo, visionCheck } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_STARE = 'stare';
export const GUARD_CHASE = 'chase';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_RETURN = 'return';

export function makeGuard(def, tile) {
  const x = (def.spawn[0] + 0.5) * tile;
  const y = (def.spawn[1] + 0.5) * tile;
  return {
    x,
    y,
    angle: -Math.PI / 2,
    state: GUARD_PATROL,
    waypointIndex: 1,
    waypoints: def.waypoints,
    path: [],
    pathIndex: 0,
    suspicion: 0,
    stareTimer: 0,
    lostTimer: 0,
    investigateX: 0,
    investigateY: 0,
    lookTimer: 0,
    lookAngle: 0,
    lastSeenX: 0,
    lastSeenY: 0,
    repathTimer: 0,
    stepPhase: Math.random() * Math.PI * 2,
    heard: false,
  };
}

function moveAlongPath(guard, speed, dt, grid, tile) {
  if (guard.pathIndex >= guard.path.length) return true;
  const target = guard.path[guard.pathIndex];
  const tx = (target[0] + 0.5) * tile;
  const ty = (target[1] + 0.5) * tile;
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 3) {
    guard.pathIndex += 1;
    return guard.pathIndex >= guard.path.length;
  }
  const want = Math.atan2(dy, dx);
  guard.angle = turnToward(guard.angle, want, dt * 6);
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.stepPhase += (step / 14) * Math.PI;
  return false;
}

export function turnToward(angle, target, maxStep) {
  const d = angleDiff(target, angle);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

function setPath(guard, grid, tx, ty) {
  guard.path = grid.findPath(guard.x, guard.y, tx, ty);
  guard.pathIndex = 0;
}

/** One AI tick. Returns events: { spotted, lost, caught } for sound + HUD. */
export function updateGuard(guard, dt, world) {
  const { grid, player, tile } = world;
  const events = { spotted: false, lost: false, caught: false };
  const hidden = grid.isBushAt(player.x, player.y);
  const lit = grid.isLampAt(player.x, player.y);
  const check = visionCheck(grid, guard, player, hidden, lit);

  if (check.seen) {
    const rate = hidden
      ? GUARD.suspicionRateHidden
      : player.x !== undefined && Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.sightRange * 0.45
        ? GUARD.suspicionRateNear
        : GUARD.suspicionRateFar;
    const before = guard.suspicion;
    guard.suspicion = Math.min(100, guard.suspicion + rate * check.strength * dt);
    guard.lostTimer = 0;
    if (before < GUARD.stareAt && guard.suspicion >= GUARD.stareAt && guard.state === GUARD_PATROL) {
      events.spotted = true;
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
  }

  switch (guard.state) {
    case GUARD_PATROL: {
      if (guard.suspicion >= GUARD.chaseAt) {
        guard.state = GUARD_CHASE;
        events.spotted = true;
        break;
      }
      if (guard.suspicion >= GUARD.stareAt) {
        guard.state = GUARD_STARE;
        guard.stareTimer = 0;
        break;
      }
      if (guard.heard) {
        guard.heard = false;
        guard.state = GUARD_INVESTIGATE;
        guard.investigateX = world.noiseX;
        guard.investigateY = world.noiseY;
        setPath(guard, grid, world.noiseX, world.noiseY);
        break;
      }
      if (guard.pathIndex >= guard.path.length) {
        const wp = guard.waypoints[guard.waypointIndex % guard.waypoints.length];
        guard.waypointIndex += 1;
        setPath(guard, grid, (wp[0] + 0.5) * tile, (wp[1] + 0.5) * tile);
      }
      if (moveAlongPath(guard, GUARD.patrolSpeed, dt, grid, tile)) {
        // Reached a waypoint: pause and scan the room before moving on.
        guard.lookTimer = 1.1;
        guard.lookAngle = guard.angle + (guard.waypointIndex % 2 === 0 ? 1.1 : -1.1);
      }
      if (guard.lookTimer > 0) {
        guard.lookTimer -= dt;
        guard.angle = turnToward(guard.angle, guard.lookAngle, dt * 1.6);
      }
      break;
    }
    case GUARD_STARE: {
      guard.stareTimer += dt;
      guard.angle = turnToward(guard.angle, angleTo(guard.x, guard.y, player.x, player.y), dt * 5);
      if (guard.suspicion >= GUARD.chaseAt) {
        guard.state = GUARD_CHASE;
        events.spotted = true;
      } else if (guard.suspicion < GUARD.stareAt * 0.5 || guard.stareTimer > 2.4) {
        guard.state = GUARD_PATROL;
        guard.path = [];
        guard.pathIndex = 0;
      }
      break;
    }
    case GUARD_CHASE: {
      // A chasing warden runs a real path to where you were last seen, so a
      // wall never pins it in place — and a corner never saves you either.
      if (check.seen) {
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
        guard.lostTimer = 0;
      }
      guard.repathTimer -= dt;
      if (guard.repathTimer <= 0 || guard.pathIndex >= guard.path.length) {
        guard.repathTimer = 0.4;
        setPath(guard, grid, guard.lastSeenX, guard.lastSeenY);
      }
      if (guard.path.length > 0) {
        moveAlongPath(guard, GUARD.chaseSpeed, dt, grid, tile);
      } else {
        // Already on the target tile: close in directly.
        const dx = player.x - guard.x;
        const dy = player.y - guard.y;
        const d = Math.hypot(dx, dy) || 1;
        guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), dt * 7);
        guard.x += (dx / d) * GUARD.chaseSpeed * dt;
        guard.y += (dy / d) * GUARD.chaseSpeed * dt;
        grid.pushOutOfSolid(guard, GUARD.radius);
      }
      guard.stepPhase += (GUARD.chaseSpeed * dt / 14) * Math.PI;
      if (!check.seen) {
        guard.lostTimer += dt;
        if (guard.lostTimer >= GUARD.giveUpAfter) {
          guard.state = GUARD_RETURN;
          events.lost = true;
          setPath(guard, grid, (guard.waypoints[0][0] + 0.5) * tile, (guard.waypoints[0][1] + 0.5) * tile);
        }
      }
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchRadius) {
        events.caught = true;
      }
      break;
    }
    case GUARD_INVESTIGATE: {
      if (guard.suspicion >= GUARD.chaseAt) {
        guard.state = GUARD_CHASE;
        events.spotted = true;
        break;
      }
      if (moveAlongPath(guard, GUARD.investigateSpeed, dt, grid, tile)) {
        guard.lookTimer = 1.6;
        guard.lookAngle = guard.angle + Math.PI * 0.75;
        guard.state = GUARD_RETURN;
        guard.path = [];
        guard.pathIndex = 0;
      }
      break;
    }
    case GUARD_RETURN: {
      if (guard.suspicion >= GUARD.chaseAt) {
        guard.state = GUARD_CHASE;
        break;
      }
      if (guard.lookTimer > 0) {
        guard.lookTimer -= dt;
        guard.angle = turnToward(guard.angle, guard.lookAngle, dt * 1.6);
        break;
      }
      if (guard.pathIndex >= guard.path.length) {
        const wp = guard.waypoints[0];
        setPath(guard, grid, (wp[0] + 0.5) * tile, (wp[1] + 0.5) * tile);
        if (guard.path.length === 0) {
          guard.state = GUARD_PATROL;
          guard.waypointIndex = 1;
        }
      } else if (moveAlongPath(guard, GUARD.patrolSpeed, dt, grid, tile)) {
        guard.state = GUARD_PATROL;
        guard.waypointIndex = 1;
        guard.path = [];
        guard.pathIndex = 0;
      }
      break;
    }
    default:
      break;
  }
  return events;
}

export { STEP };
