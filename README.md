# lamplight

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/MARUGAMIII/lamplight/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/MARUGAMIII/lamplight/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Lamplight — a quiet heist** is a top-down stealth game that runs entirely offline in a desktop browser. You are Wren, a night courier slipping through three floors of the Moonlit Archive — *The Reading Room*, *The Vault Corridor*, *The Grand Gallery* — to lift a relic and reach the green EXIT unseen. Wardens patrol with real vision cones (raycast, cut short by walls and crates), pause at waypoints to scan the room, and chase you down if their suspicion meter fills. Getting spotted is not instant failure: a warden stops and stares ("?"), then gives chase ("!"), and gives up if you break line of sight for 3.2 seconds. You are only caught if a warden touches you — three lives per run.

## How to play

- **WASD / arrow keys** — move
- **Shift** — sneak (slow, silent)
- **Mouse click** — throw a lure (3 per floor; the "CLINK" draws wardens to investigate)
- **M** — mute · **P / Esc** — pause · **R** — restart

Crates block sight and movement; bushes hide you but slow you down; standing in lamplight makes you easier to spot. Footsteps tell you where a wardens is — their sound pans and fades with distance and direction. Relics are worth +250, and a ghost run (never spotted) earns a +200 bonus.

The game is plain static files — no network requests, no libraries, no build step. Sound is synthesized live with Web Audio, so there are no audio files either. Open `game/index.html` in a browser and it just plays.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Files

- `game/index.html` — the page (canvas + loader)
- `game/src/main.js` — the frame loop and screens
- `game/src/config.js` — tuning and difficulty
- `game/src/levels.js` — the three maps
- `game/src/vision.js` — vision cones and raycasting
- `game/src/guard.js` — warden AI: patrol, stare, chase, investigate
- `game/src/world.js` — the grid, BFS pathfinding, player, relics, exit
- `game/src/render.js` — everything drawn: level, wardens, cones, HUD, menus
- `game/src/audio.js` — synthesized sound effects (Web Audio)
- `game/src/input.js` — keyboard and mouse input
- `game/src/random.js` — the seeded random generator
- `game/src/shots.js` — deterministic `?shot=...` screenshot staging
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — 4 real renders of the game in a browser (first is the cover)
- `shots.json` — the query strings each screenshot was taken with

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
