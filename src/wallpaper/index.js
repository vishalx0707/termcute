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

const VERSION = 1;

export const WALLPAPER_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'TermCute',
  'wallpapers',
);

/**
 * Ensure the named wallpaper exists on disk, painting it if needed.
 * @param {string} name  a key of DESIGNS
 * @returns {string} absolute path to the PNG
 */
export function ensureWallpaper(name) {
  const design = DESIGNS[name];
  if (!design) throw new Error(`Unknown wallpaper "${name}"`);
  const file = path.join(WALLPAPER_DIR, `${name}-v${VERSION}.png`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(WALLPAPER_DIR, { recursive: true });
  const canvas = design();
  fs.writeFileSync(file, encodePng(canvas.w, canvas.h, canvas.toBytes()));
  return file;
}

/** Pre-paint every wallpaper (called once at TUI startup so browsing never hitches). */
export function ensureAllWallpapers() {
  for (const name of Object.keys(DESIGNS)) {
    try {
      ensureWallpaper(name);
    } catch { /* a failed paint just means that theme applies without an image */ }
  }
}
