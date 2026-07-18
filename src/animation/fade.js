import { hexToRgb, lerpColor } from '../utils.js';

/**
 * Terminal cells have no opacity, so "fading" means blending a color toward
 * the backdrop. progress 0 → invisible (backdrop), 1 → full color.
 */

const BACKDROP = [10, 8, 14]; // effectively the app's black

/** @param {string|number[]} color @param {number} progress 0..1 */
export function fadeIn(color, progress) {
  const rgb = typeof color === 'string' ? hexToRgb(color) : color;
  const t = Math.max(0, Math.min(1, progress));
  return lerpColor(BACKDROP, rgb, t);
}

/** Dim a color to a fraction of its brightness (hover-away items, hints). */
export function dim(color, amount) {
  const rgb = typeof color === 'string' ? hexToRgb(color) : color;
  return lerpColor(BACKDROP, rgb, amount);
}
