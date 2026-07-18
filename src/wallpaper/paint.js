import { hexToRgb, clamp } from '../utils.js';

/**
 * A tiny software canvas the wallpaper designs paint on. Float RGB per
 * pixel so soft alpha layering doesn't band, converted to bytes at the end.
 * All shapes loop only their bounding box — a full wallpaper renders in
 * well under a second.
 */

export class Canvas {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.data = new Float32Array(width * height * 3);
  }

  /** Deterministic PRNG so every user gets the same artwork. */
  static rng(seed) {
    let s = seed >>> 0;
    return () => {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  blend(x, y, [r, g, b], a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 3;
    this.data[i] += (r - this.data[i]) * a;
    this.data[i + 1] += (g - this.data[i + 1]) * a;
    this.data[i + 2] += (b - this.data[i + 2]) * a;
  }

  /** Vertical gradient. stops: [[t0, '#hex'], [t1, '#hex'], ...] sorted by t. */
  vGradient(stops) {
    const parsed = stops.map(([t, c]) => [t, typeof c === 'string' ? hexToRgb(c) : c]);
    for (let y = 0; y < this.h; y++) {
      const t = y / (this.h - 1);
      let lo = parsed[0];
      let hi = parsed[parsed.length - 1];
      for (let i = 0; i < parsed.length - 1; i++) {
        if (t >= parsed[i][0] && t <= parsed[i + 1][0]) { lo = parsed[i]; hi = parsed[i + 1]; break; }
      }
      const f = hi[0] === lo[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
      const r = lo[1][0] + (hi[1][0] - lo[1][0]) * f;
      const g = lo[1][1] + (hi[1][1] - lo[1][1]) * f;
      const b = lo[1][2] + (hi[1][2] - lo[1][2]) * f;
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 3;
        this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b;
      }
    }
  }

  /** Radial gradient from center color out to edge color. */
  radial(cx, cy, radius, inner, outer) {
    const ic = typeof inner === 'string' ? hexToRgb(inner) : inner;
    const oc = typeof outer === 'string' ? hexToRgb(outer) : outer;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = Math.min(1, Math.hypot(x - cx, y - cy) / radius);
        const f = t * t * (3 - 2 * t); // smoothstep
        const i = (y * this.w + x) * 3;
        this.data[i] = ic[0] + (oc[0] - ic[0]) * f;
        this.data[i + 1] = ic[1] + (oc[1] - ic[1]) * f;
        this.data[i + 2] = ic[2] + (oc[2] - ic[2]) * f;
      }
    }
  }

  /** Soft-edged glowing circle (bokeh). */
  blob(cx, cy, r, color, alpha) {
    const c = typeof color === 'string' ? hexToRgb(color) : color;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        const fall = 1 - d * d;
        this.blend(x, y, c, alpha * fall * fall);
      }
    }
  }

  /** Soft ring — a bokeh circle bright at the rim (glass bubbles). */
  ring(cx, cy, r, thickness, color, alpha) {
    const c = typeof color === 'string' ? hexToRgb(color) : color;
    const x0 = Math.max(0, Math.floor(cx - r - thickness));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r + thickness));
    const y0 = Math.max(0, Math.floor(cy - r - thickness));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r + thickness));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.abs(Math.hypot(x - cx, y - cy) - r) / thickness;
        if (d >= 1) continue;
        this.blend(x, y, c, alpha * (1 - d) * (1 - d));
      }
    }
  }

  /** Filled rotated ellipse with a soft edge (petals). */
  petal(cx, cy, rx, ry, angle, color, alpha) {
    const c = typeof color === 'string' ? hexToRgb(color) : color;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rmax = Math.max(rx, ry) + 1;
    const x0 = Math.max(0, Math.floor(cx - rmax));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rmax));
    const y0 = Math.max(0, Math.floor(cy - rmax));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + rmax));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const u = (dx * cos + dy * sin) / rx;
        const v = (-dx * sin + dy * cos) / ry;
        const d = u * u + v * v;
        if (d >= 1) continue;
        this.blend(x, y, c, alpha * Math.min(1, (1 - d) * 3));
      }
    }
  }

  /** Filled heart (implicit curve), pointing down, soft-edged. */
  heart(cx, cy, size, color, alpha) {
    const c = typeof color === 'string' ? hexToRgb(color) : color;
    const x0 = Math.max(0, Math.floor(cx - size * 1.3));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + size * 1.3));
    const y0 = Math.max(0, Math.floor(cy - size * 1.3));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + size * 1.3));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const u = (x - cx) / size;
        const v = -(y - cy) / size + 0.25;
        const q = u * u + v * v - 1;
        const f = q * q * q - u * u * v * v * v;
        if (f < 0) this.blend(x, y, c, alpha);
      }
    }
  }

  /** Straight line with width and soft edges. */
  line(x0, y0, x1, y1, width, color, alpha) {
    const c = typeof color === 'string' ? hexToRgb(color) : color;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    const pad = width + 1;
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - pad));
    const bx1 = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1) + pad));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1) - pad));
    const by1 = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1) + pad));
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        const t = clamp(((x - x0) * dx + (y - y0) * dy) / len2, 0, 1);
        const d = Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
        if (d >= width) continue;
        this.blend(x, y, c, alpha * (1 - (d / width) ** 2));
      }
    }
  }

  /** Full-width horizontal rule (fast path for ruled paper). */
  hLine(y, width, color, alpha) {
    const c = typeof color === 'string' ? hexToRgb(color) : color;
    for (let dy = -Math.ceil(width); dy <= Math.ceil(width); dy++) {
      const yy = Math.round(y) + dy;
      if (yy < 0 || yy >= this.h) continue;
      const a = alpha * Math.max(0, 1 - (Math.abs(dy) / width) ** 2);
      if (a <= 0) continue;
      for (let x = 0; x < this.w; x++) this.blend(x, yy, c, a);
    }
  }

  /** Darken toward the edges. */
  vignette(strength) {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = Math.hypot(x - cx, y - cy) / maxD;
        const f = 1 - strength * d * d;
        const i = (y * this.w + x) * 3;
        this.data[i] *= f; this.data[i + 1] *= f; this.data[i + 2] *= f;
      }
    }
  }

  /** Per-pixel grain — makes flat fills feel like paper, not plastic. */
  grain(amount, seed = 7) {
    const rand = Canvas.rng(seed);
    for (let i = 0; i < this.data.length; i += 3) {
      const n = (rand() - 0.5) * 2 * amount;
      this.data[i] += n; this.data[i + 1] += n; this.data[i + 2] += n;
    }
  }

  toBytes() {
    const out = new Uint8Array(this.w * this.h * 3);
    for (let i = 0; i < out.length; i++) out[i] = clamp(Math.round(this.data[i]), 0, 255);
    return out;
  }
}
