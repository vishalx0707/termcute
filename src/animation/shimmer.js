import { lerpColor } from '../utils.js';

/**
 * A bright band that sweeps across a horizontal span on a loop — the effect
 * that makes the logo gradient feel alive. Returns per-column brightness.
 */

/**
 * @param {number} time  global seconds
 * @param {number} width span width in cells
 * @param {object} [opts]
 * @returns {(x: number) => number} brightness boost 0..1 for column x
 */
export function shimmerBand(time, width, { span = 14, speed = 26, pause = 1.6 } = {}) {
  const travel = width + span * 2;
  const period = travel / speed + pause;
  const t = time % period;
  const head = t * speed - span;
  return (x) => {
    const d = Math.abs(x - head);
    if (d >= span) return 0;
    const v = 1 - d / span;
    return v * v; // sharper core, soft edges
  };
}

/** Apply a shimmer boost to a color by blending toward white. */
export function boost(color, amount) {
  if (amount <= 0) return color;
  return lerpColor(color, [255, 255, 255], amount * 0.85);
}
