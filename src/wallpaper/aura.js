import { Canvas } from './paint.js';
import { hexToRgb } from '../utils.js';

/**
 * AURA v2 — a luminous light-field engine shared verbatim with the browser
 * player. A scalar energy field of a few huge soft lobes is tone-mapped
 * through a filmic knee and read out of a palette LUT (warm-dark shadow →
 * peak-saturation mid → blush highlight washing to white). Reeded designs
 * add region-masked vertical flutes; every design gets fine monochrome grain.
 * All coordinates are normalized (x,y in [0,1]); nothing here is a perfect
 * circle thanks to a low-frequency domain warp.
 */

/** Canvas.rng-style integer hash of three ints → float in [0,1). */
function hash3(seed, ix, iy) {
  let s = (seed ^ Math.imul(ix | 0, 0x9e3779b1) ^ Math.imul(iy | 0, 0x85ebca77)) >>> 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** One octave of value noise: bilinear lattice with smoothstep fade. */
function octave(seed, x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash3(seed, ix, iy);
  const b = hash3(seed, ix + 1, iy);
  const c = hash3(seed, ix, iy + 1);
  const d = hash3(seed, ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Two-octave deterministic value noise in [0,1]. Shared by Node and browser. */
export function vnoise(seed, x, y) {
  return 0.65 * octave(seed, x, y) + 0.35 * octave(seed + 8191, x * 2, y * 2);
}

/** Piecewise-linear RGB LUT over sorted stops [[t,[r,g,b]],...]; s in [0,1]. */
function lutSample(lut, s) {
  let lo = lut[0], hi = lut[lut.length - 1];
  for (let i = 0; i < lut.length - 1; i++) {
    if (s >= lut[i][0] && s <= lut[i + 1][0]) { lo = lut[i]; hi = lut[i + 1]; break; }
  }
  const f = hi[0] === lo[0] ? 0 : (s - lo[0]) / (hi[0] - lo[0]);
  const a = lo[1], b = hi[1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Render a design spec to a Canvas.
 * @param {object} spec  entry from AURA_SPECS
 * @param {number} w, @param {number} h  pixel dimensions
 * @param {number} t  loop phase in [0,1); t=0 for static PNGs
 */
export function paintAura(spec, w, h, t = 0) {
  const c = new Canvas(w, h);
  const ar = w / h; // aspect correction keeps lobes round in pixel space
  const lut = spec.lut.map(([s, hex]) => [s, hexToRgb(hex)]);
  const reeded = spec.family === 'reeded';
  const pitch = reeded ? spec.pitch * (w / 1600) : 0;
  const ph = 2 * Math.PI * t;
  const lobes = spec.lobes.map((l) => ({
    cx: l.x + (l.ox || 0) * Math.cos(ph + (l.ph || 0)),
    cy: l.y + (l.oy || 0) * Math.sin(ph + (l.ph || 0)),
    ir2: 1 / (l.r * l.r),
    a: l.a,
  }));
  const g = spec.grain;
  for (let py = 0; py < h; py++) {
    const ny = py / h;
    for (let px = 0; px < w; px++) {
      const nx = px / w;
      // low-frequency domain warp — nothing stays a perfect circle
      const x = nx + spec.warp * (vnoise(spec.seed + 101, nx * 3, ny * 3) - 0.5) * 2;
      const y = ny + spec.warp * (vnoise(spec.seed + 211, nx * 3, ny * 3) - 0.5) * 2;
      // scalar energy field from overlapping soft lobes
      let E = 0;
      for (let i = 0; i < lobes.length; i++) {
        const lb = lobes[i];
        const dx = (x - lb.cx) * ar;
        const dy = y - lb.cy;
        E += lb.a * Math.exp(-3 * (dx * dx + dy * dy) * lb.ir2);
      }
      // filmic knee + palette LUT
      let L = 1 - Math.exp(-E * spec.knee);
      if (L < 0) L = 0; else if (L > 0.99999) L = 0.99999;
      const col = lutSample(lut, L);
      let r = col[0], gg = col[1], b = col[2];
      // region-masked vertical flutes (reeded family)
      if (reeded) {
        const fp = (px / pitch) - Math.floor(px / pitch);
        const bright = Math.exp(-((fp - 0.16) ** 2) / 0.0045);
        const dark = Math.exp(-((fp - 0.62) ** 2) / 0.018);
        const m = smoothstep(0.25, 0.75, vnoise(spec.seed + 307, x * 2.2, y * 2.2));
        const lum = (0.299 * r + 0.587 * gg + 0.114 * b) / 255;
        const gain = 1 + spec.strength * m * (bright * (0.35 + 1.05 * lum) - dark * (0.25 + 0.55 * lum));
        r *= gain; gg *= gain; b *= gain;
      }
      // uniform fine monochrome grain (never animates)
      const n = (hash3(spec.seed + 401, px, py) - 0.5) * 2 * g;
      const idx = (py * w + px) * 3;
      c.data[idx] = r + n;
      c.data[idx + 1] = gg + n;
      c.data[idx + 2] = b + n;
    }
  }
  return c;
}

/**
 * The 16 design specs. Reeded designs carry pitch/strength; the grain family
 * omits flutes and leans on heavier grain. Dark designs open on a warm tinted
 * near-black (L 4-8%); the three light designs (porcelain, peach, chrome)
 * open on a mid tone so their mean luminance clears 0.55.
 */
export const AURA_SPECS = {
  /** Crimson light-field mirroring the reference: shadow upper-left, hot lobes right+bottom, blush cores. */
  'aura-ember': {
    family: 'reeded', seed: 1207, warp: 0.075, knee: 2.15, pitch: 52, strength: 0.46, grain: 4,
    lobes: [
      { x: 0.92, y: 0.30, r: 0.62, a: 1.30, ox: 0.03, oy: 0.03, ph: 0.0 },
      { x: 1.02, y: 0.66, r: 0.44, a: 1.15, ox: 0.03, oy: 0.02, ph: 1.1 },
      { x: 0.58, y: 1.04, r: 0.55, a: 1.05, ox: 0.04, oy: 0.03, ph: 2.3 },
      { x: 0.12, y: 1.02, r: 0.42, a: 0.95, ox: 0.03, oy: 0.04, ph: 3.6 },
      { x: 0.70, y: 0.60, r: 0.30, a: 0.70, ox: 0.05, oy: 0.03, ph: 4.7 },
    ],
    lut: [[0, '#1a0709'], [0.35, '#8e1030'], [0.62, '#e0234a'], [0.82, '#ff8aa4'], [1, '#ffe2e8']],
  },

  /** Deeper oxblood, moodier; top LUT stop caps at blush, never white. */
  'aura-wine': {
    family: 'reeded', seed: 3391, warp: 0.08, knee: 1.9, pitch: 55, strength: 0.55, grain: 4,
    lobes: [
      { x: 0.86, y: 0.26, r: 0.58, a: 1.10, ox: 0.03, oy: 0.03, ph: 0.4 },
      { x: 1.00, y: 0.70, r: 0.46, a: 1.00, ox: 0.03, oy: 0.02, ph: 1.7 },
      { x: 0.55, y: 1.05, r: 0.50, a: 0.85, ox: 0.04, oy: 0.03, ph: 2.9 },
      { x: 0.16, y: 0.30, r: 0.34, a: 0.55, ox: 0.03, oy: 0.03, ph: 4.2 },
    ],
    lut: [[0, '#140407'], [0.35, '#5e0c20'], [0.6, '#9a1236'], [0.82, '#c72850'], [1, '#e885a0']],
  },

  /** High-key pink, only ~25% shadow, blush washing to near-white. */
  'aura-blush': {
    family: 'reeded', seed: 5122, warp: 0.07, knee: 2.0, pitch: 50, strength: 0.5, grain: 4,
    lobes: [
      { x: 0.72, y: 0.34, r: 0.66, a: 1.05, ox: 0.03, oy: 0.03, ph: 0.2 },
      { x: 0.30, y: 0.72, r: 0.60, a: 0.95, ox: 0.04, oy: 0.03, ph: 1.5 },
      { x: 0.90, y: 0.86, r: 0.48, a: 0.85, ox: 0.03, oy: 0.03, ph: 2.8 },
      { x: 0.10, y: 0.12, r: 0.40, a: 0.55, ox: 0.03, oy: 0.03, ph: 4.0 },
    ],
    lut: [[0, '#0e0409'], [0.28, '#6e1233'], [0.55, '#c8386a'], [0.78, '#ff7ba6'], [1, '#ffd8e6']],
  },

  /** Lavender/plum field with a rose accent lobe low-right. */
  'aura-orchid': {
    family: 'reeded', seed: 7044, warp: 0.085, knee: 1.95, pitch: 54, strength: 0.5, grain: 4,
    lobes: [
      { x: 0.72, y: 0.24, r: 0.56, a: 1.10, ox: 0.03, oy: 0.03, ph: 0.3 },
      { x: 0.24, y: 0.60, r: 0.52, a: 0.85, ox: 0.04, oy: 0.03, ph: 1.6 },
      { x: 0.90, y: 0.82, r: 0.44, a: 0.90, ox: 0.03, oy: 0.03, ph: 2.9 },
      { x: 0.14, y: 0.14, r: 0.36, a: 0.45, ox: 0.03, oy: 0.03, ph: 4.1 },
    ],
    lut: [[0, '#0e0616'], [0.32, '#3a1a5c'], [0.6, '#7a4fc0'], [0.82, '#b892ee'], [1, '#ecd8ff']],
  },

  /** Deep teal and emerald blooming out of warm-black. */
  'aura-sea': {
    family: 'reeded', seed: 8810, warp: 0.08, knee: 2.0, pitch: 56, strength: 0.5, grain: 4,
    lobes: [
      { x: 0.86, y: 0.32, r: 0.60, a: 1.15, ox: 0.03, oy: 0.03, ph: 0.5 },
      { x: 0.30, y: 0.78, r: 0.54, a: 0.90, ox: 0.04, oy: 0.03, ph: 1.9 },
      { x: 1.00, y: 0.72, r: 0.42, a: 0.85, ox: 0.03, oy: 0.02, ph: 3.1 },
      { x: 0.12, y: 0.20, r: 0.34, a: 0.45, ox: 0.03, oy: 0.03, ph: 4.4 },
    ],
    lut: [[0, '#02100f'], [0.34, '#0a4a44'], [0.6, '#12897a'], [0.82, '#4fd0b0'], [1, '#d6f5ea']],
  },

  /** LIGHT: periwinkle and cream, airy; shadow stop is slate-blue, not black. */
  'aura-porcelain': {
    family: 'reeded', seed: 10233, warp: 0.075, knee: 2.4, pitch: 52, strength: 0.42, grain: 4,
    lobes: [
      { x: 0.30, y: 0.30, r: 0.72, a: 1.20, ox: 0.03, oy: 0.03, ph: 0.2 },
      { x: 0.82, y: 0.72, r: 0.68, a: 1.15, ox: 0.03, oy: 0.03, ph: 1.6 },
      { x: 0.86, y: 0.16, r: 0.48, a: 0.90, ox: 0.03, oy: 0.03, ph: 2.9 },
      { x: 0.14, y: 0.86, r: 0.50, a: 0.85, ox: 0.03, oy: 0.03, ph: 4.2 },
    ],
    lut: [[0, '#8090b4'], [0.3, '#a8b8d8'], [0.55, '#c8d2ea'], [0.8, '#f0e8dc'], [1, '#fbf6ee']],
  },

  /** LIGHT: cream, peach and terracotta morning light. */
  'aura-peach': {
    family: 'reeded', seed: 12088, warp: 0.075, knee: 2.4, pitch: 50, strength: 0.42, grain: 4,
    lobes: [
      { x: 0.28, y: 0.28, r: 0.72, a: 1.25, ox: 0.03, oy: 0.03, ph: 0.3 },
      { x: 0.84, y: 0.40, r: 0.62, a: 1.10, ox: 0.03, oy: 0.03, ph: 1.5 },
      { x: 0.60, y: 0.92, r: 0.56, a: 1.00, ox: 0.04, oy: 0.03, ph: 2.8 },
      { x: 0.08, y: 0.88, r: 0.48, a: 0.80, ox: 0.03, oy: 0.03, ph: 4.0 },
    ],
    lut: [[0, '#c98a6a'], [0.34, '#eab088'], [0.6, '#f6cea6'], [0.82, '#fce3cc'], [1, '#fdf5ec']],
  },

  /** LIGHT: silver-blue monochrome, one slate shadow lobe, faint prismatic low lobes. */
  'aura-chrome': {
    family: 'reeded', seed: 13901, warp: 0.07, knee: 2.4, pitch: 52, strength: 0.5, grain: 4,
    lobes: [
      { x: 0.66, y: 0.28, r: 0.66, a: 1.25, ox: 0.03, oy: 0.03, ph: 0.4 },
      { x: 0.20, y: 0.74, r: 0.58, a: 1.05, ox: 0.03, oy: 0.03, ph: 1.7 },
      { x: 0.90, y: 0.80, r: 0.44, a: 0.85, ox: 0.03, oy: 0.03, ph: 3.0 },
      { x: 0.12, y: 0.22, r: 0.40, a: 0.60, ox: 0.03, oy: 0.03, ph: 4.3 },
    ],
    lut: [[0, '#6b7688'], [0.3, '#9aa6ba'], [0.55, '#c2ccdc'], [0.8, '#e4eaf2'], [1, '#f8fbff']],
  },

  /** Monochrome white light through ridges on charcoal. */
  'aura-graphite': {
    family: 'reeded', seed: 15677, warp: 0.08, knee: 2.0, pitch: 54, strength: 0.55, grain: 4,
    lobes: [
      { x: 0.84, y: 0.30, r: 0.60, a: 1.15, ox: 0.03, oy: 0.03, ph: 0.5 },
      { x: 0.30, y: 0.76, r: 0.54, a: 0.85, ox: 0.04, oy: 0.03, ph: 1.9 },
      { x: 1.00, y: 0.70, r: 0.42, a: 0.80, ox: 0.03, oy: 0.02, ph: 3.2 },
      { x: 0.12, y: 0.18, r: 0.34, a: 0.45, ox: 0.03, oy: 0.03, ph: 4.5 },
    ],
    lut: [[0, '#0c0c0d'], [0.35, '#3a3a3c'], [0.62, '#6e6e72'], [0.82, '#a8a8ac'], [1, '#eaeaee']],
  },

  /** Solitary deep red glow in a vast warm-black field, heavy grain. */
  'aura-crimson': {
    family: 'grain', seed: 20114, warp: 0.09, knee: 1.9, grain: 9,
    lobes: [
      { x: 0.52, y: 0.44, r: 0.62, a: 1.20, ox: 0.04, oy: 0.03, ph: 0.0 },
      { x: 0.58, y: 0.40, r: 0.30, a: 0.55, ox: 0.05, oy: 0.03, ph: 2.0 },
    ],
    lut: [[0, '#160505'], [0.35, '#7a0e1e'], [0.62, '#cc1a2e'], [0.85, '#ff6a70'], [1, '#ffd8d2']],
  },

  /** Purple lobe with a dim echo, heavy grain. */
  'aura-violet': {
    family: 'grain', seed: 21990, warp: 0.09, knee: 1.85, grain: 9,
    lobes: [
      { x: 0.30, y: 0.30, r: 0.60, a: 1.15, ox: 0.04, oy: 0.03, ph: 0.0 },
      { x: 0.70, y: 0.66, r: 0.44, a: 0.45, ox: 0.04, oy: 0.03, ph: 2.4 },
    ],
    lut: [[0, '#0a0614'], [0.35, '#3a1e6e'], [0.62, '#6a3ccf'], [0.85, '#a888f0'], [1, '#e6d8ff']],
  },

  /** Cherry-red lobe with a dim pink echo, film grain. */
  'aura-cherry': {
    family: 'grain', seed: 23771, warp: 0.09, knee: 1.9, grain: 9,
    lobes: [
      { x: 0.34, y: 0.32, r: 0.58, a: 1.15, ox: 0.04, oy: 0.03, ph: 0.0 },
      { x: 0.80, y: 0.72, r: 0.42, a: 0.55, ox: 0.04, oy: 0.03, ph: 2.6 },
    ],
    lut: [[0, '#0f0407'], [0.34, '#7c1230'], [0.6, '#cc2048'], [0.84, '#ff6f92'], [1, '#ffd6e2']],
  },

  /** Indigo field with a pale core, heavy film grain. */
  'aura-midnight': {
    family: 'grain', seed: 25508, warp: 0.09, knee: 1.9, grain: 10,
    lobes: [
      { x: 0.30, y: 0.24, r: 0.58, a: 1.15, ox: 0.04, oy: 0.03, ph: 0.0 },
      { x: 0.26, y: 0.20, r: 0.22, a: 0.55, ox: 0.05, oy: 0.03, ph: 1.4 },
      { x: 0.78, y: 0.72, r: 0.40, a: 0.35, ox: 0.04, oy: 0.03, ph: 3.0 },
    ],
    lut: [[0, '#05060f'], [0.35, '#1e2c6e'], [0.62, '#3a52c0'], [0.84, '#8aa0ee'], [1, '#dbe6ff']],
  },

  /** Warm amber/gold glow low in frame, heavy grain. */
  'aura-gold': {
    family: 'grain', seed: 27340, warp: 0.09, knee: 1.9, grain: 9,
    lobes: [
      { x: 0.50, y: 0.98, r: 0.66, a: 1.20, ox: 0.04, oy: 0.03, ph: 0.0 },
      { x: 0.50, y: 1.06, r: 0.34, a: 0.60, ox: 0.05, oy: 0.02, ph: 2.2 },
    ],
    lut: [[0, '#0f0a03'], [0.35, '#6e4a10'], [0.62, '#c68a1e'], [0.85, '#f5cf6a'], [1, '#fff0cc']],
  },

  /** Soft warm grey-white smoke on charcoal, monochrome grain. */
  'aura-smoke': {
    family: 'grain', seed: 29187, warp: 0.09, knee: 1.85, grain: 10,
    lobes: [
      { x: 0.62, y: 0.22, r: 0.60, a: 1.05, ox: 0.04, oy: 0.03, ph: 0.0 },
      { x: 0.68, y: 0.16, r: 0.26, a: 0.45, ox: 0.05, oy: 0.03, ph: 1.6 },
      { x: 0.22, y: 0.78, r: 0.44, a: 0.35, ox: 0.04, oy: 0.03, ph: 3.2 },
    ],
    lut: [[0, '#0c0b0b'], [0.35, '#3a3634'], [0.62, '#6e6864'], [0.85, '#aaa39c'], [1, '#efe9e2']],
  },

  /** Dusty rose and slate, very dim, very heavy grain. */
  'aura-dusk': {
    family: 'grain', seed: 30952, warp: 0.09, knee: 1.7, grain: 11,
    lobes: [
      { x: 0.30, y: 0.30, r: 0.60, a: 0.80, ox: 0.04, oy: 0.03, ph: 0.0 },
      { x: 0.72, y: 0.66, r: 0.56, a: 0.55, ox: 0.04, oy: 0.03, ph: 2.5 },
    ],
    lut: [[0, '#08070a'], [0.35, '#4a2e38'], [0.6, '#8a5866'], [0.82, '#b98a96'], [1, '#e6cdd4']],
  },
};
