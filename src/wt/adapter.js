import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSettings } from './parser.js';
import { ensureOriginal, saveTimestamped } from './backup.js';
import { SCHEME_PREFIX, ASSETS_DIR } from '../constants.js';
import { ensureWallpaper } from '../wallpaper/index.js';

/**
 * The one module that knows what a Windows Terminal settings.json looks
 * like. Screens and CLI commands speak in Themes; this adapter translates.
 *
 * Writing the file is what makes a theme permanent: Windows Terminal
 * hot-reloads it immediately and persists it across restarts and reboots.
 */

const CANDIDATES = () => {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return [
    path.join(local, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    path.join(local, 'Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    path.join(local, 'Microsoft', 'Windows Terminal', 'settings.json'),
  ];
};

/** Profile keys a theme owns. Applying a theme sets or clears ALL of them,
 *  so switching themes never leaves half the previous theme behind.
 *  `background`/`foreground` matter most: an explicit profile background
 *  OVERRIDES the color scheme in Windows Terminal, so leaving one in place
 *  makes every theme look like it "didn't apply". */
const OWNED_KEYS = [
  'colorScheme',
  'opacity',
  'useAcrylic',
  'cursorShape',
  'padding',
  'background',
  'foreground',
  'backgroundImage',
  'backgroundImageOpacity',
  'backgroundImageStretchMode',
  'experimental.retroTerminalEffect',
];

export class WTAdapter {
  constructor() {
    this.settingsPath = process.env.TERMCUTE_SETTINGS || CANDIDATES().find((p) => fs.existsSync(p)) || null;
  }

  available() {
    return this.settingsPath !== null && fs.existsSync(this.settingsPath);
  }

  readRaw() {
    return fs.readFileSync(this.settingsPath, 'utf8');
  }

  readJson() {
    return parseSettings(this.readRaw());
  }

  /** Atomic write: temp file in the same directory, then rename over. A crash
   *  mid-write can never leave settings.json half-written. On Windows the
   *  rename can transiently EPERM while Defender/WT itself holds the file —
   *  retry briefly, then fall back to a direct write rather than failing. */
  writeRaw(text) {
    const tmp = `${this.settingsPath}.termcute-tmp`;
    fs.writeFileSync(tmp, text, 'utf8');
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(tmp, this.settingsPath);
        return;
      } catch (err) {
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(err.code)) {
          try { fs.unlinkSync(tmp); } catch { /* leave the tmp for forensics */ }
          throw err;
        }
        sleepSync(20 * (attempt + 1));
      }
    }
    fs.writeFileSync(this.settingsPath, text, 'utf8');
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }

  writeJson(obj) {
    this.writeRaw(JSON.stringify(obj, null, 4) + '\n');
  }

  /**
   * Apply a theme.
   * @param {import('../types.js').Theme} theme
   * @param {object} [opts]
   * @param {boolean} [opts.timestampBackup]  false during live preview — the
   *   preview session handles snapshots itself; only permanent applies get
   *   a timestamped backup.
   */
  applyTheme(theme, { timestampBackup = true } = {}) {
    if (!this.available()) throw new Error('Windows Terminal settings.json not found.');
    const raw = this.readRaw();
    ensureOriginal(this.settingsPath, raw);
    if (timestampBackup) saveTimestamped(this.settingsPath, raw);

    const settings = parseSettings(raw);
    const scheme = { ...theme.scheme };

    // upsert our scheme; drop stale TermCute schemes so settings stay tidy
    settings.schemes = (settings.schemes || []).filter(
      (s) => s && s.name !== scheme.name && !(typeof s.name === 'string' && s.name.startsWith(SCHEME_PREFIX)),
    );
    settings.schemes.push(scheme);

    const applyToProfile = (profile) => {
      for (const key of OWNED_KEYS) delete profile[key];
      profile.colorScheme = scheme.name;
      const p = theme.profile || {};
      if (p.opacity !== undefined) profile.opacity = p.opacity;
      if (p.useAcrylic !== undefined) profile.useAcrylic = p.useAcrylic;
      if (p.cursorShape !== undefined) profile.cursorShape = p.cursorShape;
      if (p.padding !== undefined) profile.padding = p.padding;
      if (p.font?.face) profile.font = { ...(profile.font || {}), ...p.font };
      if (p.retroEffect) profile['experimental.retroTerminalEffect'] = true;
      if (p.backgroundImage) {
        const resolved = resolveImagePath(p.backgroundImage);
        if (resolved) {
          profile.backgroundImage = resolved;
          profile.backgroundImageOpacity = p.backgroundImageOpacity ?? 0.3;
          profile.backgroundImageStretchMode = p.backgroundImageStretchMode ?? 'uniformToFill';
        }
      }
    };

    // modern format: profiles.{defaults, list} — legacy format: bare array
    if (Array.isArray(settings.profiles)) {
      for (const profile of settings.profiles) applyToProfile(profile);
    } else {
      settings.profiles = settings.profiles || {};
      settings.profiles.defaults = settings.profiles.defaults || {};
      // per-profile overrides beat defaults in WT, so strip our keys from
      // every listed profile too — otherwise a stray per-profile background
      // or opacity silently masks the theme
      for (const profile of settings.profiles.list || []) {
        if (profile && typeof profile === 'object') {
          for (const key of OWNED_KEYS) delete profile[key];
        }
      }
      applyToProfile(settings.profiles.defaults);
    }

    this.writeJson(settings);
  }

  /** The scheme name currently set on profile defaults, if it's one of ours. */
  activeSchemeName() {
    try {
      const settings = this.readJson();
      const scheme = Array.isArray(settings.profiles)
        ? settings.profiles[0]?.colorScheme
        : settings.profiles?.defaults?.colorScheme;
      return typeof scheme === 'string' && scheme.startsWith(SCHEME_PREFIX) ? scheme : null;
    } catch {
      return null;
    }
  }
}

/** Synchronous sleep for the rename retry loop — no event-loop yield needed. */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Themes may reference bundled wallpapers as "@wallpaper:<file>" or
 *  procedurally generated ones as "@gen:<design>". Returns null if a
 *  generated wallpaper can't be painted — the theme applies without it. */
function resolveImagePath(image) {
  if (image.startsWith('@wallpaper:')) {
    return path.join(ASSETS_DIR, 'wallpapers', image.slice('@wallpaper:'.length));
  }
  if (image.startsWith('@gen:')) {
    try {
      return ensureWallpaper(image.slice('@gen:'.length));
    } catch {
      return null;
    }
  }
  return image;
}
