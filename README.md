# VICE CITY: Rise of Crime — a make.fun gta6-01 entry

![make.fun bounty](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/Dhanzganz/vice-city-rise-of-crime/rank.svg)
![reward](https://make.fun/badge/gta6-01/Dhanzganz/vice-city-rise-of-crime/reward.svg)

Bounty: https://make.fun/bounty/gta6-01

An original browser-based 3D open-world crime game, built with Three.js and
plain classic scripts. It runs **fully offline**: every asset is generated in
code (geometry, canvas textures, synthesized audio) and nothing is loaded
from the network. No Rockstar assets, names, or artwork are used — the city,
characters, and story are original creations.

## Story

You are a nobody washing up in a neon coastal city of palms, causeways, and
bad decisions. The fixer **Marco** has work for anyone hungry enough to take
it — three favours that climb from a simple dock pickup, to stealing a gold
car in broad daylight, to one last run with every cop in the city on your
tail. Finish the chain and Vice City is yours; get caught and you wake up
with less cash and a fresh grudge.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click the game to capture the mouse) |
| Shift | Sprint |
| Space | Jump |
| E | Enter / exit car |
| Q | Draw / holster weapon |
| Mouse click | Fire (while armed) |
| F | Punch |
| R | Reload |
| Esc | Pause |

## Features

- **A living city** — a 9×9 road grid with traffic that drives itself,
  pedestrians who stroll, panic, and scatter, a beach and pier to the south,
  and a full day/night cycle with lit windows after dark.
- **On foot and behind the wheel** — sprint, jump, jack any parked or
  traffic car, and drive with a chase camera.
- **Police wanted system** — crimes raise your wanted level; patrol units
  spawn, pursue, and bust you if they pin you on foot. Lying low lets the
  heat decay.
- **Combat** — a drawable handgun with hitscan fire, muzzle flash, reloads
  from a reserve pool, and fists for quieter arguments.
- **Marco's mission chain** — three favours with gold beacon markers,
  cash rewards, and a minimap that tracks objectives and police.
- **Synthesized audio** — engine hum, gunshots, sirens, and UI sounds are
  all generated with WebAudio; there are no audio files.
- **HUD** — cash, health, wanted stars, ammo, speed, and a live minimap.

## Screenshots

- `screenshots/1-cover.jpg` — the player overlooking downtown.
- `screenshots/2-drive.jpg` — driving the streets.
- `screenshots/3-chase.jpg` — a police pursuit at three wanted stars.
- `screenshots/4-mission.jpg` — Marco's first marker at the docks.

## How to run

From the repository root:

```sh
node serve.ts
```

then open the page it serves (the game lives under `game/`). Any static
file server pointed at the repository root works just as well — open
`game/index.html` through it. No build step and no network access are
required.

## Tech notes

- Classic `<script>` tags only — no modules, no bundler. Every file
  registers factories on a single global `VC` namespace
  (`VC.createEngine`, `VC.buildCity`, `VC.createPlayer`, and so on), and
  `game/src/main.js` wires them together into the `VC.game` registry.
- Three.js r147 is vendored under `game/vendor/`.
- World generation is deterministic: the city is built from a fixed seed
  via `VC.makeRng(20261119)`, so every visit builds the same Vice City.
- Progress (cash, health, position) autosaves to `localStorage` under
  `vicecity-save-v1` every 25 seconds.
- Screenshot staging: append `?shot=cover`, `?shot=drive`, `?shot=chase`,
  or `?shot=mission` to the game URL to freeze time and stage a scene.
