import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';
import { pulseRange } from '../animation/pulse.js';
import { dim } from '../animation/fade.js';

/**
 * A focusable action row — used by the custom-theme editor and modals.
 * Focused buttons breathe (pulse) so the active control is unmistakable
 * even on a busy screen.
 */
export function drawButton(fb, x, y, label, { focused = false, time = 0, accent = UI.PINK_DEEP } = {}) {
  const text = `[ ${label} ]`;
  if (focused) {
    const glow = pulseRange(time, 0.7, 1, 3);
    fb.drawText(x, y, text, dim(accent, glow));
  } else {
    fb.drawText(x, y, text, dim(hexToRgb(UI.DIM), 0.9));
  }
  return text.length;
}
