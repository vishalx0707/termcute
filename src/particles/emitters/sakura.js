import { hexToRgb } from '../../utils.js';

/**
 * Falling sakura petals: spawn above the top edge, fall with sinusoidal
 * flutter, and ride a slow global wind that gusts left and right. Density
 * scales with terminal width so wide windows don't look sparse.
 *
 * Glyphs are all single-cell-width on Windows Terminal — no emoji, which
 * are double-width and would shear every row to the right of a petal.
 */

const GLYPHS = ['❀', '✿', '✽', '❁', '*', '·', '˚'];
const SHADES = ['#ffb7d5', '#ff9ec7', '#ffd1e3', '#f7a8c9', '#e891b5', '#ffc4dd'].map(hexToRgb);

export class SakuraEmitter {
  /** @param {object} [opts] @param {number} [opts.density] petals per 10 columns on screen */
  constructor({ density = 1.1 } = {}) {
    this.density = density;
    this.accumulator = 0;
  }

  update(dt, time, engine, bounds) {
    // wind: two slow sines layered so gusts feel irregular, not metronomic
    const wind = Math.sin(time * 0.23) * 2.2 + Math.sin(time * 0.71 + 2) * 1.1;

    const target = (bounds.width / 10) * this.density;
    const current = engine.particles.filter((p) => p.kind === 'sakura').length;
    const rate = current < target ? (target - current) * 0.7 : 0.15;
    this.accumulator += rate * dt;

    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      const depth = Math.random(); // far petals: slower, dimmer, smaller glyphs
      engine.spawn({
        kind: 'sakura',
        x: Math.random() * bounds.width,
        y: -1 - Math.random() * 3,
        vx: 0,
        vy: 1.6 + depth * 3.4,
        life: 60,
        maxLife: 60,
        glyph: depth > 0.45 ? GLYPHS[Math.floor(Math.random() * 4)] : GLYPHS[4 + Math.floor(Math.random() * 3)],
        color: SHADES[Math.floor(Math.random() * SHADES.length)].map((c) => Math.round(c * (0.45 + depth * 0.55))),
        phase: Math.random() * Math.PI * 2,
        flutter: 0.8 + Math.random() * 1.6,
        depth,
        update: (p, pdt, ptime) => {
          p.vx = Math.sin(ptime * p.flutter + p.phase) * (0.8 + p.depth * 1.4) + wind * (0.4 + p.depth * 0.6);
        },
      });
    }
  }
}
