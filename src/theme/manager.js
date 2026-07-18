import { loadThemes } from './loader.js';

/**
 * Shared theme state: the loaded catalog, which theme is currently applied
 * to Windows Terminal, and lookup helpers. Screens read from here instead of
 * each re-loading the catalog.
 */
export class ThemeManager {
  /** @param {import('../wt/adapter.js').WTAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
    /** @type {import('../types.js').Theme[]} */
    this.themes = loadThemes();
    this.refreshActive();
  }

  /** Detect the applied theme by matching WT's active scheme name to ours. */
  refreshActive() {
    const schemeName = this.adapter.available() ? this.adapter.activeSchemeName() : null;
    this.activeSlug = this.themes.find((t) => t.scheme.name === schemeName)?.slug ?? null;
    if (!this.activeSlug && schemeName) this.activeSlug = 'custom';
    return this.activeSlug;
  }

  bySlug(slug) {
    return this.themes.find((t) => t.slug === slug) ?? null;
  }
}
