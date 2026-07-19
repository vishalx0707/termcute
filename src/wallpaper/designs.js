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

  /** Cool frosted glass — light streaks and floating glass bubbles. */
  'liquid-glass'() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(1049);
    c.vGradient([[0, '#0e1620'], [0.55, '#121c29'], [1, '#0a0f16']]);
    for (let i = 0; i < 6; i++) {
      const x = rand() * W;
      c.line(x, -50, x - H * 0.55, H + 50, 60 + rand() * 90, '#9cc8e8', 0.035 + rand() * 0.03);
    }
    for (let i = 0; i < 9; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = 50 + rand() * 140;
      c.blob(x, y, r, '#7bd4ff', 0.03 + rand() * 0.03);
      c.ring(x, y, r, r * 0.16, i % 2 ? '#b49cff' : '#a8dcff', 0.10 + rand() * 0.08);
    }
    for (let i = 0; i < 60; i++) c.blob(rand() * W, rand() * H, 1.5 + rand() * 2.5, '#dceeff', 0.15 + rand() * 0.2);
    c.vignette(0.3);
    return c;
  },

  /** Synthwave horizon — neon sun, scanlines, perspective grid. */
  cyberpunk() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(2077);
    c.vGradient([[0, '#150826'], [0.5, '#1e0b33'], [0.62, '#3a1245'], [1, '#12061f']]);
    const hy = H * 0.62;
    const cx = W / 2;

    for (let i = 0; i < 90; i++) {
      const y = rand() * hy * 0.9;
      c.blob(rand() * W, y, 1 + rand() * 2, i % 3 ? '#e8d8ff' : '#7bfff2', 0.25 + rand() * 0.35);
    }

    // neon sun with scanline gaps
    const sunR = H * 0.2;
    for (let y = Math.floor(hy - sunR); y < hy; y++) {
      const t = (hy - y) / sunR;
      if (t > 1) continue;
      const gap = Math.floor((1 - t) * 9);
      if (gap > 1 && y % (gap + 3) < Math.min(gap, 4)) continue;
      const half = Math.sqrt(1 - t * t) * sunR;
      const col = [255, 45 + t * 170, 130 + t * (-10)];
      for (let x = Math.floor(cx - half); x <= cx + half; x++) c.blend(x, y, col, 0.85);
    }
    c.blob(cx, hy - sunR * 0.4, sunR * 1.7, '#ff2d95', 0.16);
    c.hLine(hy, 3, '#ff5db8', 0.5);

    // perspective grid below the horizon
    for (let i = -14; i <= 14; i++) {
      c.line(cx + i * 26, hy, cx + i * 230, H + 40, 1.6, i % 2 ? '#ff2d95' : '#29e5ff', 0.3);
    }
    for (let k = 1; k <= 9; k++) {
      const y = hy + (H - hy) * (k * k) / 81;
      c.hLine(y, 1.4, '#ff2d95', 0.35);
    }
    c.vignette(0.28);
    return c;
  },

  /** Candlelit dark red — rose petals, soft glow, tiny hearts. */
  romance() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(143);
    c.radial(W * 0.5, H * 0.42, W * 0.75, '#230a11', '#0c0305');
    for (let i = 0; i < 22; i++) {
      c.blob(rand() * W, rand() * H, 70 + rand() * 150, i % 2 ? '#ff4d6d' : '#c9184a', 0.035 + rand() * 0.045);
    }
    for (let i = 0; i < 70; i++) {
      const size = 5 + rand() * 10;
      const colors = ['#7f1029', '#a11930', '#d61f4a'];
      c.petal(rand() * W, rand() * H, size, size * 0.6, rand() * Math.PI, colors[i % 3], 0.25 + rand() * 0.25);
    }
    for (let i = 0; i < 16; i++) {
      c.heart(rand() * W, rand() * H, 6 + rand() * 12, i % 2 ? '#d61f4a' : '#ff4d6d', 0.3 + rand() * 0.25);
    }
    for (let i = 0; i < 40; i++) c.blob(rand() * W, rand() * H, 1 + rand() * 2, '#ffb3c1', 0.12 + rand() * 0.18);
    c.vignette(0.4);
    return c;
  },

  /** Rainy city night through a wet window — warm bokeh, streaking rain. */
  'lofi-rain'() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(2216);
    c.vGradient([[0, '#0d0a1a'], [0.5, '#151026'], [1, '#0b0816']]);
    // out-of-focus city lights, warm with a few cool accents
    const lights = ['#ffae5e', '#ff7aa0', '#ffd98a', '#5ad0e8', '#b08ae8', '#ff9a5e'];
    for (let i = 0; i < 95; i++) {
      const x = rand() * W;
      const y = H * (0.32 + rand() * 0.55);
      const r = 8 + rand() * 60;
      c.blob(x, y, r, lights[i % 6], 0.09 + rand() * 0.13);
      if (i % 6 === 0) c.ring(x, y, r, r * 0.2, lights[(i + 1) % 6], 0.12);
      if (i % 9 === 0) c.blob(x, y, r * 0.35, '#ffe8c8', 0.16);
    }
    // rain streaking down the glass
    for (let i = 0; i < 150; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const len = 26 + rand() * 60;
      c.line(x, y, x - 5, y + len, 1, '#aac8e8', 0.045 + rand() * 0.05);
    }
    // droplets clinging to the window, each with a tiny highlight
    for (let i = 0; i < 60; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = 1.6 + rand() * 1.8;
      c.blob(x, y, r, '#cfe0f0', 0.3);
      c.blob(x - r * 0.35, y - r * 0.35, r * 0.4, '#ffffff', 0.35);
    }
    c.vignette(0.35);
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

