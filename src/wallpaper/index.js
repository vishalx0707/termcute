import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from './png.js';
import { DESIGNS } from './designs.js';
import { AURA_SPECS, paintAura } from './aura.js';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * Wallpapers are generated into %LOCALAPPDATA%\TermCute\wallpapers — a path
 * that never moves, so the absolute paths written into settings.json stay
 * valid across npm updates and reinstalls. Files are versioned in the name:
 * bump VERSION when a design changes and stale files are simply left behind.
 */

const VERSION = 5; // Bump version for 320x180 GIFs

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
 * Aura designs use the v3 luminous light-field engine to paint a slow-motion
 * animated GIF; everything else uses the original static Canvas painter.
 * @param {string} name  a key of DESIGNS or AURA_SPECS
 * @returns {string} absolute path to the wallpaper file
 */
export function ensureWallpaper(name) {
  const isAura = AURA_SPECS[name] !== undefined;
  const ext = isAura ? 'gif' : 'png';
  const file = path.join(WALLPAPER_DIR, `${name}-v${VERSION}.${ext}`);
  if (fs.existsSync(file)) return file;

  fs.mkdirSync(WALLPAPER_DIR, { recursive: true });

  if (isAura) {
    // Generate animated GIF at 320x180 for high performance and soft rendering
    const w = 320;
    const h = 180;
    const numFrames = 30;
    const delay = 100; // ms per frame (10 fps, 3-second seamless loop)
    const gif = GIFEncoder();
    let globalPalette = null;

    for (let f = 0; f < numFrames; f++) {
      const t = f / numFrames;
      const canvas = paintAura(AURA_SPECS[name], w, h, t);
      const bytes = canvas.toBytes();

      // Convert RGB to RGBA for gifenc
      const rgba = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = bytes[i * 3];
        rgba[i * 4 + 1] = bytes[i * 3 + 1];
        rgba[i * 4 + 2] = bytes[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }

      if (!globalPalette) {
        globalPalette = quantize(rgba, 256);
      }

      const index = applyPalette(rgba, globalPalette);
      gif.writeFrame(index, w, h, { palette: globalPalette, delay });
    }

    gif.finish();
    fs.writeFileSync(file, Buffer.from(gif.bytes()));
  } else {
    // Generate static PNG
    if (!DESIGNS[name]) {
      throw new Error(`Unknown wallpaper "${name}"`);
    }
    const canvas = DESIGNS[name]();
    fs.writeFileSync(file, encodePng(canvas.w, canvas.h, canvas.toBytes()));
  }

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
