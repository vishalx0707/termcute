/**
 * Keeps the framebuffer sized to the terminal. On resize the frame is
 * reallocated and a full clear+redraw happens on the next tick, so screens
 * never need to think about stale dimensions.
 */
export class ResizeWatcher {
  /**
   * @param {import('./framebuffer.js').Framebuffer} fb
   * @param {() => void} [onResize] extra work after realloc (e.g. re-run layout)
   */
  constructor(fb, onResize) {
    this.fb = fb;
    this.onResize = onResize;
    this.handler = () => {
      const { width, height } = size();
      this.fb.resize(width, height);
      this.onResize?.();
    };
  }

  start() {
    process.stdout.on('resize', this.handler);
  }

  stop() {
    process.stdout.off('resize', this.handler);
  }
}

export function size() {
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  };
}
