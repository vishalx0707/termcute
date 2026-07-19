import { Canvas } from './paint.js';
import { hexToRgb } from '../utils.js';

/**
 * AURA v3 — Premium luminous light-field engine.
 *
 * What changed from v2 and WHY each pass matters for perceived quality:
 *
 * 1. THREE-OCTAVE domain warp (was two-octave noise sampled once).
 *    Shapes become organic, never circular. The third octave adds fine
 *    ripples that break up flat zones the eye instantly reads as "CG."
 *
 * 2. Filmic luminance-aware grain. Real 35mm grain is heavy in mid-tones,
 *    almost invisible in deep shadows, and faint in blown highlights.
 *    Uniform grain screams "Photoshop noise filter" — this doesn't.
 *
 * 3. Per-pixel chromatic grain. Each channel gets its own noise offset,
 *    so grain shimmers slightly warm/cool like real film emulsion.
 *
 * 4. Subtle bloom: a second energy-field sample at 3× the lobe radius,
 *    mixed into the low end of the LUT. This makes bright areas feel
 *    luminous — they "glow" into surrounding dark zones.
 *
 * 5. Cinematic vignette: smooth radial darkening at the frame edges.
 *    Every professional gradient photo has this; it focuses the eye.
 *
 * 6. Color temperature shift: shadows lean warm (amber), highlights lean
 *    cool (blue). This is the "filmic" look — it adds perceived depth
 *    because warm recedes and cool advances.
 *
 * 7. Richer LUT palettes: 7–8 stops instead of 5, with carefully chosen
 *    hue rotations through the mid-tones. A red gradient doesn't stay red
 *    across the whole ramp — it drifts through orange, magenta, and pink.
 *
 * 8. More lobes (5–8 per design) with larger orbit radii for the animated
 *    preview. The lobe positions are asymmetric and avoid the center, so
 *    the composition has natural visual weight.
 *
 * 9. Improved fluted glass (reeded family): the refraction displacement is
 *    modulated by a second noise field that fades the ridges in and out
 *    regionally, plus a subtle horizontal phase drift tied to luminance
 *    creates a "liquid" feel where bright areas distort more.
 */

