import { hexToRgb } from '../utils.js';

/**
 * Validates a theme JSON before it gets anywhere near settings.json.
 * A malformed theme must fail loudly at load time with a message that names
 * the file and the field — never as a silent corruption of the user's terminal.
 */

const SCHEME_COLOR_KEYS = [
  'background', 'foreground', 'cursorColor', 'selectionBackground',
  'black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
  'brightBlue', 'brightPurple', 'brightCyan', 'brightWhite',
];

/** @returns {string[]} problems (empty = valid) */
export function validateTheme(theme, source = 'theme') {
  const problems = [];
  const bad = (msg) => problems.push(`${source}: ${msg}`);

  if (!theme || typeof theme !== 'object') return [`${source}: not an object`];
  if (typeof theme.slug !== 'string' || !/^[a-z0-9-]+$/.test(theme.slug)) bad('missing/invalid "slug" (kebab-case)');
  if (typeof theme.name !== 'string' || !theme.name.trim()) bad('missing "name"');
  if (typeof theme.description !== 'string') bad('missing "description"');

  if (!theme.scheme || typeof theme.scheme !== 'object') {
    bad('missing "scheme"');
  } else {
    if (typeof theme.scheme.name !== 'string') bad('scheme is missing "name"');
    for (const key of SCHEME_COLOR_KEYS) {
      if (!hexToRgb(theme.scheme[key])) bad(`scheme.${key} is not a valid hex color (got ${JSON.stringify(theme.scheme[key])})`);
    }
  }

  if (!theme.profile || typeof theme.profile !== 'object') {
    bad('missing "profile"');
  } else {
    const p = theme.profile;
    if (typeof p.opacity !== 'number' || p.opacity < 0 || p.opacity > 100) bad('profile.opacity must be 0-100');
    if (typeof p.useAcrylic !== 'boolean') bad('profile.useAcrylic must be boolean');
    if (typeof p.cursorShape !== 'string') bad('profile.cursorShape missing');
    if (typeof p.padding !== 'string') bad('profile.padding must be a string like "12"');
  }

  return problems;
}
