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

  /** Northern lights — glowing curtains over a mountain ridge. */
  aurora() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(6031);
    c.vGradient([[0, '#050a16'], [0.55, '#0a1424'], [1, '#0d1a2b']]);
    for (let i = 0; i < 150; i++) {
      c.blob(rand() * W, rand() * H * 0.8, 1 + rand() * 1.8, i % 4 ? '#dce8f5' : '#aac8f0', 0.2 + rand() * 0.4);
    }
    // three luminous curtains — dense overlapping streaks along slow sine
    // paths, with a soft glow riding the path so the light reads continuous
    const bands = [
      { yc: 0.30, freq: 1.6, ph: 0.5, colors: ['#3fe89a', '#2fd4c8'] },
      { yc: 0.22, freq: 2.3, ph: 2.8, colors: ['#2fd4c8', '#7a5ae8'] },
      { yc: 0.40, freq: 1.1, ph: 4.4, colors: ['#4ade9a', '#9a6ae8'] },
    ];
    for (const band of bands) {
      for (let i = 0; i < 320; i++) {
        const t = i / 319;
        const x = t * W;
        const y = H * band.yc + 55 * Math.sin(t * Math.PI * 2 * band.freq + band.ph);
        const len = 100 + 75 * Math.sin(t * 9 + band.ph);
        const color = t < 0.5 ? band.colors[0] : band.colors[1];
        c.petal(x, y + len / 2, 16, len / 2, 0, color, 0.014 + 0.010 * Math.sin(t * 13));
        if (i % 16 === 0) c.blob(x, y + len * 0.3, 60, color, 0.05);
      }
    }
    // mountain silhouettes, back ridge faintly lit
    const ridge = (x, base, a, b) => H * base + a * Math.sin(x * 0.004 + 1) + b * Math.sin(x * 0.011 + 3);
    for (let x = 0; x < W; x++) {
      const back = ridge(x, 0.78, 34, 18);
      const front = ridge(x, 0.85, 28, 22);
      for (let y = Math.max(0, Math.floor(back)); y < H; y++) c.blend(x, y, [10, 16, 26], 1);
      for (let y = Math.max(0, Math.floor(front)); y < H; y++) c.blend(x, y, [4, 7, 13], 1);
    }
    c.vignette(0.2);
    return c;
  },

  /** Deep-space nebula — gas clouds, a bright core, flared stars. */
  nebula() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(4242);
    c.vGradient([[0, '#0b0618'], [0.5, '#120a26'], [1, '#090414']]);
    // gas clouds clustered along a diagonal band
    const cols = ['#d34fa0', '#5a3ae0', '#2fd4c8', '#ff6aa8', '#8a4ae0'];
    for (let i = 0; i < 150; i++) {
      const t = rand();
      const x = W * (0.12 + t * 0.76) + (rand() - 0.5) * 300;
      const y = H * (0.75 - t * 0.5) + (rand() - 0.5) * 260;
      c.blob(x, y, 40 + rand() * 130, cols[i % 5], 0.045 + rand() * 0.055);
    }
    // bright core
    c.blob(W * 0.58, H * 0.42, 150, '#ff9ad0', 0.10);
    c.blob(W * 0.58, H * 0.42, 60, '#ffe0f0', 0.22);
    c.blob(W * 0.58, H * 0.42, 18, '#ffffff', 0.5);
    // star field + a few flared stars
    for (let i = 0; i < 260; i++) {
      c.blob(rand() * W, rand() * H, 0.8 + rand() * 1.6, '#e8e4f5', 0.15 + rand() * 0.4);
    }
    for (let i = 0; i < 7; i++) {
      const x = rand() * W;
      const y = rand() * H;
      c.blob(x, y, 3, '#ffffff', 0.5);
      c.line(x - 22, y, x + 22, y, 1.2, '#cfd8ff', 0.22);
      c.line(x, y - 14, x, y + 14, 1.2, '#cfd8ff', 0.22);
    }
    c.vignette(0.3);
    return c;
  },

  /** Golden hour — sunset sky, silhouetted clouds, sun shimmer on water. */
  'golden-hour'() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(1847);
    const horizon = H * 0.78;
    c.vGradient([[0, '#2a1035'], [0.35, '#6e1f3d'], [0.62, '#c4503a'], [0.78, '#e89a4a'], [0.8, '#3a1430'], [1, '#160a1c']]);
    // sun + glow
    c.blob(W * 0.5, horizon - 40, 240, '#ff9a4a', 0.2);
    c.blob(W * 0.5, horizon - 40, 70, '#ffd9a0', 0.85);
    // silhouetted cloud bands with lit edges
    for (let i = 0; i < 26; i++) {
      const y = H * (0.08 + rand() * 0.58);
      const x = rand() * W;
      const rx = 70 + rand() * 170;
      c.petal(x, y - 4, rx, 7 + rand() * 8, 0, '#ffb070', 0.10 + rand() * 0.08);
      c.petal(x, y, rx, 8 + rand() * 12, 0, '#421334', 0.4 + rand() * 0.3);
    }
    // sun path shimmering on the water
    for (let i = 0; i < 70; i++) {
      const y = horizon + 8 + rand() * (H - horizon - 16);
      const spread = 40 + (y - horizon) * 1.1;
      const x = W * 0.5 + (rand() - 0.5) * spread;
      const len = 12 + rand() * 46;
      c.line(x - len / 2, y, x + len / 2, y, 1.3, i % 3 ? '#ffb066' : '#ffd9a0', 0.10 + rand() * 0.12);
    }
    c.vignette(0.22);
    return c;
  },

  /** Arctic frost — snowfall, ice light, crystalline snowflakes. */
  frost() {
    const c = new Canvas(W, H);
    const rand = Canvas.rng(9021);
    c.vGradient([[0, '#0a1420'], [0.6, '#10222f'], [1, '#17313d']]);
    // diagonal ice light
    for (let i = 0; i < 5; i++) {
      const x = rand() * W;
      c.line(x, -40, x - H * 0.4, H + 40, 70 + rand() * 80, '#9adcf0', 0.035);
    }
    // crystalline snowflakes — six arms with small branches
    for (let i = 0; i < 8; i++) {
      const x = rand() * W;
      const y = rand() * H * 0.85;
      const L = 26 + rand() * 40;
      const alpha = 0.14 + rand() * 0.12;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3 + 0.26;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        c.line(x, y, x + dx * L, y + dy * L, 1.4, '#cfeaf8', alpha);
        const bx = x + dx * L * 0.55;
        const by = y + dy * L * 0.55;
        for (const s of [0.55, -0.55]) {
          c.line(bx, by, bx + Math.cos(a + s) * L * 0.3, by + Math.sin(a + s) * L * 0.3, 1.2, '#cfeaf8', alpha * 0.8);
        }
      }
    }
    // snowfall in two depths
    for (let i = 0; i < 150; i++) c.blob(rand() * W, rand() * H, 1 + rand() * 2, '#eef6fc', 0.3 + rand() * 0.4);
    for (let i = 0; i < 45; i++) c.blob(rand() * W, rand() * H, 3.5 + rand() * 3, '#dceaf5', 0.10 + rand() * 0.08);
    // soft snow bank along the bottom
    for (let x = 0; x < W; x++) {
      const top = H * 0.955 + 9 * Math.sin(x * 0.006 + 2) + 5 * Math.sin(x * 0.017);
      for (let y = Math.floor(top); y < H; y++) {
        c.blend(x, y, [214, 232, 244], Math.min(1, (y - top) / 10) * 0.85);
      }
    }
    c.vignette(0.18);
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

