// Lamplight: entry point. Owns the game loop, the screens, the status line
// and the wiring between input, world, sound and renderer.
import { SCREEN_CAUGHT, SCREEN_LEVEL_DONE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, STEP } from './config.js';
import { LEVELS } from './levels.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '7') || 7;

const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sounds = new SoundBank();

const game = {
  screen: SCREEN_TITLE,
  score: 0,
  lives: 3,
  totalRelics: 0,
  totalSeen: 0,
  muted: false,
  world: new World(LEVELS[0], 0, seed),
};

function setStatus(text) {
  statusEl.textContent = text;
}

function startLevel(index, keepScore) {
  game.world = new World(LEVELS[index], index, seed + index * 101);
  if (!keepScore) {
    game.score = 0;
    game.totalRelics = 0;
    game.totalSeen = 0;
    game.lives = 3;
  }
  game.screen = SCREEN_TITLE;
  setStatus(`Lamplight, floor ${index + 1}: ${LEVELS[index].name}. ${LEVELS[index].intro}`);
}

function advance() {
  if (game.screen === SCREEN_TITLE) {
    game.screen = SCREEN_PLAY;
    sounds.resume();
    setStatus(`Playing floor ${game.world.levelIndex + 1}. Reach the green exit unseen.`);
  } else if (game.screen === SCREEN_LEVEL_DONE) {
    game.score += game.world.score;
    game.totalRelics += game.world.relicsTaken;
    game.totalSeen += game.world.seenCount;
    if (game.world.levelIndex + 1 >= LEVELS.length) {
      game.screen = SCREEN_WIN;
      sounds.win();
      setStatus(`Heist complete. Final score ${game.score}.`);
    } else {
      startLevel(game.world.levelIndex + 1, true);
      game.screen = SCREEN_PLAY;
    }
  } else if (game.screen === SCREEN_CAUGHT) {
    if (game.lives <= 0) {
      startLevel(0, false);
    } else {
      game.world = new World(LEVELS[game.world.levelIndex], game.world.levelIndex, seed + game.world.levelIndex * 101 + Date.now() % 97);
      game.screen = SCREEN_PLAY;
      setStatus(`Floor ${game.world.levelIndex + 1} again. Lives left: ${game.lives}.`);
    }
  } else if (game.screen === SCREEN_WIN || game.screen === SCREEN_OVER) {
    startLevel(0, false);
    game.screen = SCREEN_PLAY;
  }
}

function handleOverlayClick() {
  const click = input.consumeClick();
  if (click) advance();
  if (input.wasPressed('Enter') || input.wasPressed('Space')) advance();
}

function playStep(dt) {
  const world = game.world;
  const move = input.moveVector();
  const before = world.events.length;
  world.step(dt, move);
  // Sounds for what just happened.
  for (let i = before; i < world.events.length; i += 1) {
    const ev = world.events[i];
    if (ev.type === 'spotted') sounds.spotted();
    else if (ev.type === 'relic') sounds.relic();
    else if (ev.type === 'lure') sounds.lure();
    else if (ev.type === 'caught') sounds.caught();
    else if (ev.type === 'exit') sounds.win();
  }
  // Footsteps: the nearest warden's tread, panned by where they are.
  for (const guard of world.guards) {
    const phase = Math.floor(guard.stepPhase / Math.PI);
    if (phase !== guard.lastStepPhase) {
      guard.lastStepPhase = phase;
      const dist = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
      if (dist < 320) {
        sounds.footstep((guard.x - world.player.x) / 320, Math.max(0.15, 1 - dist / 320));
      }
    }
  }
  // A click during play tosses a lure toward the click (within arm's reach).
  const click = input.consumeClick();
  if (click) {
    const target = renderer.toWorld(click.x, click.y);
    const p = world.player;
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    const maxThrow = 240;
    const tx = d > maxThrow ? p.x + ((target.x - p.x) / d) * maxThrow : target.x;
    const ty = d > maxThrow ? p.y + ((target.y - p.y) / d) * maxThrow : target.y;
    if (world.throwLure(tx, ty)) sounds.lure();
  }
  if (world.finished && world.won) {
    game.screen = SCREEN_LEVEL_DONE;
    setStatus(`Floor cleared in ${Math.floor(world.time)} seconds. Score ${game.score + world.score}.`);
  } else if (world.finished && world.over) {
    game.lives -= 1;
    game.totalSeen += world.seenCount;
    if (game.lives <= 0) {
      game.screen = SCREEN_OVER;
      setStatus('Caught, and out of lives. Game over.');
    } else {
      game.screen = SCREEN_CAUGHT;
      setStatus(`Caught! Lives left: ${game.lives}.`);
    }
  }
}

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (input.wasPressed('KeyM')) {
    game.muted = sounds.toggleMute();
  }
  if (game.screen === SCREEN_PLAY) {
    acc += dt;
    while (acc >= STEP) {
      playStep(STEP);
      acc -= STEP;
      if (game.screen !== SCREEN_PLAY) break;
    }
  } else {
    handleOverlayClick();
  }
  renderer.draw(game);
  input.endFrame();
  requestAnimationFrame(frame);
}

function boot() {
  renderer.resize();
  window.addEventListener('resize', () => renderer.resize());
  const shot = params.get('shot');
  if (shot) {
    const staged = stageShot(shot, game.world);
    game.screen = staged.screen;
    setStatus(`Lamplight staged shot: ${shot}. Floor ${game.world.levelIndex + 1}, ${LEVELS[0].name}.`);
    renderer.draw(game);
    return;
  }
  setStatus(`Lamplight: ${LEVELS[0].name}. Click or press Enter to begin.`);
  requestAnimationFrame(frame);
}

boot();
