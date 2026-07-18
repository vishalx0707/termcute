import { chars } from '../utils.js';

/**
 * A width×height grid of cells (char + fg + bg). Everything draws into this,
 * then the renderer flushes it to the terminal in one write per frame.
 * Draw order is painter's algorithm: later draws overwrite earlier ones,
 * which is how UI panels sit on top of the sakura particles.
 */
export class Framebuffer {
  constructor(width, height) {
    this.resize(width, height);
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    /** @type {import('../types.js').Cell[]} */
    this.cells = new Array(this.width * this.height);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = { ch: ' ', fg: null, bg: null };
    }
  }

  clear() {
    for (const cell of this.cells) {
      cell.ch = ' ';
      cell.fg = null;
      cell.bg = null;
    }
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** bg=undefined keeps the existing cell background (so text and particles
   *  float over the backdrop gradient); pass null to explicitly clear it. */
  set(x, y, ch, fg = null, bg = undefined) {
    if (!this.inBounds(x, y)) return;
    const cell = this.cells[y * this.width + x];
    cell.ch = ch;
    cell.fg = fg;
    if (bg !== undefined) cell.bg = bg;
  }

  /** Set only colors, keeping the glyph (used by shimmer/fade passes). */
  tint(x, y, fg, bg) {
    if (!this.inBounds(x, y)) return;
    const cell = this.cells[y * this.width + x];
    if (fg !== undefined) cell.fg = fg;
    if (bg !== undefined) cell.bg = bg;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y * this.width + x];
  }

  /**
   * Draw a string. Spaces are drawn (opaque) unless `transparentSpaces` —
   * opaque spaces are what let panels blot out particles behind them.
   */
  drawText(x, y, text, fg = null, bg = undefined, { transparentSpaces = false } = {}) {
    const glyphs = chars(text);
    for (let i = 0; i < glyphs.length; i++) {
      if (transparentSpaces && glyphs[i] === ' ') continue;
      this.set(x + i, y, glyphs[i], fg, bg);
    }
  }

  fillRect(x, y, w, h, ch = ' ', fg = null, bg = undefined) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        this.set(xx, yy, ch, fg, bg);
      }
    }
  }
}
