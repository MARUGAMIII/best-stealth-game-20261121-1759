// The world: the tile grid, the player, relics, the exit, and one fixed step
// of the simulation. Everything the render and the screenshots need lives here.
import { GUARD, PLAYER, SCORE, STEP, TILE } from './config.js';
import { makeGuard, updateGuard } from './guard.js';
import { makeRng } from './random.js';

export class Grid {
  constructor(levelDef) {
    this.rows = levelDef.map.map((row) => row.split(''));
    this.height = this.rows.length;
    this.width = this.rows[0].length;
    this.lamps = new Set((levelDef.lamps || []).map(([x, y]) => `${x},${y}`));
    this.tileAt = (tx, ty) => {
      if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return '#';
      return this.rows[ty][tx];
    };
  }

  isSolidTile(ch) {
    return ch === '#' || ch === 'c';
  }

  blocksSightAt(px, py) {
    return this.isSolidTile(this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)));
  }

  blocksMovementAt(px, py) {
    return this.isSolidTile(this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)));
  }

  isBushAt(px, py) {
    return this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)) === 'b';
  }

  isLampAt(px, py) {
    return this.lamps.has(`${Math.floor(px / TILE)},${Math.floor(py / TILE)}`);
  }

  /** Push a circle out of solid tiles (axis-separated, so movement slides). */
  pushOutOfSolid(body, radius) {
    const minX = Math.floor((body.x - radius) / TILE);
    const maxX = Math.floor((body.x + radius) / TILE);
    const minY = Math.floor((body.y - radius) / TILE);
    const maxY = Math.floor((body.y + radius) / TILE);
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        if (!this.isSolidTile(this.tileAt(tx, ty))) continue;
        const cx = Math.max(tx * TILE, Math.min(body.x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(body.y, ty * TILE + TILE));
        const dx = body.x - cx;
        const dy = body.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= radius * radius) continue;
        if (d2 < 0.0001) {
          body.y = ty * TILE - radius;
          continue;
        }
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * radius;
        body.y = cy + (dy / d) * radius;
      }
    }
  }

  /** Breadth-first path over walkable tiles; returns tile coords, start excluded. */
  findPath(x0, y0, x1, y1) {
    const sx = Math.floor(x0 / TILE);
    const sy = Math.floor(y0 / TILE);
    const gx = Math.floor(x1 / TILE);
    const gy = Math.floor(y1 / TILE);
    if (sx === gx && sy === gy) return [];
    const key = (x, y) => `${x},${y}`;
    const prev = new Map();
    const queue = [[sx, sy]];
    prev.set(key(sx, sy), null);
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      if (cx === gx && cy === gy) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (this.isSolidTile(this.tileAt(nx, ny))) continue;
        if (prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [cx, cy]);
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(key(gx, gy))) return [];
    const path = [];
    let cur = [gx, gy];
    while (cur && !(cur[0] === sx && cur[1] === sy)) {
      path.unshift(cur);
      cur = prev.get(key(cur[0], cur[1]));
    }
    return path;
  }
}

export function findInMap(levelDef, ch) {
  const found = [];
  levelDef.map.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === ch) found.push([x, y]);
    }
  });
  return found;
}

export class World {
  constructor(levelDef, levelIndex, seed) {
    this.levelDef = levelDef;
    this.levelIndex = levelIndex;
    this.tile = TILE;
    this.grid = new Grid(levelDef);
    this.rng = makeRng(seed);
    const [px, py] = findInMap(levelDef, 'P')[0];
    this.player = {
      x: (px + 0.5) * TILE,
      y: (py + 0.5) * TILE,
      angle: 0,
      moving: false,
      sneaking: false,
      inBush: false,
      inLamp: false,
      stepPhase: 0,
      luresLeft: PLAYER.lureCount,
    };
    const [ex, ey] = findInMap(levelDef, 'E')[0];
    this.exit = { x: (ex + 0.5) * TILE, y: (ey + 0.5) * TILE };
    this.relics = findInMap(levelDef, 'R').map(([x, y]) => ({
      x: (x + 0.5) * TILE,
      y: (y + 0.5) * TILE,
      taken: false,
      bob: this.rng() * Math.PI * 2,
    }));
    this.guards = levelDef.guards.map((def) => makeGuard(def, TILE));
    this.time = 0;
    this.score = 0;
    this.relicsTaken = 0;
    this.seenCount = 0;
    this.caughtCount = 0;
    this.noiseX = 0;
    this.noiseY = 0;
    this.noiseRadius = 0;
    this.noiseTimer = 0;
    this.events = [];
    this.over = false;
    this.won = false;
    this.finished = false;
  }

