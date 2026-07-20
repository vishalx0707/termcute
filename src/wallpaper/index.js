import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from './png.js';
import { DESIGNS } from './designs.js';

/**
 * Wallpapers are generated into %LOCALAPPDATA%\TermCute\wallpapers — a path
 * that never moves, so the absolute paths written into settings.json stay
 * valid across npm updates and reinstalls. Files are versioned in the name:
 * bump VERSION when a design changes and stale files are simply left behind.
 */

const VERSION = 6; // Bump version for redesigned Liquid Glass

const W = 1600;
const H = 900;
const GENERATED_FILE_RE = /^([a-z0-9-]+)-v(\d+)\.png$/;

export const WALLPAPER_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'TermCute',
  'wallpapers',
);

/** All paintable wallpaper names. */
export function allWallpaperNames() {
  return Object.keys(DESIGNS);
}

function assertKnownWallpaper(name) {
  if (typeof name !== 'string' || !Object.hasOwn(DESIGNS, name)) {
    throw new Error(`Unknown wallpaper "${name}"`);
  }
}

/**
 * Ensure the named wallpaper exists on disk, painting it if needed.
 * @param {string} name  a key of DESIGNS
 * @returns {string} absolute path to the wallpaper file
 */
export function ensureWallpaper(name) {
  assertKnownWallpaper(name);
  const file = path.join(WALLPAPER_DIR, `${name}-v${VERSION}.png`);
  if (fs.existsSync(file)) return file;

  fs.mkdirSync(WALLPAPER_DIR, { recursive: true });

  const canvas = DESIGNS[name]();
  fs.writeFileSync(file, encodePng(canvas.w, canvas.h, canvas.toBytes()));

  return file;
}

/** Remove old generated wallpaper versions for current known designs. */
export function pruneWallpaperCache() {
  if (!fs.existsSync(WALLPAPER_DIR)) return;

  for (const entry of fs.readdirSync(WALLPAPER_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = GENERATED_FILE_RE.exec(entry.name);
    if (!match) continue;

    const [, name, versionText] = match;
    if (!Object.hasOwn(DESIGNS, name)) continue;
    if (Number(versionText) === VERSION) continue;

    fs.rmSync(path.join(WALLPAPER_DIR, entry.name), { force: true });
  }
}

/** Pre-paint every wallpaper (called once at TUI startup so browsing never hitches). */
export function ensureAllWallpapers() {
  pruneWallpaperCache();
  for (const name of allWallpaperNames()) ensureWallpaper(name);
}
