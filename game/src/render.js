// Rendering: one canvas, a top-down view of the archive floor. The world is
// 30 x 19 tiles (960 x 608 px) and is scaled to fit the window under a HUD bar.
// Vision cones are raycast fans, so a crate or wall cuts the light exactly
// where it cuts the warden's sight.
import { COLORS, GUARD, PLAYER, SCREEN_CAUGHT, SCREEN_LEVEL_DONE, SCREEN_OVER, SCREEN_TITLE, SCREEN_WIN, TILE } from './config.js';
import { GUARD_CHASE, GUARD_INVESTIGATE, GUARD_STARE } from './guard.js';

export const WORLD_W = 30 * TILE;
export const WORLD_H = 19 * TILE;
export const HUD_H = 56;

function conePolygon(grid, guard) {
  const range = GUARD.sightRange;
  const points = [[guard.x, guard.y]];
  const steps = 26;
  for (let i = 0; i <= steps; i += 1) {
    const a = guard.angle - GUARD.fovHalf + (2 * GUARD.fovHalf * i) / steps;
    let r = range;
    for (let d = 8; d < range; d += 8) {
      if (grid.blocksSightAt(guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d)) {
        r = d;
        break;
      }
    }
    points.push([guard.x + Math.cos(a) * r, guard.y + Math.sin(a) * r]);
  }
  return points;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.ox = 0;
    this.oy = HUD_H;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = Math.min(w / WORLD_W, (h - HUD_H) / WORLD_H);
    this.ox = (w - WORLD_W * this.scale) / 2;
    this.oy = HUD_H + (h - HUD_H - WORLD_H * this.scale) / 2;
    this.viewW = w;
    this.viewH = h;
  }

  toWorld(sx, sy) {
    return { x: (sx - this.ox) / this.scale, y: (sy - this.oy) / this.scale };
  }

  draw(game) {
    const { ctx } = this;
    const world = game.world;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    this.drawHud(game);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);
    this.drawFloor(world);
    this.drawLamps(world);
    this.drawExit(world);
    this.drawRelics(world);
    this.drawCones(world);
    this.drawCover(world);
    this.drawWalls(world);
    this.drawGuards(world);
    this.drawPlayer(world);
    this.drawNoise(world);
    ctx.restore();
    if (game.screen !== 'play') this.drawScreen(game);
  }

  drawHud(game) {
    const { ctx } = this;
    const world = game.world;
    ctx.fillStyle = '#12152a';
    ctx.fillRect(0, 0, this.viewW, HUD_H);
    ctx.fillStyle = '#2a2f4d';
    ctx.fillRect(0, HUD_H - 2, this.viewW, 2);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LAMPLIGHT  ·  ${world.levelDef.name}`, 16, 20);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`Floor ${world.levelIndex + 1} of 3`, 16, 40);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`Score ${game.score + world.score}`, this.viewW / 2, 20);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.dim;
    const relics = world.relics.filter((r) => r.taken).length;
    ctx.fillText(`Relics ${relics}/${world.relics.length}   ·   Lures ${world.player.luresLeft}   ·   Lives ${game.lives}   ·   ${Math.floor(world.time)}s`, this.viewW / 2, 40);
    // Suspicion meter: the most suspicious warden right now.
    const max = world.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
    const bx = this.viewW - 220;
    const by = 16;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('ALARM', bx, by - 1);
    ctx.fillStyle = '#2a2f4d';
    ctx.fillRect(bx + 52, by - 7, 150, 14);
    ctx.fillStyle = max >= 100 ? '#ff5040' : max >= 34 ? '#ffb03a' : '#58d68d';
    ctx.fillRect(bx + 52, by - 7, Math.max(0, Math.min(150, (max / 100) * 150)), 14);
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(game.muted ? 'M: sound off' : 'M: sound on', bx, by + 20);
  }

  drawFloor(world) {
    const { ctx } = this;
    const grid = world.grid;
    for (let ty = 0; ty < grid.height; ty += 1) {
      for (let tx = 0; tx < grid.width; tx += 1) {
        const ch = grid.tileAt(tx, ty);
        if (ch === '#') continue;
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        ctx.strokeStyle = COLORS.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE, TILE);
      }
    }
  }

  drawLamps(world) {
    const { ctx } = this;
    for (const key of world.grid.lamps) {
      const [tx, ty] = key.split(',').map(Number);
      const cx = (tx + 0.5) * TILE;
      const cy = (ty + 0.5) * TILE;
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 86);
      glow.addColorStop(0, 'rgba(255, 200, 110, 0.20)');
      glow.addColorStop(1, 'rgba(255, 200, 110, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 86, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcf7d';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6d2f';
      ctx.fillRect(cx - 1, cy - 8, 2, 6);
    }
  }

  drawExit(world) {
    const { ctx } = this;
    const pulse = 0.55 + 0.25 * Math.sin(world.time * 3);
    const { x, y } = world.exit;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 54);
    glow.addColorStop(0, `rgba(88, 214, 141, ${pulse})`);
    glow.addColorStop(1, 'rgba(88, 214, 141, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d5c34';
    ctx.fillRect(x - 13, y - 13, 26, 26);
    ctx.fillStyle = COLORS.exit;
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = '#0b0e1a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', x, y + 22);
  }

  drawRelics(world) {
    const { ctx } = this;
    for (const relic of world.relics) {
      if (relic.taken) continue;
      const bob = Math.sin(world.time * 2.4 + relic.bob) * 3;
      const { x, y } = relic;
      const glow = ctx.createRadialGradient(x, y + bob, 2, x, y + bob, 34);
      glow.addColorStop(0, 'rgba(255, 215, 94, 0.35)');
      glow.addColorStop(1, 'rgba(255, 215, 94, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y + bob, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.relic;
      ctx.beginPath();
      ctx.moveTo(x, y + bob - 9);
      ctx.lineTo(x + 7, y + bob);
      ctx.lineTo(x, y + bob + 9);
      ctx.lineTo(x - 7, y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(x - 2, y + bob - 2, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCones(world) {
    const { ctx } = this;
    for (const guard of world.guards) {
      const poly = conePolygon(world.grid, guard);
      ctx.fillStyle = guard.state === GUARD_CHASE ? COLORS.coneAlert : guard.suspicion >= 34 ? COLORS.coneWary : COLORS.coneCalm;
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawCover(world) {
    const { ctx } = this;
    const grid = world.grid;
    for (let ty = 0; ty < grid.height; ty += 1) {
      for (let tx = 0; tx < grid.width; tx += 1) {
        const ch = grid.tileAt(tx, ty);
        if (ch === 'c') {
          ctx.fillStyle = COLORS.crate;
          ctx.fillRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = COLORS.crateTop;
          ctx.fillRect(tx * TILE + 5, ty * TILE + 5, TILE - 10, TILE - 10);
          ctx.strokeStyle = '#4a3517';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tx * TILE + 5.5, ty * TILE + 5.5, TILE - 11, TILE - 11);
          ctx.beginPath();
          ctx.moveTo(tx * TILE + 5, ty * TILE + 5);
          ctx.lineTo(tx * TILE + TILE - 5, ty * TILE + TILE - 5);
          ctx.moveTo(tx * TILE + TILE - 5, ty * TILE + 5);
          ctx.lineTo(tx * TILE + 5, ty * TILE + TILE - 5);
          ctx.stroke();
        } else if (ch === 'b') {
          ctx.fillStyle = COLORS.bush;
          ctx.beginPath();
          ctx.arc(tx * TILE + 10, ty * TILE + 18, 9, 0, Math.PI * 2);
          ctx.arc(tx * TILE + 22, ty * TILE + 14, 10, 0, Math.PI * 2);
          ctx.arc(tx * TILE + 16, ty * TILE + 10, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.bushLeaf;
          ctx.beginPath();
          ctx.arc(tx * TILE + 12, ty * TILE + 14, 5, 0, Math.PI * 2);
          ctx.arc(tx * TILE + 22, ty * TILE + 20, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawWalls(world) {
    const { ctx } = this;
    const grid = world.grid;
    for (let ty = 0; ty < grid.height; ty += 1) {
      for (let tx = 0; tx < grid.width; tx += 1) {
        if (grid.tileAt(tx, ty) !== '#') continue;
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, 5);
      }
    }
  }

  drawGuards(world) {
    const { ctx } = this;
    for (const guard of world.guards) {
      const bob = Math.sin(guard.stepPhase) * 1.5;
      // Body: a warden in a brass-buttoned coat, lantern at the belt.
      ctx.fillStyle = guard.state === GUARD_CHASE ? '#ff5040' : COLORS.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y + bob * 0.4, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2417';
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(guard.angle) * 5, guard.y + Math.sin(guard.angle) * 5 + bob * 0.4, 5.5, 0, Math.PI * 2);
      ctx.fill();
      // Facing tick.
      ctx.strokeStyle = '#2b2417';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.angle) * 17, guard.y + Math.sin(guard.angle) * 17);
      ctx.stroke();
      // Suspicion bar + mark.
      if (guard.suspicion > 1) {
        const w = 30;
        ctx.fillStyle = '#10131f';
        ctx.fillRect(guard.x - w / 2, guard.y - 26, w, 5);
        ctx.fillStyle = guard.suspicion >= 100 ? '#ff5040' : guard.suspicion >= 34 ? '#ffb03a' : '#ffd75e';
        ctx.fillRect(guard.x - w / 2, guard.y - 26, (w * guard.suspicion) / 100, 5);
      }
      if (guard.state === GUARD_CHASE || guard.state === GUARD_STARE) {
        ctx.fillStyle = guard.state === GUARD_CHASE ? '#ff5040' : '#ffb03a';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(guard.state === GUARD_CHASE ? '!' : '?', guard.x, guard.y - 38);
      } else if (guard.state === GUARD_INVESTIGATE) {
        ctx.fillStyle = '#ffd75e';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', guard.x, guard.y - 38);
      }
    }
  }

  drawPlayer(world) {
    const { ctx } = this;
    const p = world.player;
    const bob = Math.sin(p.stepPhase) * 1.5;
    // Footstep noise ring while walking (wardens hear inside it).
    if (p.moving) {
      const r = p.sneaking ? PLAYER.sneakNoise : PLAYER.walkNoise;
      ctx.strokeStyle = 'rgba(232, 228, 216, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cloak: a hooded figure in violet, pale face, darker when hidden in a bush.
    ctx.globalAlpha = p.inBush ? 0.55 : 1;
    ctx.fillStyle = COLORS.playerCloak;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
    ctx.lineTo(p.x + Math.cos(p.angle + 2.5) * 12, p.y + Math.sin(p.angle + 2.5) * 12);
    ctx.lineTo(p.x + Math.cos(p.angle - 2.5) * 12, p.y + Math.sin(p.angle - 2.5) * 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob * 0.3, PLAYER.radius - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2417';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4 + bob * 0.3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (p.inBush) {
      ctx.fillStyle = '#2e6b40';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HIDDEN', p.x, p.y - 22);
    }
    if (p.inLamp) {
      ctx.fillStyle = '#ffb03a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IN THE LIGHT', p.x, p.y - 22);
    }
  }

  drawNoise(world) {
    const { ctx } = this;
    if (world.noiseTimer > 0) {
      const a = world.noiseTimer / 0.9;
      ctx.strokeStyle = `rgba(255, 215, 94, ${0.7 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(world.noiseX, world.noiseY, world.noiseRadius * (1 - a * 0.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 215, 94, ${0.8 * a})`;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CLINK', world.noiseX, world.noiseY - 16);
    }
  }

  panel(title, lines, accent) {
    const { ctx } = this;
    const w = Math.min(620, this.viewW - 60);
    const h = 92 + lines.length * 26;
    const x = (this.viewW - w) / 2;
    const y = (this.viewH - h) / 2;
    ctx.fillStyle = 'rgba(8, 10, 22, 0.55)';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.fillStyle = '#141828';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = accent;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, this.viewW / 2, y + 44);
    ctx.fillStyle = COLORS.text;
    ctx.font = '15px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, this.viewW / 2, y + 84 + i * 26);
    });
  }

  drawScreen(game) {
    const world = game.world;
    if (game.screen === SCREEN_TITLE) {
      this.panel('LAMPLIGHT', [
        'A quiet heist in the Moonlit Archive.',
        `Floor ${world.levelIndex + 1}: ${world.levelDef.name}`,
        'Slip past the reading-room wardens.',
        'The relic is optional — the green door is the way out.',
        '',
        'WASD / arrows — move      Shift — sneak, slow and quiet',
        'Click — toss a lure to draw a warden away      M — mute',
        'Stay out of the golden cones. Reach the green EXIT unseen.',
        '',
        'Click or press Enter to begin',
      ], '#ffd75e');
    } else if (game.screen === SCREEN_LEVEL_DONE) {
      this.panel('FLOOR CLEARED', [
        `${world.levelDef.name} — done in ${Math.floor(world.time)}s.`,
        `Relics pocketed: ${world.relicsTaken}/${world.relics.length}  ·  Spotted ${world.seenCount} time${world.seenCount === 1 ? '' : 's'}`,
        world.seenCount === 0 ? 'Ghost bonus: never seen. Flawless.' : 'The wardens will remember your face.',
        '',
        'Click or press Enter for the next floor',
      ], '#58d68d');
    } else if (game.screen === SCREEN_CAUGHT) {
      this.panel('CAUGHT!', [
        'A warden laid a hand on your shoulder.',
        `Lives left: ${game.lives}`,
        '',
        'Watch the patrols. Wait for the cone to turn away.',
        'Bushes hide you. Lamplight gives you away.',
        '',
        'Click or press Enter to try this floor again',
      ], '#ff5040');
    } else if (game.screen === SCREEN_WIN) {
      this.panel('THE QUIET HEIST', [
        'Three floors, one shadow, and the archive never knew you were there.',
        `Final score: ${game.score + world.score}`,
        `Relics: ${game.totalRelics}  ·  Times spotted: ${game.totalSeen}`,
        game.totalSeen === 0 ? 'A perfect ghost run.' : 'Loud in places — but the relics are yours.',
        '',
        'Click or press Enter to play again',
      ], '#ffd75e');
    } else if (game.screen === SCREEN_OVER) {
      this.panel('THE ARCHIVE KEEPS ITS SECRETS', [
        'Out of lives. The wardens change the locks tonight.',
        `Score: ${game.score + world.score}`,
        '',
        'Click or press Enter to start over',
      ], '#ff5040');
    }
  }
}
