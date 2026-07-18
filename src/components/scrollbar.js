import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';

/**
 * Minimal vertical scrollbar for lists taller than their viewport.
 * Invisible when everything fits — chrome should never advertise itself.
 */
export function drawScrollbar(fb, x, y, height, total, visible, offset) {
  if (total <= visible) return;
  const track = hexToRgb(UI.DIMMER);
  const thumbColor = hexToRgb(UI.PINK);
  const thumbSize = Math.max(1, Math.round((visible / total) * height));
  const thumbPos = Math.round((offset / (total - visible)) * (height - thumbSize));
  for (let i = 0; i < height; i++) {
    const isThumb = i >= thumbPos && i < thumbPos + thumbSize;
    fb.set(x, y + i, isThumb ? '┃' : '│', isThumb ? thumbColor : track);
  }
}
