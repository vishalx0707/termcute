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

/** Keys that an agent profile should NOT inherit from profiles.defaults.
 *  When applying agent themes we explicitly set or delete every one of these
 *  on the matched profile so that the result is self-contained and immune to
 *  whatever the user's global defaults happen to be. */
const AGENT_EXPLICIT_KEYS = [...OWNED_KEYS, 'font'];

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
   * @param {'global'|'project'|'agents'} [opts.scope]  Defaults affect every profile;
   *   project creates or updates a profile rooted at opts.projectPath.
   * @param {string} [opts.projectPath]
   * @param {{name:string, command:string, matchNames?:string[], matchCommands?:string[]}[]} [opts.agents]
   */
  applyTheme(theme, { timestampBackup = true, scope = 'global', projectPath = process.cwd(), agents = [] } = {}) {
    if (!this.available()) throw new Error('Windows Terminal settings.json not found.');
    if (!['global', 'project', 'agents'].includes(scope)) throw new Error(`Unknown apply scope "${scope}".`);
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

    if (scope === 'agents') {
      if (!agents.length) throw new Error('No agent CLIs were selected.');
      settings.profiles = normalizeProfiles(settings.profiles);
      const list = settings.profiles.list;
      const defaults = settings.profiles.defaults || {};

      // Remove stale TermCute Agent profiles that don't match any real profile
      purgeStaleAgentProfiles(list, agents);

      for (const agent of agents) {
        const profile = findAgentProfile(list, agent);
        // Make the profile self-contained: override defaults so the theme
        // appearance is exactly what TermCute set, not mixed with defaults
        neutralizeDefaults(profile, defaults, theme);
        applyToProfile(profile);
        // After applyToProfile deleted and re-set keys, explicitly force
        // background/foreground from the scheme onto the profile so WT's
        // defaults-inheritance can't bleed through (deleting those keys
        // would cause WT to fall back to profiles.defaults values)
        if ('foreground' in defaults) {
          profile.foreground = scheme.foreground;
        }
        if ('background' in defaults) {
          profile.background = scheme.background;
        }
        if ('backgroundImage' in defaults && !profile.backgroundImage) {
          profile.backgroundImage = '';
        }
        if ('backgroundImageOpacity' in defaults && !profile.backgroundImage) {
          profile.backgroundImageOpacity = 1;
        }
        if ('backgroundImageStretchMode' in defaults && !profile.backgroundImage) {
          profile.backgroundImageStretchMode = 'none';
        }
        if ('opacity' in defaults && profile.opacity === undefined) {
          profile.opacity = 100;
        }
        if ('useAcrylic' in defaults && profile.useAcrylic === undefined) {
          profile.useAcrylic = false;
        }
      }
    } else if (scope === 'project') {
      const project = path.resolve(projectPath);
      const label = `TermCute project — ${path.basename(project) || project}`;
      if (Array.isArray(settings.profiles)) {
        let profile = settings.profiles.find((p) => p?.name === label && p.startingDirectory === project);
        if (!profile) {
          profile = { name: label, startingDirectory: project };
          settings.profiles.push(profile);
        }
        applyToProfile(profile);
      } else {
        settings.profiles = settings.profiles || {};
        settings.profiles.list = settings.profiles.list || [];
        let profile = settings.profiles.list.find((p) => p?.name === label && p.startingDirectory === project);
        if (!profile) {
          profile = { name: label, startingDirectory: project };
          settings.profiles.list.push(profile);
        }
        applyToProfile(profile);
      }
    } else if (Array.isArray(settings.profiles)) {
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

  /** Apply the selected image/theme to dedicated profiles for coding agents. */
  applyAgentTheme(theme, agents) {
    this.applyTheme(theme, { scope: 'agents', agents });
  }

  /** Apply only background settings, preserving the current color scheme. */
  applyBackground(background, { timestampBackup = true } = {}) {
    if (!this.available()) throw new Error('Windows Terminal settings.json not found.');
    const raw = this.readRaw();
    ensureOriginal(this.settingsPath, raw);
    if (timestampBackup) saveTimestamped(this.settingsPath, raw);
    const settings = parseSettings(raw);
    const apply = (profile) => applyBackgroundSettings(profile, background);
    if (Array.isArray(settings.profiles)) {
      for (const profile of settings.profiles) apply(profile);
    } else {
      settings.profiles = settings.profiles || {};
      settings.profiles.defaults = settings.profiles.defaults || {};
      for (const profile of settings.profiles.list || []) {
        if (profile && typeof profile === 'object') clearBackgroundSettings(profile);
      }
      apply(settings.profiles.defaults);
    }
    this.writeJson(settings);
  }

  /** Reset selected agent profiles to Windows Terminal defaults, optionally
   * layering a custom image over that default appearance. */
  applyAgentDefault(background, agents) {
    if (!this.available()) throw new Error('Windows Terminal settings.json not found.');
    if (!agents.length) throw new Error('No agent CLIs were selected.');
    const raw = this.readRaw();
    ensureOriginal(this.settingsPath, raw);
    saveTimestamped(this.settingsPath, raw);
    const settings = parseSettings(raw);
    settings.profiles = normalizeProfiles(settings.profiles);
    const list = settings.profiles.list;
    const defaults = settings.profiles.defaults || {};

    // Remove stale TermCute Agent profiles
    purgeStaleAgentProfiles(list, agents);

    for (const agent of agents) {
      const profile = findAgentProfile(list, agent);
      neutralizeDefaults(profile, defaults, null);
      applyAgentDefaultProfile(profile, background, defaults);
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

const BACKGROUND_KEYS = ['background', 'backgroundImage', 'backgroundImageOpacity', 'backgroundImageStretchMode', 'opacity'];

function clearBackgroundSettings(profile) {
  for (const key of BACKGROUND_KEYS) delete profile[key];
}

function applyBackgroundSettings(profile, background) {
  clearBackgroundSettings(profile);
  if (background.opacity !== undefined) profile.opacity = background.opacity;
  if (!background.backgroundImage) return;
  const resolved = resolveImagePath(background.backgroundImage);
  if (!resolved) return;
  profile.backgroundImage = resolved;
  profile.backgroundImageOpacity = background.backgroundImageOpacity ?? 0.3;
  profile.backgroundImageStretchMode = background.backgroundImageStretchMode ?? 'uniformToFill';
}

function applyAgentDefaultProfile(profile, background, defaults = {}) {
  for (const key of OWNED_KEYS) delete profile[key];
  profile.colorScheme = 'Campbell';
  profile.useAcrylic = false;
  profile.padding = '0';
  profile['experimental.retroTerminalEffect'] = false;
  profile.opacity = 100;
  applyBackgroundSettings(profile, background);
  // Counteract defaults inheritance — if defaults has foreground/background/
  // backgroundImage, those will bleed into this profile unless we set explicit
  // values. Use Campbell's standard colors.
  if ('foreground' in defaults && !profile.foreground) {
    profile.foreground = '#CCCCCC';
  }
  if ('background' in defaults && !profile.background) {
    profile.background = '#0C0C0C';
  }
  if ('backgroundImage' in defaults && !profile.backgroundImage) {
    profile.backgroundImage = '';
  }
}

// ---------------------------------------------------------------------------
//  Profile matching — the critical piece for agent themes
// ---------------------------------------------------------------------------

/** Ensure settings.profiles is the { defaults, list } object form.
 *  Old-format flat arrays are normalized, and missing fields are created. */
function normalizeProfiles(profiles) {
  if (Array.isArray(profiles)) {
    return { defaults: {}, list: profiles };
  }
  const obj = profiles || {};
  obj.defaults = obj.defaults || {};
  obj.list = obj.list || [];
  return obj;
}

/** Find the *real* existing profile that a given agent CLI launches in.
 *
 *  Strategy (first match wins):
 *   1. commandline contains one of the agent's known executable names
 *      (with optional .exe/.cmd/.bat/.ps1 extension and word boundaries).
 *   2. profile name matches one of the agent's known display names
 *      (exact match or contains, case-insensitive).
 *   3. An older TermCute-created profile ("TermCute Agent — <name>") exists —
 *      re-adopt it and fix its commandline to the full executable path.
 *
 *  If absolutely nothing matches, we create a new profile with the right
 *  commandline so it actually works when opened from the WT dropdown. */
function findAgentProfile(list, agent) {
  // Priority 1: match by commandline — most reliable because this is what
  // Windows Terminal actually uses to launch the process
  const byCommand = list.find((p) => profileCommandMatchesAgent(p, agent));
  if (byCommand) return byCommand;

  // Priority 2: match by well-known profile name (e.g. "Claude Code")
  const byName = list.find((p) => profileNameMatchesAgent(p, agent));
  if (byName) return byName;

  // Priority 3: re-adopt an existing TermCute-created profile from an older
  // run — fix its commandline so it's actually launchable
  const termcuteLabel = `TermCute Agent — ${agent.name}`;
  const byLabel = list.find((p) => p?.name === termcuteLabel);
  if (byLabel) {
    fixProfileCommandline(byLabel, agent);
    return byLabel;
  }

  // Last resort: create a new profile with a proper launchable commandline.
  const commandline = resolveAgentCommandline(agent.command);
  const profile = { name: agent.name, commandline };
  list.push(profile);
  return profile;
}

/** Check if a profile's commandline references one of the agent's executables. */
function profileCommandMatchesAgent(profile, agent) {
  if (!profile || typeof profile !== 'object') return false;
  const commandline = profile.commandline;
  if (typeof commandline !== 'string') return false;

  const commands = agent.matchCommands || [agent.command];
  for (const cmd of commands) {
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the command as a whole token, optionally with an extension,
    // at the start/end of the string or surrounded by path separators,
    // quotes, or whitespace.
    const pattern = new RegExp(
      `(?:^|[\\\\/\\s"'])${escaped}(?:\\.(?:exe|cmd|bat|ps1))?(?:$|[\\\\/\\s"'])`,
      'i',
    );
    if (pattern.test(commandline)) return true;
  }
  return false;
}

/** Check if a profile's display name matches one of the agent's known names. */
function profileNameMatchesAgent(profile, agent) {
  if (!profile || typeof profile !== 'object') return false;
  if (typeof profile.name !== 'string') return false;
  const lowerName = profile.name.toLowerCase().trim();

  const names = agent.matchNames || [agent.name.toLowerCase()];
  for (const candidate of names) {
    const lower = candidate.toLowerCase();
    // Exact match
    if (lowerName === lower) return true;
    // The profile name starts with the agent name (e.g. "Claude Code (beta)")
    if (lowerName.startsWith(lower + ' ') || lowerName.startsWith(lower + '(')) return true;
  }
  return false;
}

/** Fix the commandline of a re-adopted TermCute-created profile.
 *  Old profiles had bare commands like "codex" which WT can't launch.
 *  Replace with the full resolved path. */
function fixProfileCommandline(profile, agent) {
  const resolved = resolveAgentCommandline(agent.command);
  if (resolved !== agent.command) {
    // We found the real executable — use it
    profile.commandline = resolved;
  }
}

/** Discover the full commandline for an agent executable so that a newly
 *  created profile can actually launch it from the WT dropdown.
 *
 *  On Windows, .exe files can be used directly. For .cmd/.bat/.ps1 wrappers
 *  (common for npm-installed CLIs like codex, opencode), we use the full
 *  path — Windows Terminal handles .cmd files natively. */
function resolveAgentCommandline(command) {
  if (process.platform !== 'win32') return command;
  const paths = (process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean);
  // Prefer .exe > .cmd > .bat > .ps1 > extensionless
  const extensions = ['.exe', '.cmd', '.bat', '.ps1', ''];
  for (const ext of extensions) {
    for (const dir of paths) {
      const full = path.join(dir, `${command}${ext}`);
      if (fs.existsSync(full)) return full;
    }
  }
  // Fall back to bare command — WT may still resolve it
  return command;
}

/** Remove stale "TermCute Agent — ..." profiles that are duplicates of real
 *  profiles. If a TermCute-created profile exists AND a real profile also
 *  matches the same agent, the TermCute duplicate is removed so settings
 *  aren't spread across two profiles. */
function purgeStaleAgentProfiles(list, agents) {
  const TERMCUTE_PREFIX = 'TermCute Agent — ';
  for (const agent of agents) {
    const termcuteLabel = `${TERMCUTE_PREFIX}${agent.name}`;
    const termcuteIdx = list.findIndex((p) => p?.name === termcuteLabel);
    if (termcuteIdx === -1) continue;

    // Is there also a real (non-TermCute) profile that matches this agent?
    const realMatch = list.find((p, i) =>
      i !== termcuteIdx &&
      p?.name !== termcuteLabel &&
      (profileCommandMatchesAgent(p, agent) || profileNameMatchesAgent(p, agent))
    );
    if (realMatch) {
      // The TermCute duplicate is stale — remove it
      list.splice(termcuteIdx, 1);
    }
  }
}

/** When targeting a specific profile for an agent theme, ensure that values
 *  from profiles.defaults don't bleed through and mask the intended
 *  appearance.
 *
 *  Windows Terminal inheritance: any key in profiles.defaults is inherited
 *  by every profile that doesn't explicitly set that same key. So if
 *  defaults has `backgroundImage`, `foreground`, `useAcrylic`, or `opacity`,
 *  those will silently appear on every agent profile unless we counteract
 *  them.
 *
 *  We force neutral values for every defaults key that the theme doesn't
 *  explicitly set, so the agent profile looks exactly like the theme intends. */
function neutralizeDefaults(profile, defaults, theme) {
  if (!defaults || typeof defaults !== 'object') return;

  const themeProfile = theme?.profile || {};

  for (const key of AGENT_EXPLICIT_KEYS) {
    // Skip keys the theme will explicitly set — applyToProfile handles those
    if (key in themeProfile) continue;
    // Skip keys that defaults doesn't set — nothing to neutralize
    if (!(key in defaults)) continue;

    switch (key) {
      case 'padding':
        profile[key] = '0';
        break;
      case 'experimental.retroTerminalEffect':
        profile[key] = false;
        break;
      case 'useAcrylic':
        profile[key] = false;
        break;
      case 'opacity':
        profile[key] = 100;
        break;
      case 'background':
      case 'foreground':
        // Explicit per-profile background/foreground overrides the color
        // scheme in WT. To let the theme's scheme colors show, we must
        // set them to match the scheme — or just delete any stale value
        // and set them explicitly to prevent defaults inheritance.
        if (theme?.scheme?.[key]) {
          profile[key] = theme.scheme[key];
        } else {
          // Can't delete to neutralize — WT would inherit from defaults.
          // Setting to the scheme value below in applyToProfile is best;
          // for now force an explicit value that won't mask the scheme.
          delete profile[key];
        }
        break;
      case 'backgroundImage':
        // Explicitly clear the background image to prevent the defaults
        // image from bleeding through
        profile[key] = '';
        break;
      case 'backgroundImageOpacity':
        profile[key] = 1;
        break;
      case 'backgroundImageStretchMode':
        profile[key] = 'none';
        break;
      case 'cursorShape':
        profile[key] = 'bar';
        break;
      case 'colorScheme':
        // Will be set by applyToProfile; no pre-neutralize needed
        break;
      case 'font':
        // Don't override the user's font choice unless the theme sets one
        break;
      default:
        delete profile[key];
        break;
    }
  }
}
