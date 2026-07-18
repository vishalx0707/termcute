import { hexToRgb, chars } from '../utils.js';
import { UI } from '../constants.js';
import { drawPanel } from './card.js';
import { drawButton } from './button.js';
import { easeOutBack } from '../animation/easing.js';

/**
 * Centered confirm dialog. Pops in with an easeOutBack drop (slight
 * overshoot) driven by a tween owned by the opening screen. Left/right
 * moves between options, enter confirms, esc cancels.
 */
export class Modal {
  /**
   * @param {object} opts
   * @param {string} opts.title
   * @param {string[]} opts.lines      message body
   * @param {string[]} [opts.options]
   * @param {number} [opts.defaultIndex]
   */
  constructor({ title, lines, options = ['Yes', 'No'], defaultIndex = 1 }) {
    this.title = title;
    this.lines = lines;
    this.options = options;
    this.index = defaultIndex;
    this.pop = null; // entrance tween, set by open()
  }

  /** @param {import('../animation/timeline.js').Timeline} timeline */
  open(timeline) {
    this.index = Math.min(this.index, this.options.length - 1);
    this.pop = timeline.add({ duration: 0.32, ease: easeOutBack });
  }

  /** @returns {'confirm'|'cancel'|null} */
  onKey(key) {
    if (key.name === 'left') this.index = (this.index - 1 + this.options.length) % this.options.length;
    else if (key.name === 'right' || key.name === 'tab') this.index = (this.index + 1) % this.options.length;
    else if (key.name === 'enter') return 'confirm';
    else if (key.name === 'esc') return 'cancel';
    return null;
  }

  draw(fb, time) {
    const progress = this.pop?.value ?? 1;
    const w = Math.min(fb.width - 4, Math.max(46, ...this.lines.map((l) => chars(l).length + 6)));
    const h = this.lines.length + 6;
    const x = Math.floor((fb.width - w) / 2);
    const targetY = Math.floor((fb.height - h) / 2);
    const y = Math.round(targetY - (1 - progress) * 4);

    drawPanel(fb, x, y, w, h, {
      title: this.title,
      borderColor: hexToRgb(UI.PINK),
      bgColor: hexToRgb(UI.BG_PANEL),
    });

    const bg = hexToRgb(UI.BG_PANEL);
    for (let i = 0; i < this.lines.length; i++) {
      fb.drawText(x + 3, y + 2 + i, this.lines[i], hexToRgb(UI.WHITE), bg);
    }

    let bx = x + 3;
    const by = y + h - 3;
    for (let i = 0; i < this.options.length; i++) {
      const width = drawButton(fb, bx, by, this.options[i], {
        focused: i === this.index,
        time,
        accent: i === 0 ? UI.PINK_DEEP : UI.LAVENDER,
      });
      // re-draw over panel bg so button text carries the panel surface
      fb.drawText(bx, by, `[ ${this.options[i]} ]`, fb.get(bx, by)?.fg, bg);
      bx += width + 3;
    }
  }
}
