// Staged screenshot scenes. Each one plays the real rules forward from a
// fresh world for a fixed time, steered by a small autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same
// frame. ?shot=cover|play|alarm|win (anything else is cover).
import { SCREEN_LEVEL_DONE, SCREEN_PLAY, SCREEN_TITLE, TILE } from './config.js';
import { visionCheck } from './vision.js';

const SAMPLE = 1 / 60;

/** Steer the player toward a tile; wait (stand still) when a warden can see them. */
function steer(world, tx, ty) {
  const p = world.player;
  const dx = (tx + 0.5) * TILE - p.x;
  const dy = (ty + 0.5) * TILE - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return { dx: 0, dy: 0, sneak: false, arrived: true };
  for (const guard of world.guards) {
    const check = visionCheck(world.grid, guard, p, p.inBush, p.inLamp);
    if (check.seen && guard.suspicion > 25) return { dx: 0, dy: 0, sneak: true, arrived: false };
  }
  return { dx: dx / dist, dy: dy / dist, sneak: dist < 90, arrived: false };
}

function runWaypoints(world, waypoints, maxSeconds, sneakAll) {
  let wi = 0;
  for (let t = 0; t < maxSeconds / SAMPLE; t += 1) {
    if (world.finished || wi >= waypoints.length) break;
    const [tx, ty] = waypoints[wi];
    const move = steer(world, tx, ty);
    if (sneakAll) move.sneak = true;
    world.stepFixed(move);
    if (move.arrived) wi += 1;
  }
  return wi >= waypoints.length;
}

function idle(world, seconds) {
  for (let t = 0; t < seconds / SAMPLE; t += 1) {
    if (world.finished) break;
    world.stepFixed({ dx: 0, dy: 0, sneak: false });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Cover: title over a live floor. Play: mid-floor, sneaking toward the exit.
 * Alarm: caught in a cone, the meter nearly full. Win: standing on the exit.
 */
export function stageShot(name, world) {
  world.reset(world.levelDef, world.levelIndex, 7);
  if (name === 'play') {
    runWaypoints(world, [[2, 6], [8, 6], [12, 6], [12, 8]], 26, false);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'alarm') {
    // Walk into the middle warden's patrol until a warden is properly alarmed,
    // then freeze the frame at the height of the chase — not after the catch.
    let wi = 0;
    const waypoints = [[5, 12], [12, 12], [14, 13]];
    for (let t = 0; t < 20 / SAMPLE; t += 1) {
      if (world.finished || wi >= waypoints.length) break;
      if (world.guards.some((g) => g.suspicion >= 65)) break;
      const [tx, ty] = waypoints[wi];
      const move = steer(world, tx, ty);
      world.stepFixed(move);
      if (move.arrived) wi += 1;
    }
    // Half a second of the chase for the cone and the "!" to read clearly.
    for (let t = 0; t < 0.5 / SAMPLE; t += 1) {
      if (world.finished) break;
      world.stepFixed({ dx: 0, dy: 0, sneak: false });
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    const reached = runWaypoints(world, [[2, 6], [8, 6], [12, 6], [12, 8], [12, 9]], 40, true);
    if (!reached || !world.won) {
      // Fall back: a patient sneak straight down the open corridor.
      world.reset(world.levelDef, world.levelIndex, 7);
      runWaypoints(world, [[2, 12], [8, 12], [12, 12], [12, 9]], 60, true);
    }
    return { screen: world.won ? SCREEN_PLAY : SCREEN_TITLE };
  }
  idle(world, 6);
  return { screen: SCREEN_TITLE };
}

export { SCREEN_LEVEL_DONE };