  reset(levelDef, levelIndex, seed) {
    const fresh = new World(levelDef, levelIndex, seed);
    Object.assign(this, fresh);
  }

  /** Throw a lure: it lands where aimed and every warden in earshot investigates. */
  throwLure(tx, ty) {
    if (this.player.luresLeft <= 0 || this.finished) return false;
    this.player.luresLeft -= 1;
    this.noiseX = tx;
    this.noiseY = ty;
    this.noiseRadius = 190;
    this.noiseTimer = 0.9;
    for (const guard of this.guards) {
      if (Math.hypot(guard.x - tx, guard.y - ty) < 260) guard.heard = true;
    }
    this.events.push({ type: 'lure', x: tx, y: ty });
    return true;
  }

  /** Advance the simulation one fixed step. `input` is { dx, dy, sneak }. */
  step(dt, input) {
    if (this.finished) return;
    this.time += dt;
    const player = this.player;
    const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(input.dx, input.dy);
    player.moving = len > 0.01;
    player.sneaking = input.sneak && player.moving;
    if (player.moving) {
      const nx = (input.dx / len) * speed * dt;
      const ny = (input.dy / len) * speed * dt;
      player.x += nx;
      player.y += ny;
      player.angle = Math.atan2(input.dy, input.dx);
      player.stepPhase += (speed * dt / 12) * Math.PI;
      this.grid.pushOutOfSolid(player, PLAYER.radius);
    }
    player.inBush = this.grid.isBushAt(player.x, player.y);
    player.inLamp = this.grid.isLampAt(player.x, player.y);

    if (this.noiseTimer > 0) this.noiseTimer -= dt;

    // Relics: walk over one to pocket it.
    for (const relic of this.relics) {
      if (!relic.taken && Math.hypot(player.x - relic.x, player.y - relic.y) < 26) {
        relic.taken = true;
        this.relicsTaken += 1;
        this.score += SCORE.relic;
        this.events.push({ type: 'relic', x: relic.x, y: relic.y });
      }
    }

    let maxSuspicion = 0;
    for (const guard of this.guards) {
      const ev = updateGuard(guard, dt, this);
      if (ev.spotted) {
        this.seenCount += 1;
        this.events.push({ type: 'spotted', x: guard.x, y: guard.y });
      }
      if (ev.lost) this.events.push({ type: 'lost', x: guard.x, y: guard.y });
      if (ev.caught) {
        this.caughtCount += 1;
        this.finished = true;
        this.over = true;
        this.events.push({ type: 'caught', x: guard.x, y: guard.y });
        return;
      }
      maxSuspicion = Math.max(maxSuspicion, guard.suspicion);
    }
    this.maxSuspicion = maxSuspicion;

    // Exit: reach the green door to finish the floor.
    if (Math.hypot(player.x - this.exit.x, player.y - this.exit.y) < 26) {
      this.finished = true;
      this.won = true;
      const timeBonus = Math.max(0, SCORE.levelTimeBonus - Math.floor(this.time));
      this.score += timeBonus;
      if (this.seenCount === 0) this.score += SCORE.ghostBonus;
      this.events.push({ type: 'exit', x: this.exit.x, y: this.exit.y, timeBonus });
    }
  }

  stepFixed(input) {
    this.step(STEP, input);
  }
}
