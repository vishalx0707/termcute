import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PKG_ROOT = path.resolve(__dirname, '..');
export const THEMES_DIR = path.join(PKG_ROOT, 'themes');
export const ASSETS_DIR = path.join(PKG_ROOT, 'assets');

export const FPS = 30;
export const FRAME_MS = 1000 / FPS;

/** Debounce for live-preview writes while scrolling the theme list.
 *  Windows Terminal visibly redraws when it hot-reloads settings.json, so
 *  wait until browsing has settled instead of interrupting each arrow move. */
export const PREVIEW_DEBOUNCE_MS = 550;

/** UI palette (TermCute's own chrome — independent of the themes it applies). */
export const UI = {
  PINK: '#ff9ec7',
  PINK_DEEP: '#ff5d8f',
  PINK_SOFT: '#ffd1e3',
  LAVENDER: '#b49cff',
  LAVENDER_DEEP: '#8b6dff',
  WHITE: '#f5f0f4',
  GOLD: '#ffd479',
  MINT: '#9be8c8',
  RED: '#ff6b81',
  DIM: '#6b6470',
  DIMMER: '#453f4c',
  BG_PANEL: '#16121c',
  BG_PANEL_LIGHT: '#221b2b',
  /** selected-row highlight bar */
  SEL_BG: '#3a1c2e',
  /** small chip backgrounds (current-theme badge) */
  CHIP_BG: '#2a1522',
  /** decorative frame around every screen */
  FRAME: '#7a4460',
};

/** Windows Terminal cursor shapes, in cycle order for the custom editor. */
export const CURSOR_SHAPES = [
  'bar',
  'filledBox',
  'emptyBox',
  'underscore',
  'doubleUnderscore',
  'vintage',
];

/** All schemes TermCute installs are namespaced to avoid colliding with WT built-ins. */
export const SCHEME_PREFIX = 'TermCute ';

export const BACKUP_ORIGINAL = 'settings.termcute-original.json';
export const BACKUP_PREFIX = 'settings.termcute-backup-';
export const BACKUP_KEEP = 5;
