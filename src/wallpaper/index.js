import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from './png.js';
import { DESIGNS } from './designs.js';
import { AURA_SPECS, paintAura } from './aura.js';

/**
 * Wallpapers are generated into %LOCALAPPDATA%\TermCute\wallpapers — a path
 * that never moves, so the absolute paths written into settings.json stay
 * valid across npm updates and reinstalls. Files are versioned in the name:
 * bump VERSION when a design changes and stale files are simply left behind.
 */

const VERSION = 2;

const W = 1600;
const H = 900;

export const WALLPAPER_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'TermCute',
  'wallpapers',
);

/** All paintable wallpaper names. */
export function allWallpaperNames() {
  return [...Object.keys(DESIGNS), ...Object.keys(AURA_SPECS)];
}

/**
 * Ensure the named wallpaper exists on disk, painting it if needed.
 * Aura designs use the v2 luminous light-field engine (paintAura);
 * everything else uses the original per-design Canvas painter.
 * @param {string} name  a key of DESIGNS or AURA_SPECS
 * @returns {string} absolute path to the PNG
 */
export function ensureWallpaper(name) {
  const file = path.join(WALLPAPER_DIR, `${name}-v${VERSION}.png`);
  if (fs.existsSync(file)) return file;

  let canvas;
  if (AURA_SPECS[name]) {
    canvas = paintAura(AURA_SPECS[name], W, H, 0);
  } else if (DESIGNS[name]) {
    canvas = DESIGNS[name]();
  } else {
    throw new Error(`Unknown wallpaper "${name}"`);
  }

  fs.mkdirSync(WALLPAPER_DIR, { recursive: true });
  fs.writeFileSync(file, encodePng(canvas.w, canvas.h, canvas.toBytes()));
  return file;
}

/** Pre-paint every wallpaper (called once at TUI startup so browsing never hitches). */
export function ensureAllWallpapers() {
  for (const name of allWallpaperNames()) {
    try {
      ensureWallpaper(name);
    } catch { /* a failed paint just means that theme applies without an image */ }
  }
}
