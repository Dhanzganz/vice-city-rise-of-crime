# VICE CITY: Rise of Crime

![make.fun bounty](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Dhanzganz/vice-city-rise-of-crime/rank.svg)
![reward](https://make.fun/badge/gta6-01/Dhanzganz/vice-city-rise-of-crime/reward.svg)

An original 3D open-world crime game that runs entirely in the browser. Cruise a sun-soaked coastal city of palm-lined avenues, pastel towers and a working beachfront; jack cars, outrun the VCPD, brawl and shoot your way through a three-job story for fixer Marco — all offline, no downloads, no network calls.

Entry for the make.fun bounty: https://make.fun/bounty/gta6-01

## Features

- **A living city** — a 9×9 street grid with downtown towers, suburbs, a beach and animated ocean, ~300 palm trees, streetlights that glow after dark, and a full day/night cycle (dawn gold, noon blue, sunset orange-pink, night navy).
- **Driving & traffic** — 20+ cars with arcade physics (acceleration, handbrake slides, collisions), AI traffic that follows the road grid, brakes for obstacles and turns at intersections. Any car can be entered and stolen with `E`.
- **Pedestrians** — citizens wander the sidewalks, cross at intersections, panic and flee from gunfire and speeding cars, and can be run down (the law notices).
- **Police & wanted system** — crimes raise your stars (up to 5); VCPD units spawn, chase, ram and bust you. Lose the heat to bleed stars off, or get BUSTED (fined, dropped at the station) / WASTED (hospital, medical bill).
- **Combat** — fists and a hitscan pistol with magazine/reserve ammo, muzzle flash, synthesized gunshots, and a cash economy.
- **Three-mission story** — fixer **Marco** sends you on *First Run* (a docks pickup), *Hot Wheels* (steal a gold convertible) and *The Last Job* (a pier escape under a 3-star heat), with banner dialogue, gold beacon markers and a minimap objective blip. Free roam after the finale.
- **HUD & menus** — minimap with police/mission blips, wanted stars, health, cash and ammo/speed readouts, start menu, pause menu, and save/continue via localStorage.
- **Synthesized audio** — engine hum, two-tone sirens, gunshots, punches and pickups, all generated with WebAudio. No audio files.

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move / drive |
| Mouse drag | Orbit camera |
| Mouse wheel | Camera zoom |
| `Shift` | Sprint |
| `Space` | Jump (on foot) / handbrake (in car) |
| `E` | Enter / exit car |
| `Q` | Arm / holster pistol |
| Mouse click | Fire pistol (or punch when unarmed) |
| `F` | Punch |
| `R` | Reload |
| `P` or `Esc` | Pause |

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Everything is static: `game/index.html` plus the scripts under `game/src/`. Three.js is vendored at `game/vendor/three.min.js`; every other line of the game is hand-written. The game makes **no network requests** and works fully offline.

`node main.ts` packages the entry: it copies `game/` and `screenshots/` to the output directory and writes the make.fun `dossier.json`.

## Screenshots

- `screenshots/1-cover.jpg` — golden-hour avenue, downtown.
- `screenshots/2-drive.jpg` — driving into the sunset with traffic.
- `screenshots/3-chase.jpg` — a three-star VCPD chase at dusk.
- `screenshots/4-mission.jpg` — Marco's first job: the docks pickup, beacon lit.

## Tech note

Built on [Three.js](https://threejs.org) (r147, vendored, MIT) with classic scripts on a single `VC` namespace — engine/day cycle, procedural city, vehicles/traffic AI, pedestrians, police AI, combat, missions, HUD and menus are all original code in `game/src/`. City layout is seeded and deterministic. All characters, names, story and art are original; no Rockstar IP is used.
