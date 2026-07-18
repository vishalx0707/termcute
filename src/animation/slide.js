/**
 * Slide-in offsets. A tween's value (0..1) maps to a pixel offset from
 * `distance` cells away down to 0. Rounded because cells are integers.
 */
export function slideOffset(progress, distance) {
  return Math.round((1 - Math.max(0, Math.min(1, progress))) * distance);
}

/** Stagger helper: delay for the i-th item entering a list. */
export function stagger(i, step = 0.06, base = 0) {
  return base + i * step;
}
