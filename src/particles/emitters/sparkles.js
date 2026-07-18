import { hexToRgb, lerpColor } from '../../utils.js';

/**
 * Celebration burst — fired when a theme is applied. Radial spray of stars
 * with a touch of gravity; each sparkle decays through glyph sizes
 * (✦ → ✧ → · ) as its life runs out, which reads as a twinkle-out.
 */

const STAGES = ['✦', '✧', '*', '·'];
const COLORS = ['#ffd479', '#ff9ec7', '#f5f0f4', '#b49cff'].map(hexToRgb);
const DEATH = [40, 30, 50];

export class SparkleEmitter {
  constructor() {
    this.pending = [];
  }

  /** Queue a burst at cell (x, y). */
  burst(x, y, count = 26) {
    this.pending.push({ x, y, count });
  }

  update(dt, time, engine) {
    for (const b of this.pending) {
      for (let i = 0; i < b.count; i++) {
        const angle = (i / b.count) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 4 + Math.random() * 14;
        const base = COLORS[Math.floor(Math.random() * COLORS.length)];
        const maxLife = 0.5 + Math.random() * 0.7;
        engine.spawn({
          kind: 'sparkle',
          x: b.x,
          y: b.y,
          vx: Math.cos(angle) * speed * 1.8, // cells are ~2× taller than wide
          vy: Math.sin(angle) * speed * 0.8,
          life: maxLife,
          maxLife,
          glyph: STAGES[0],
          color: base,
          base,
          phase: 0,
          update: (p, pdt) => {
            p.vy += 6 * pdt; // gravity
            p.vx *= 1 - 1.5 * pdt; // drag
            const t = 1 - p.life / p.maxLife;
            p.glyph = STAGES[Math.min(STAGES.length - 1, Math.floor(t * STAGES.length))];
            p.color = lerpColor(p.base, DEATH, t * t);
          },
        });
      }
    }
    this.pending = [];
  }
}
