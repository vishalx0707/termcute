import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';

/**
 * Bordered panel with rounded corners. Interiors are filled with opaque
 * spaces so panels blot out the sakura layer behind them — panels read as
 * solid surfaces floating over the particle field.
 */

/**
 * @param {import('../engine/framebuffer.js').Framebuffer} fb
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {number[]} [opts.borderColor]
 * @param {number[]|null} [opts.bgColor]
 */
export function drawPanel(fb, x, y, w, h, { title, borderColor, bgColor } = {}) {
  const border = borderColor ?? hexToRgb(UI.DIMMER);
  const bg = bgColor ?? hexToRgb(UI.BG_PANEL);

  fb.fillRect(x + 1, y + 1, w - 2, h - 2, ' ', null, bg);

  fb.set(x, y, '╭', border, bg);
  fb.set(x + w - 1, y, '╮', border, bg);
  fb.set(x, y + h - 1, '╰', border, bg);
  fb.set(x + w - 1, y + h - 1, '╯', border, bg);
  for (let i = 1; i < w - 1; i++) {
    fb.set(x + i, y, '─', border, bg);
    fb.set(x + i, y + h - 1, '─', border, bg);
  }
  for (let i = 1; i < h - 1; i++) {
    fb.set(x, y + i, '│', border, bg);
    fb.set(x + w - 1, y + i, '│', border, bg);
  }

  if (title) {
    const label = ` ${title} `;
    fb.drawText(x + 2, y, label, hexToRgb(UI.PINK), bg);
  }
}
