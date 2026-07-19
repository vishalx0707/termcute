import { hslToRgb, chars } from '../utils.js';
import { fadeIn } from '../animation/fade.js';

/**
 * Shared "design layer" accents, borrowed from the TermCute wordmark design:
 * a rose→lavender gradient sweep for key text, and soft offset drop shadows
 * that make bars and panels read as layered pixel-art surfaces.
 */

/** Same living gradient the logo uses — rose at t=0 drifting to lavender at t=1. */
export function sweep(t, time = 0) {
  const drift = Math.sin(time * 0.35) * 14;
  return hslToRgb(330 + drift - t * 55, 0.82, 0.72);
}

/** Draw text with the sweep gradient running across it. */
export function gradientText(fb, x, y, text, time, { bg, reveal = 1 } = {}) {
  const glyphs = chars(text);
  const denom = Math.max(1, glyphs.length - 1);
  for (let i = 0; i < glyphs.length; i++) {
    fb.set(x + i, y, glyphs[i], fadeIn(sweep(i / denom, time), reveal), bg);
  }
}

/** Deep plum shadow tone for offset layers. */
export const SHADOW_RGB = [18, 8, 22];

/**
 * Tint the background of the cells one row below / one column right of a
 * rect — the classic offset-layer shadow from the wordmark design. Only
 * touches bg, so backdrop stars and text keep floating on top.
 */
export function dropShadow(fb, x, y, w, h) {
  for (let xx = x + 1; xx <= x + w; xx++) fb.tint(xx, y + h, undefined, SHADOW_RGB);
  for (let yy = y + 1; yy < y + h; yy++) fb.tint(x + w, yy, undefined, SHADOW_RGB);
}
