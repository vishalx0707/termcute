import { Canvas } from './paint.js';

/**
 * Procedurally painted wallpapers — the "whole terminal" half of a theme.
 * Each design is deterministic (seeded), painted dark enough (or, for
 * notes, calm enough) that terminal text stays perfectly readable on top.
 */

const W = 1600;
const H = 900;

export const DESIGNS = {
  /** Dusk sky full of drifting sakura petals and pink bokeh. */
  sakura() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(20260718);
    c.vGradient([[0, '#261531'], [0.5, '#1c1426'], [1, '#301a2c']]);
    for (let i = 0; i < 34; i++) {
      const colors = ['#ff9ec7', '#d6a6ff', '#ffb3d4'];
      c.blob(rand() * W, rand() * H, 60 + rand() * 130, colors[i % 3], 0.05 + rand() * 0.06);
    }
    for (let i = 0; i < 110; i++) {
      const edgeBias = rand() < 0.55 ? rand() * 0.28 : 0.72 + rand() * 0.28;
      const x = (rand() < 0.5 ? edgeBias : rand()) * W;
      const size = 4 + rand() * 9;
      const colors = ['#ff8fc7', '#ffb3d4', '#e6a6e0', '#ffd1e3'];
      c.petal(x, rand() * H, size, size * 0.55, rand() * Math.PI, colors[i % 4], 0.28 + rand() * 0.3);
    }
    c.vignette(0.25);
    return c;
  },

  /**
   * Apple-style Liquid Glass — layered iridescent refraction pools, specular
   * caustics, and frosted depth. Designed to sit behind Windows Terminal's
   * acrylic blur at ~50 % opacity, creating the illusion of looking through
   * a curved, luminous glass surface.
   *
   * Key techniques:
   * 1. Large, overlapping soft color pools (blobs at very low alpha) simulate
   *    light refracting through curved glass — each pool is a different hue
   *    so the overlap creates natural iridescence.
   * 2. Bright specular caustic spots with wider glow halos mimic concentrated
   *    light hitting the rim of a glass element.
   * 3. Translucent rings suggest the curved edges of refractive surfaces.
   * 4. Subtle diagonal light streaks add directionality (as if lit from above-left).
   * 5. Fine grain prevents banding and adds a tactile "frosted" texture.
   * 6. Gentle vignette focuses the eye toward the center.
   */
  'liquid-glass'() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(2026);

    // ── deep blue-black base with subtle cool shift ──────────────────
    c.vGradient([
      [0,    '#080c16'],
      [0.25, '#0a1020'],
      [0.55, '#0c1428'],
      [0.80, '#0a1020'],
      [1,    '#060a12'],
    ]);

    // ── primary refraction pools — large, soft, overlapping ─────────
    // These are the heart of the liquid glass look: imagine light passing
    // through a thick curved glass lens and pooling into soft color zones.
    const pools = [
      { x: 0.22, y: 0.30, r: 400, col: '#2a6aff', a: 0.050 },  // deep sapphire
      { x: 0.75, y: 0.25, r: 350, col: '#7c5cff', a: 0.042 },  // violet
      { x: 0.50, y: 0.68, r: 380, col: '#4a90ff', a: 0.044 },  // sky blue
      { x: 0.12, y: 0.78, r: 300, col: '#9070ff', a: 0.036 },  // lavender
      { x: 0.88, y: 0.60, r: 280, col: '#ff6ea0', a: 0.028 },  // warm rose accent
      { x: 0.38, y: 0.15, r: 260, col: '#50d0e0', a: 0.032 },  // cyan shimmer
      { x: 0.65, y: 0.48, r: 240, col: '#6080ff', a: 0.030 },  // mid-blue depth layer
    ];
    for (const p of pools) {
      c.blob(p.x * W, p.y * H, p.r, p.col, p.a);
    }

    // ── secondary depth blobs — smaller, scattered, add layered iridescence
    const depthColors = ['#5090ff', '#7c5cff', '#9070ff', '#50d0e0', '#ff80b0', '#6aadff',
                         '#a080ff', '#40c8d0', '#8090ff', '#ff6ea0'];
    for (let i = 0; i < 22; i++) {
      c.blob(
        rand() * W, rand() * H,
        60 + rand() * 200,
        depthColors[i % depthColors.length],
        0.015 + rand() * 0.022,
      );
    }

    // ── specular caustics — bright spots where light concentrates ────
    // These give the "glassy" specular highlight feel.
    for (let i = 0; i < 16; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = 12 + rand() * 35;
      // bright white-blue core
      c.blob(x, y, r, '#d8ecff', 0.07 + rand() * 0.06);
      // wider soft glow halo
      c.blob(x, y, r * 2.8, '#6aadff', 0.018 + rand() * 0.014);
    }

    // ── glass edge rings — curved refractive surface boundaries ─────
    const ringColors = ['#5090ff', '#7c5cff', '#90c0ff', '#a080ff', '#50d0e0'];
    for (let i = 0; i < 8; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = 80 + rand() * 220;
      c.ring(x, y, r, r * 0.07, ringColors[i % ringColors.length], 0.05 + rand() * 0.04);
    }

    // ── directional light streaks — lit from upper-left ─────────────
    for (let i = 0; i < 5; i++) {
      const x = rand() * W * 0.8;
      c.line(
        x, -60,
        x - H * 0.45, H + 60,
        70 + rand() * 110,
        i % 2 ? '#6aadff' : '#9070ff',
        0.010 + rand() * 0.008,
      );
    }

    // ── tiny sparkle highlights ─────────────────────────────────────
    for (let i = 0; i < 70; i++) {
      c.blob(rand() * W, rand() * H, 1 + rand() * 3, '#d0e8ff', 0.10 + rand() * 0.22);
    }

    // ── warm accent flare in the lower-right for color contrast ─────
    c.blob(W * 0.82, H * 0.72, 180, '#ff6ea0', 0.022);
    c.blob(W * 0.80, H * 0.70, 90,  '#ffb0d0', 0.035);

    // ── frosted grain texture ───────────────────────────────────────
    c.grain(2.8, 42);

    // ── gentle vignette ─────────────────────────────────────────────
    c.vignette(0.22);

    return c;
  },

  /** Ruled notebook paper — margin line, blue rules, punched holes. */
  notes() {
    const c = new Canvas(2400, 1350);
    c.vGradient([[0, '#faf6ec'], [1, '#f4efe2']]);
    c.grain(3.5, 11);
    for (let y = 130; y < c.h; y += 46) c.hLine(y, 1.6, '#a9c6e2', 0.75);
    // double red margin line
    c.line(200, 0, 200, c.h, 1.6, '#e0959f', 0.85);
    c.line(208, 0, 208, c.h, 1.6, '#e0959f', 0.85);
    // punched holes with a soft shadow ring
    for (const fy of [0.18, 0.5, 0.82]) {
      const y = c.h * fy;
      c.blob(80, y, 26, '#d8d0bd', 0.9);
      c.blob(80, y, 20, '#efe9da', 1);
      c.ring(80, y, 23, 4, '#c9c0aa', 0.5);
    }
    return c;
  },

};
