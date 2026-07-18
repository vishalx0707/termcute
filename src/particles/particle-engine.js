/**
 * Generic particle pool. Emitters own spawning and per-particle behavior;
 * the engine owns the update/cull/draw lifecycle. Particles live in float
 * space and snap to cells only at draw time, which is what makes drift look
 * smooth instead of steppy.
 */
export class ParticleEngine {
  constructor() {
    /** @type {import('../types.js').Particle[]} */
    this.particles = [];
    /** @type {Array<{update: (dt: number, time: number, engine: ParticleEngine, bounds: {width: number, height: number}) => void}>} */
    this.emitters = [];
  }

  addEmitter(emitter) {
    this.emitters.push(emitter);
    return emitter;
  }

  spawn(particle) {
    this.particles.push(particle);
  }

  update(dt, time, bounds) {
    for (const emitter of this.emitters) emitter.update(dt, time, this, bounds);
    const alive = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.update?.(p, dt, time);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > bounds.height + 2 || p.x < -4 || p.x > bounds.width + 4) continue;
      alive.push(p);
    }
    this.particles = alive;
  }

  /**
   * Draw all particles. Never overwrites a cell something already drew to
   * (glyph !== ' ') so particles slip *behind* text drawn earlier in the
   * frame — but in practice we draw particles first and let UI overwrite.
   * @param {import('../engine/framebuffer.js').Framebuffer} fb
   */
  draw(fb) {
    for (const p of this.particles) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      fb.set(x, y, p.glyph, p.color);
    }
  }

  clear() {
    this.particles = [];
  }
}
