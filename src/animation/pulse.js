import { sine01 } from './easing.js';

/**
 * Continuous sine pulse driven by global time — used for the selection
 * cursor ❯, key hints, and the "live" dot. Returns 0..1.
 * @param {number} time  seconds (from the Loop clock)
 * @param {number} speed cycles feel: ~2.5 is a calm heartbeat
 * @param {number} phase offset so neighbors don't pulse in sync
 */
export function pulse(time, speed = 2.5, phase = 0) {
  return sine01(time * speed + phase);
}

/** Pulse mapped into [lo, hi] — handy for blending brightness. */
export function pulseRange(time, lo, hi, speed = 2.5, phase = 0) {
  return lo + (hi - lo) * pulse(time, speed, phase);
}
