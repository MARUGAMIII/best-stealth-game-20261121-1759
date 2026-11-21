// Shared constants for Lamplight: sizes, speeds, detection tuning, screens.
export const TILE = 32;
export const STEP = 1 / 60;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVEL_DONE = 'level-done';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

export const PLAYER = {
  radius: 11,
  walkSpeed: 132,
  sneakSpeed: 68,
  // How loud each gait is: guards hear movement inside this radius.
  walkNoise: 46,
  sneakNoise: 14,
  lureCount: 3,
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 52,
  chaseSpeed: 128,
  investigateSpeed: 84,
  // Vision cone: half-angle and reach in open floor.
  fovHalf: 0.62,
  sightRange: 216,
  // A player crouched in a bush or deep shadow is seen from much closer.
  hiddenSightRange: 96,
  // Suspicion 0..100. Rates per second while the player is seen.
  suspicionRateNear: 95,
  suspicionRateFar: 42,
  suspicionRateHidden: 16,
  suspicionDecay: 26,
  // At this suspicion the guard stops patrolling and stares at the player.
  stareAt: 34,
  // At this suspicion the guard gives chase.
  chaseAt: 100,
  // Seconds of lost sight before a chasing guard gives up.
  giveUpAfter: 3.2,
  // Touching a chasing guard ends the run for this level.
  catchRadius: 24,
};

export const SCORE = {
  relic: 250,
  levelTimeBonus: 120,
  ghostBonus: 200,
};

export const COLORS = {
  floorA: '#20263a',
  floorB: '#1c2133',
  floorLine: '#262d45',
  wall: '#3a4260',
  wallTop: '#4d5678',
  crate: '#6b4f2a',
  crateTop: '#8a6a3c',
  bush: '#1f4d2e',
  bushLeaf: '#2e6b40',
  lampGlow: 'rgba(255, 196, 110, 0.10)',
  coneCalm: 'rgba(255, 214, 130, 0.20)',
  coneWary: 'rgba(255, 170, 60, 0.30)',
  coneAlert: 'rgba(255, 80, 60, 0.34)',
  player: '#e8e4d8',
  playerCloak: '#7a6fb8',
  guard: '#d8b25a',
  guardDark: '#8a6d2f',
  exit: '#58d68d',
  relic: '#ffd75e',
  text: '#e8e4d8',
  dim: '#9aa3c0',
};
