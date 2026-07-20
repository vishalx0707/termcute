import fs from 'node:fs';
import path from 'node:path';
import { THEMES_DIR } from '../constants.js';
import { validateTheme } from './validator.js';

/**
 * Loads every themes/*.json, validates each, and returns them in a stable
 * curated order. An invalid theme file throws at startup — better a clear
 * error at launch than a broken palette applied to someone's terminal.
 */

const ORDER = [
  'retro-crt', 'retro-amber', 'retro-commodore', 'retro-pipboy', 'retro-cyberpunk',
  'liquid-glass', 'notes', 'ocean', 'matcha', 'minimal', 'amoled',
];

/** @returns {import('../types.js').Theme[]} */
export function loadThemes() {
  const files = fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith('.json'));
  const themes = [];
  for (const file of files) {
    const full = path.join(THEMES_DIR, file);
    let theme;
    try {
      theme = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (err) {
      throw new Error(`themes/${file} is not valid JSON: ${err.message}`);
    }
    const problems = validateTheme(theme, `themes/${file}`);
    if (problems.length) throw new Error(`Invalid theme:\n  ${problems.join('\n  ')}`);
    themes.push(theme);
  }
  themes.sort((a, b) => {
    const ia = ORDER.indexOf(a.slug);
    const ib = ORDER.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
  });
  return themes;
}
