import { easeOutCubic } from './easing.js';

/**
 * The single tween system every choreographed motion runs on. Screens create
 * one Timeline, add tweens on enter (with staggered delays), and call
 * update(dt) each frame. Reading `.value` of a tween gives its current eased
 * value — draw code stays declarative and never manages its own timers.
 */
export class Timeline {
  constructor() {
    /** @type {Tween[]} */
    this.tweens = [];
  }

  /**
   * @param {object} opts
   * @param {number} [opts.from]
   * @param {number} [opts.to]
   * @param {number} opts.duration  seconds
   * @param {number} [opts.delay]   seconds before starting (stagger tool)
   * @param {(t: number) => number} [opts.ease]
   * @param {boolean} [opts.yoyo]   ping-pong forever
   * @param {() => void} [opts.onComplete]
   * @returns {Tween}
   */
  add({ from = 0, to = 1, duration, delay = 0, ease = easeOutCubic, yoyo = false, onComplete } = {}) {
    const tween = new Tween(from, to, duration, delay, ease, yoyo, onComplete);
    this.tweens.push(tween);
    return tween;
  }

  update(dt) {
    for (const tween of this.tweens) tween.update(dt);
    this.tweens = this.tweens.filter((t) => !t.done || t.yoyo);
  }

  clear() {
    this.tweens = [];
  }
}

export class Tween {
  constructor(from, to, duration, delay, ease, yoyo, onComplete) {
    this.from = from;
    this.to = to;
    this.duration = Math.max(duration, 0.0001);
    this.delay = delay;
    this.ease = ease;
    this.yoyo = yoyo;
    this.onComplete = onComplete;
    this.elapsed = 0;
    this.done = false;
    this.value = from;
  }

  update(dt) {
    if (this.done && !this.yoyo) return;
    this.elapsed += dt;
    let t = (this.elapsed - this.delay) / this.duration;
    if (t <= 0) {
      this.value = this.from;
      return;
    }
    if (this.yoyo) {
      const cycle = t % 2;
      t = cycle <= 1 ? cycle : 2 - cycle;
    } else if (t >= 1) {
      t = 1;
      if (!this.done) {
        this.done = true;
        this.onComplete?.();
      }
    }
    this.value = this.from + (this.to - this.from) * this.ease(t);
  }
}
