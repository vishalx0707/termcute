/**
 * Flushes a framebuffer to stdout as a single write per frame.
 * Uses the alternate screen buffer so the user's scrollback survives, and
 * run-length groups color changes so a 120×40 frame stays a few KB.
 */

const ESC = '\x1b';

export class Renderer {
  constructor(stream = process.stdout) {
    this.stream = stream;
    this.active = false;
    this.backpressured = false;
  }

  enter() {
    if (this.active) return;
    this.active = true;
    // alt screen, hide cursor, disable line wrap (a glyph in the last column
    // must never push the terminal into scrolling a line)
    this.stream.write(`${ESC}[?1049h${ESC}[?25l${ESC}[?7l${ESC}[2J`);
  }

  leave() {
    if (!this.active) return;
    this.active = false;
    this.stream.write(`${ESC}[?7h${ESC}[0m${ESC}[?25h${ESC}[?1049l`);
  }

  /** @param {import('./framebuffer.js').Framebuffer} fb */
  render(fb) {
    // Never queue stale frames behind a slow terminal. The next loop paints
    // the newest state, keeping cursor movement responsive under load.
    if (!this.active || this.backpressured) return;
    // DECSET 2026 (synchronized output): the terminal repaints the frame as
    // one atomic update instead of mid-write — kills flicker/tearing that
    // reads as "the selection shakes". Ignored by terminals without support.
    const chunks = [`${ESC}[?2026h`];
    let curFg = undefined;
    let curBg = undefined;

    for (let y = 0; y < fb.height; y++) {
      chunks.push(`${ESC}[${y + 1};1H`);
      for (let x = 0; x < fb.width; x++) {
        const cell = fb.cells[y * fb.width + x];
        const fgKey = cell.fg ? (cell.fg[0] << 16) | (cell.fg[1] << 8) | cell.fg[2] : -1;
        const bgKey = cell.bg ? (cell.bg[0] << 16) | (cell.bg[1] << 8) | cell.bg[2] : -1;
        if (fgKey !== curFg) {
          chunks.push(fgKey === -1 ? `${ESC}[39m` : `${ESC}[38;2;${cell.fg[0]};${cell.fg[1]};${cell.fg[2]}m`);
          curFg = fgKey;
        }
        if (bgKey !== curBg) {
          chunks.push(bgKey === -1 ? `${ESC}[49m` : `${ESC}[48;2;${cell.bg[0]};${cell.bg[1]};${cell.bg[2]}m`);
          curBg = bgKey;
        }
        chunks.push(cell.ch);
      }
    }
    chunks.push(`${ESC}[0m${ESC}[?2026l`);
    if (!this.stream.write(chunks.join(''))) {
      this.backpressured = true;
      this.stream.once('drain', () => { this.backpressured = false; });
    }
  }
}
