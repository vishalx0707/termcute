import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';
import { pulseRange } from '../animation/pulse.js';
import { fadeIn, dim } from '../animation/fade.js';
import { gradientText, SHADOW_RGB } from './glam.js';

/**
 * Vertical selection menu. Items fade in with staggered tweens on screen
 * enter — no horizontal sliding, so nothing ever jitters. The selected row
 * sits on a solid rose highlight bar with a softly pulsing ❯, and moves
 * cell-exact with each keypress.
 */
export class Menu {
  /** @param {{label: string, hint?: string}[]} items */
  constructor(items) {
    this.items = items;
    this.index = 0;
    /** @type {import('../animation/timeline.js').Tween[]} entrance tweens, one per item */
    this.entrances = [];
    // highlight bar spans the widest row so the bar width never jumps
    this.barWidth = Math.max(...items.map((it) => 4 + it.label.length + (it.hint ? it.hint.length + 2 : 0))) + 2;
  }

  /** @returns {boolean} true if the key moved the selection */
  onKey(key) {
    if (key.name === 'up') {
      this.index = (this.index - 1 + this.items.length) % this.items.length;
      return true;
    }
    if (key.name === 'down') {
      this.index = (this.index + 1) % this.items.length;
      return true;
    }
    return false;
  }

  selected() {
    return this.items[this.index];
  }

  /**
   * @param {import('../engine/framebuffer.js').Framebuffer} fb
   * @param {number} x left edge of the ❯ column
   */
  draw(fb, x, y, time) {
    const pink = hexToRgb(UI.PINK);
    const selBg = hexToRgb(UI.SEL_BG);

    // offset shadow layer under the highlight bar (bg only, drawn first so
    // the next row's label floats over it) — the wordmark's layered look
    for (let sx = x; sx < x - 1 + this.barWidth + 1; sx++) {
      fb.tint(sx, y + this.index + 1, undefined, SHADOW_RGB);
    }

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const progress = this.entrances[i]?.value ?? 1;
      const iy = y + i;

      if (i === this.index) {
        const glow = pulseRange(time, 0.6, 1, 2.4);
        fb.fillRect(x - 1, iy, this.barWidth, 1, ' ', null, selBg);
        fb.drawText(x, iy, '❯', dim(UI.PINK_DEEP, glow), selBg)
        gradientText(fb, x + 2, iy, item.label, time, { bg: selBg, reveal: progress });
        if (item.hint) {
          fb.drawText(x + 2 + item.label.length + 2, iy, item.hint, dim(UI.PINK_SOFT, 0.55), selBg);
        }
      } else {
        fb.drawText(x + 2, iy, item.label, fadeIn(dim(pink, 0.5), progress));
      }
    }
  }
}
