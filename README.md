# VICE CITY: Rise of Crime — a make.fun gta6-01 entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Dhanzganz/vice-city-rise-of-crime/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Dhanzganz/vice-city-rise-of-crime/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Bounty: https://make.fun/bounty/gta6-01

An original, browser-based 3D open-world crime game built with Three.js and
plain classic scripts. It runs completely offline: every asset is generated in
code — the geometry, the canvas textures, even the audio is synthesized — so
nothing is ever loaded from the network. The city, the characters and the
story are all original work; there are no Rockstar assets, names or artwork
anywhere in it.

## Story

A nobody washes up in a neon coastal city with empty pockets and no name
anyone remembers. The fixer Marco offers three favours: a quiet pickup down
at the docks, stealing a gold car in broad daylight, and one final run with
every cop in the city on your tail. Finish the chain and the city is yours.
Get caught along the way and you wake up with less cash than you started the
day with.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Look (click the game to capture the pointer) |
| Shift | Sprint |
| Space | Jump |
| E | Enter / exit car |
| Q | Draw / holster weapon |
| Mouse click | Fire |
| F | Punch |
| R | Reload |
| Esc | Pause |

## Features

- **A living city** — a 9×9 road grid with self-driving traffic, pedestrians
  who panic and scatter when things go wrong, a beach and pier along the
  southern shore, and a full day/night cycle with lit windows after dark.
- **On foot and behind the wheel** — sprint, jump, jack any car you can reach,
  and drive it with a chase camera.
- **Police wanted system** — patrols spawn, pursue and try to bust you; heat
  decays when you lie low.
- **Combat** — a drawable handgun with hitscan shots, muzzle flash and
  reloading from a reserve, plus your fists when that's all you have.
- **Marco's 3-mission chain** — gold beacons mark the objectives, cash rewards
  for each favour done, and a minimap that tracks both objectives and police.
- **Synthesized audio** — engine notes, gunshots, sirens and UI sounds are all
  generated with WebAudio; there are no audio files.
- **HUD** — cash, health, wanted stars, ammo, speed and the minimap, always on
  screen.

## Screenshots

- `screenshots/1-cover.jpg` — the player overlooking downtown
- `screenshots/2-drive.jpg` — driving the streets
- `screenshots/3-chase.jpg` — a police pursuit at three wanted stars
- `screenshots/4-mission.jpg` — Marco's first marker at the docks

## How to run

From the repository root:

```
node serve.ts
```

Then open the page it serves (the game itself lives under `game/`). Any static
file server rooted at the repository works just as well — there is no build
step and no network access is needed.

## Tech notes

- Classic `<script>` tags only: no modules, no bundler. Every file registers
  its factories on one global `VC` namespace (`VC.createEngine`,
  `VC.buildCity`, `VC.createPlayer`, …) and `game/src/main.js` wires them
  together into `VC.game`.
- Three.js r147 is vendored under `game/vendor/`; nothing is fetched at
  runtime.
- The world is deterministic, generated from the fixed seed
  `VC.makeRng(20261119)`.
- Progress autosaves to `localStorage` under the key `vicecity-save-v1` every
  25 seconds.
- Screenshot staging is driven by the query string:
  `?shot=cover|drive|chase|mission`.
