// Entry point for the gta6-01 submission of "VICE CITY: Rise of Crime".
//
// The grader runs this file with Node 22 (standard library only, no
// network). Its job is simple: mirror the playable game and its
// screenshots into the output directory, then ask the vendored
// makefun helper to describe that output as a dossier and store the
// dossier next to the files it describes.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDossier } from "./vendor/makefun-game.ts";

// This file lives at the repository root, so its own directory is the
// root every relative path below is anchored to.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// Where the graded snapshot goes; the harness points MAKEFUN_OUTPUT_DIR
// at a scratch directory and defaults to /output when it does not.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });

// Fail loudly on a broken snapshot rather than grading an empty one:
// the game's entry page must be there, and the dossier only accepts
// four screenshots, so more than that in the folder is a mistake.
if (!existsSync(join(repoRoot, "game", "index.html"))) {
  throw new Error("game/index.html is missing: nothing playable to ship");
}
const shots = readdirSync(join(repoRoot, "screenshots")).filter((name) =>
  /\.(jpe?g|png|webp)$/i.test(name),
);
if (shots.length === 0 || shots.length > 4) {
  throw new Error(`screenshots/ must hold 1 to 4 images, found ${shots.length}`);
}

// Ship the game itself (HTML, classic scripts, vendored Three.js) and
// the four staged screenshots, byte for byte.
cpSync(join(repoRoot, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(repoRoot, "screenshots"), join(outDir, "screenshots"), {
  recursive: true,
});

// The dossier is computed from what now sits in the output directory,
// under the size limits this competition sets for text, screenshots
// and the game payload. buildDossier hands back the bytes to store.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, "dossier.json"), dossier);

console.log(`vice-city: game, screenshots and dossier written to ${outDir}`);