/** Canvas.rng-style integer hash → float in [0,1). */
function hash3(seed, ix, iy) {
  let s = (seed ^ Math.imul(ix | 0, 0x9e3779b1) ^ Math.imul(iy | 0, 0x85ebca77)) >>> 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

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

/** Three-octave value noise for richer domain warp. */
export function vnoise(seed, x, y) {
  return 0.55 * octave(seed, x, y)
       + 0.30 * octave(seed + 8191, x * 2, y * 2)
       + 0.15 * octave(seed + 16381, x * 4, y * 4);
}

/** Piecewise-linear RGB LUT; s in [0,1]. */
function lutSample(lut, s) {
  let lo = lut[0], hi = lut[lut.length - 1];
  for (let i = 0; i < lut.length - 1; i++) {
    if (s >= lut[i][0] && s <= lut[i + 1][0]) { lo = lut[i]; hi = lut[i + 1]; break; }
  }
  const f = hi[0] === lo[0] ? 0 : (s - lo[0]) / (hi[0] - lo[0]);
  // cubic interpolation for smoother color transitions
  const t = f * f * (3 - 2 * f);
  const a = lo[1], b = hi[1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Render a design spec to a Canvas.
 * @param {object} spec  entry from AURA_SPECS
 * @param {number} w     pixel width
 * @param {number} h     pixel height
 * @param {number} t     loop phase [0,1); t=0 for static PNGs
 */
export function paintAura(spec, w, h, t = 0) {
  const c = new Canvas(w, h);
  const ar = w / h;
  const lut = spec.lut.map(([s, hex]) => [s, hexToRgb(hex)]);
  const reeded = spec.family === 'reeded';
  const pitch = reeded ? spec.pitch * (w / 1600) : 0;
  const ph = 2 * Math.PI * t;

  // pre-compute animated lobe positions
  const lobes = spec.lobes.map((l) => ({
    cx: l.x + (l.ox || 0) * Math.cos(ph + (l.ph || 0)),
    cy: l.y + (l.oy || 0) * Math.sin(ph + (l.ph || 0)),
    ir2: 1 / (l.r * l.r),
    a: l.a,
    // bloom lobes: 3× radius, 0.15× amplitude
    bir2: 1 / (l.r * l.r * 9),
    ba: l.a * 0.15,
  }));

  const gBase = spec.grain;
  const vign = spec.vignette ?? 0.3;
  const temp = spec.tempShift ?? 0.08;
  const cx = 0.5, cy = 0.5;

  for (let py = 0; py < h; py++) {
    const ny = py / h;
    for (let px = 0; px < w; px++) {
      const nx = px / w;

      // ── three-octave domain warp ──────────────────────
      const warpAmt = spec.warp;
      const wx = warpAmt * (vnoise(spec.seed + 101, nx * 3.5, ny * 3.5) - 0.5) * 2;
      const wy = warpAmt * (vnoise(spec.seed + 211, nx * 3.5, ny * 3.5) - 0.5) * 2;
      const x = nx + wx;
      const y = ny + wy;

      // ── primary energy field ──────────────────────────
      let E = 0;
      let bloom = 0;
      for (let i = 0; i < lobes.length; i++) {
        const lb = lobes[i];
        const dx = (x - lb.cx) * ar;
        const dy = y - lb.cy;
        const d2 = dx * dx + dy * dy;
        E += lb.a * Math.exp(-3 * d2 * lb.ir2);
        bloom += lb.ba * Math.exp(-3 * d2 * lb.bir2);
      }

      // ── filmic tone mapping ───────────────────────────
      const Eprime = E + bloom * 0.5;
      let L = 1 - Math.exp(-Eprime * spec.knee);
      if (L < 0) L = 0; else if (L > 0.99999) L = 0.99999;

      const col = lutSample(lut, L);
      let r = col[0], g = col[1], b = col[2];

      // ── color temperature shift ───────────────────────
      // shadows warm (amber), highlights cool (blue)
      const lumNorm = L;
      const warmCool = (lumNorm - 0.5) * temp;
      r += warmCool * 18;   // warm shadows = +R
      b -= warmCool * 12;   // cool highlights = +B

      // ── bloom glow: bright areas bleed luminance ──────
      const bloomGlow = bloom * spec.knee * 0.4;
      r += bloomGlow * 35;
      g += bloomGlow * 25;
      b += bloomGlow * 20;

      // ── region-masked fluted glass (reeded family) ────
      if (reeded) {
        // phase drift tied to luminance: bright areas distort more
        const lumShift = L * 0.15;
        const fp = ((px / pitch) + lumShift) - Math.floor((px / pitch) + lumShift);
        const bright = Math.exp(-((fp - 0.16) ** 2) / 0.004);
        const dark = Math.exp(-((fp - 0.62) ** 2) / 0.015);
        // two-frequency mask for organic fade in/out
        const m1 = smoothstep(0.2, 0.8, vnoise(spec.seed + 307, x * 2.5, y * 2.5));
        const m2 = smoothstep(0.3, 0.7, vnoise(spec.seed + 419, x * 1.2, y * 1.2));
        const m = m1 * 0.7 + m2 * 0.3;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const gain = 1 + spec.strength * m * (
          bright * (0.30 + 1.1 * lum) - dark * (0.20 + 0.6 * lum)
        );
        r *= gain; g *= gain; b *= gain;
      }

      // ── cinematic vignette ────────────────────────────
      const vdx = (nx - cx) * ar * 0.75;
      const vdy = ny - cy;
      const vd = Math.sqrt(vdx * vdx + vdy * vdy);
      const vf = 1 - vign * smoothstep(0.3, 1.2, vd);
      r *= vf; g *= vf; b *= vf;

      // ── filmic luminance-aware grain ──────────────────
      // mid-tones get heavy grain, shadows and highlights get less
      const pixLum = (r + g + b) / 765;
      const grainEnvelope = 4 * pixLum * (1 - pixLum); // parabola peaks at 0.5
      const grainAmt = gBase * (0.3 + 0.7 * grainEnvelope);
      // per-channel chromatic grain (warm/cool shimmer)
      const nr = (hash3(spec.seed + 401, px, py) - 0.5) * 2 * grainAmt;
      const ng = (hash3(spec.seed + 503, px, py) - 0.5) * 2 * grainAmt * 0.85;
      const nb = (hash3(spec.seed + 607, px, py) - 0.5) * 2 * grainAmt * 1.1;

      const idx = (py * w + px) * 3;
      c.data[idx]     = r + nr;
      c.data[idx + 1] = g + ng;
      c.data[idx + 2] = b + nb;
    }
  }
  return c;
}

export const AURA_SPECS = {
  /** A bleeding crimson and dark copper field, resembling embers glowing in a fireplace. */
  'aura-ember': {
    family: 'reeded', seed: 1207, warp: 0.13, knee: 2.3, pitch: 48, strength: 0.55, grain: 6,
    vignette: 0.38, tempShift: 0.12,
    lobes: [
      { x: 0.88, y: 0.28, r: 0.58, a: 1.35, ox: 0.05, oy: 0.04, ph: 0.0 },
      { x: 1.05, y: 0.62, r: 0.42, a: 1.20, ox: 0.04, oy: 0.03, ph: 1.1 },
      { x: 0.55, y: 1.06, r: 0.52, a: 1.10, ox: 0.06, oy: 0.04, ph: 2.3 },
      { x: 0.10, y: 0.98, r: 0.40, a: 0.95, ox: 0.04, oy: 0.05, ph: 3.6 },
      { x: 0.68, y: 0.55, r: 0.28, a: 0.75, ox: 0.07, oy: 0.04, ph: 4.7 },
      { x: 0.30, y: 0.20, r: 0.35, a: 0.50, ox: 0.05, oy: 0.04, ph: 5.8 },
    ],
    lut: [
      [0, '#0f0203'], [0.15, '#35050a'], [0.30, '#6c0813'],
      [0.48, '#a8101d'], [0.62, '#cf252b'], [0.76, '#f05b4a'],
      [0.88, '#ff966c'], [1, '#ffe3c8'],
    ],
  },

  /** Moody deep teal and ink-blue spilling into a cold dark shadow. */
  'aura-abyss': {
    family: 'reeded', seed: 8810, warp: 0.14, knee: 2.1, pitch: 52, strength: 0.60, grain: 7,
    vignette: 0.42, tempShift: 0.06,
    lobes: [
      { x: 0.84, y: 0.30, r: 0.58, a: 1.20, ox: 0.05, oy: 0.04, ph: 0.5 },
      { x: 0.28, y: 0.76, r: 0.52, a: 0.95, ox: 0.06, oy: 0.04, ph: 1.9 },
      { x: 1.02, y: 0.70, r: 0.40, a: 0.90, ox: 0.04, oy: 0.03, ph: 3.1 },
      { x: 0.10, y: 0.18, r: 0.32, a: 0.50, ox: 0.05, oy: 0.04, ph: 4.4 },
      { x: 0.60, y: 0.50, r: 0.28, a: 0.45, ox: 0.07, oy: 0.05, ph: 5.7 },
      { x: 0.45, y: 1.05, r: 0.36, a: 0.60, ox: 0.05, oy: 0.04, ph: 0.3 },
    ],
    lut: [
      [0, '#02070c'], [0.14, '#041624'], [0.28, '#082b3a'],
      [0.44, '#0e4a54'], [0.58, '#186d6d'], [0.72, '#2b9588'],
      [0.85, '#56bfa0'], [1, '#b6edd8'],
    ],
  },

  /** A somber blend of muted lavender, dusty mauve, and cold slate gray. */
  'aura-melancholy': {
    family: 'reeded', seed: 3391, warp: 0.13, knee: 1.9, pitch: 50, strength: 0.55, grain: 6,
    vignette: 0.38, tempShift: 0.08,
    lobes: [
      { x: 0.82, y: 0.24, r: 0.55, a: 1.15, ox: 0.05, oy: 0.04, ph: 0.4 },
      { x: 1.02, y: 0.68, r: 0.44, a: 1.05, ox: 0.04, oy: 0.03, ph: 1.7 },
      { x: 0.52, y: 1.08, r: 0.48, a: 0.90, ox: 0.06, oy: 0.04, ph: 2.9 },
      { x: 0.14, y: 0.28, r: 0.32, a: 0.60, ox: 0.04, oy: 0.04, ph: 4.2 },
      { x: 0.40, y: 0.50, r: 0.26, a: 0.45, ox: 0.05, oy: 0.05, ph: 5.5 },
      { x: 0.75, y: 0.90, r: 0.30, a: 0.55, ox: 0.06, oy: 0.03, ph: 0.8 },
    ],
    lut: [
      [0, '#0c0712'], [0.15, '#1b1226'], [0.30, '#362444'],
      [0.48, '#583c66'], [0.62, '#7e5788'], [0.76, '#a477aa'],
      [0.88, '#caa0cc'], [1, '#ecd8ec'],
    ],
  },

  /** A high-energy neon pink, electric indigo, and gold glow blending dramatically. */
  'aura-euphoria': {
    family: 'reeded', seed: 5122, warp: 0.14, knee: 2.2, pitch: 46, strength: 0.55, grain: 5,
    vignette: 0.32, tempShift: 0.10,
    lobes: [
      { x: 0.70, y: 0.32, r: 0.64, a: 1.10, ox: 0.05, oy: 0.04, ph: 0.2 },
      { x: 0.28, y: 0.70, r: 0.58, a: 1.00, ox: 0.06, oy: 0.04, ph: 1.5 },
      { x: 0.92, y: 0.84, r: 0.46, a: 0.90, ox: 0.04, oy: 0.04, ph: 2.8 },
      { x: 0.08, y: 0.10, r: 0.38, a: 0.60, ox: 0.05, oy: 0.04, ph: 4.0 },
      { x: 0.55, y: 0.55, r: 0.30, a: 0.50, ox: 0.07, oy: 0.05, ph: 5.3 },
      { x: 0.85, y: 0.15, r: 0.25, a: 0.40, ox: 0.04, oy: 0.06, ph: 1.0 },
    ],
    lut: [
      [0, '#04020c'], [0.14, '#120524'], [0.28, '#2d0c4a'],
      [0.44, '#5d137a'], [0.58, '#9d1b9d'], [0.72, '#d13cb2'],
      [0.85, '#f57cd0'], [1, '#ffcceb'],
    ],
  },

  /** Calming sage green, soft sand, and pale sky blue, extremely light and airy. */
  'aura-serenity': {
    family: 'reeded', seed: 10233, warp: 0.11, knee: 2.5, pitch: 48, strength: 0.48, grain: 4,
    vignette: 0.22, tempShift: 0.04,
    lobes: [
      { x: 0.30, y: 0.30, r: 0.72, a: 1.20, ox: 0.04, oy: 0.04, ph: 0.2 },
      { x: 0.82, y: 0.72, r: 0.68, a: 1.15, ox: 0.04, oy: 0.04, ph: 1.6 },
      { x: 0.86, y: 0.16, r: 0.48, a: 0.90, ox: 0.05, oy: 0.04, ph: 2.9 },
      { x: 0.14, y: 0.86, r: 0.50, a: 0.85, ox: 0.04, oy: 0.05, ph: 4.2 },
    ],
    lut: [
      [0, '#5a6b5c'], [0.15, '#768c78'], [0.30, '#94ab96'],
      [0.48, '#b2c7b4'], [0.62, '#cce0ce'], [0.76, '#e0eee2'],
      [0.88, '#eee8dc'], [1, '#FAF7F2'],
    ],
  },

  /** A quiet, dark midnight blue field with a single warm amber glow. */
  'aura-solitude': {
    family: 'grain', seed: 25508, warp: 0.14, knee: 1.95, grain: 9,
    vignette: 0.40, tempShift: 0.12,
    lobes: [
      { x: 0.28, y: 0.22, r: 0.56, a: 1.20, ox: 0.06, oy: 0.04, ph: 0.0 },
      { x: 0.24, y: 0.18, r: 0.20, a: 0.60, ox: 0.07, oy: 0.04, ph: 1.4 },
      { x: 0.78, y: 0.72, r: 0.40, a: 0.45, ox: 0.06, oy: 0.04, ph: 3.0 },
      { x: 0.50, y: 0.45, r: 0.28, a: 0.35, ox: 0.05, oy: 0.06, ph: 4.6 },
    ],
    lut: [
      [0, '#020308'], [0.15, '#060a16'], [0.30, '#10172e'],
      [0.46, '#222f54'], [0.60, '#424f7e'], [0.74, '#6a7bad'],
      [0.86, '#9cb0d8'], [1, '#d5e3fc'],
    ],
  },

  /** Warm terracotta, vintage olive green, and sepia, mimicking faded film print. */
  'aura-nostalgia': {
    family: 'grain', seed: 27340, warp: 0.13, knee: 2.0, grain: 8,
    vignette: 0.38, tempShift: 0.10,
    lobes: [
      { x: 0.48, y: 0.96, r: 0.64, a: 1.25, ox: 0.06, oy: 0.04, ph: 0.0 },
      { x: 0.52, y: 1.08, r: 0.32, a: 0.65, ox: 0.07, oy: 0.03, ph: 2.2 },
      { x: 0.35, y: 0.78, r: 0.28, a: 0.40, ox: 0.05, oy: 0.06, ph: 4.0 },
      { x: 0.70, y: 0.85, r: 0.30, a: 0.45, ox: 0.06, oy: 0.04, ph: 1.5 },
    ],
    lut: [
      [0, '#120a06'], [0.15, '#2e1c12'], [0.30, '#543625'],
      [0.46, '#7e543e'], [0.60, '#a8775d'], [0.74, '#cc9e82'],
      [0.86, '#eec8af'], [1, '#FAF0E6'],
    ],
  },

  /** Swirling violet, electric cyan, and cosmic magenta low in frame, cinematic grain. */
  'aura-nebula': {
    family: 'grain', seed: 21990, warp: 0.14, knee: 1.95, grain: 8,
    vignette: 0.40, tempShift: 0.08,
    lobes: [
      { x: 0.28, y: 0.28, r: 0.58, a: 1.20, ox: 0.06, oy: 0.04, ph: 0.0 },
      { x: 0.68, y: 0.64, r: 0.42, a: 0.50, ox: 0.06, oy: 0.04, ph: 2.4 },
      { x: 0.35, y: 0.22, r: 0.20, a: 0.45, ox: 0.05, oy: 0.06, ph: 4.2 },
      { x: 0.80, y: 0.35, r: 0.30, a: 0.35, ox: 0.07, oy: 0.04, ph: 1.3 },
    ],
    lut: [
      [0, '#04020a'], [0.15, '#100624'], [0.30, '#260e4a'],
      [0.46, '#4d1c80'], [0.60, '#7c33b8'], [0.74, '#b155d8'],
      [0.86, '#e08df0'], [1, '#fbf2ff'],
    ],
  },
};
