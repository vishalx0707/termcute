import { FRAME_MS } from '../constants.js';

/**
 * Fixed-rate render loop with drift correction. Calls `tick(dt, time)` where
 * dt is seconds since last frame and time is seconds since start — every
 * animation in the app derives from these two numbers so all motion shares
 * one clock.
 */
export class Loop {
  /** @param {(dt: number, time: number) => void} tick */
  constructor(tick) {
    this.tick = tick;
    this.timer = null;
    this.running = false;
    this.time = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const step = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1); // clamp hitches so tweens never jump
      last = now;
      this.time += dt;
      this.tick(dt, this.time);
      const elapsed = performance.now() - now;
      this.timer = setTimeout(step, Math.max(0, FRAME_MS - elapsed));
    };
    step();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
