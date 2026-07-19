import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';
import { dim } from '../animation/fade.js';
import { pulseRange } from '../animation/pulse.js';
import { sweep } from './glam.js';

/**
 * The living layer under everything. A designer gradient — deep rose,
 * violet, indigo, midnight blue — cycles in a slow endless loop while a
 * soft wave rolls through it, so the background is always in gentle
 * motion. Over it: a sparse field of twinkling motes and a minimal
 * rounded frame. No bare black space anywhere.
 */

/** Gradient keyframes the loop travels through (dark enough to read over). */
const KEYS = [
  hexToRgb('#241026'), // deep plum
  hexToRgb('#161231'), // violet-indigo
  hexToRgb('#0e1a33'), // midnight blue
  hexToRgb('#190f2e'), // twilight violet
  hexToRgb('#2b0f22'), // dark rose
];

/** Full loop duration in seconds — slow enough to feel ambient, fast
 *  enough that the motion is clearly there. */
const LOOP = 32;

/** Sample the keyframe loop at phase 0..1 with cosine smoothing. */
function sample(phase, out) {
  const p = ((phase % 1) + 1) % 1;
  const scaled = p * KEYS.length;
  const i = Math.floor(scaled);
  const a = KEYS[i % KEYS.length];
  const b = KEYS[(i + 1) % KEYS.length];
  const t = 0.5 - 0.5 * Math.cos((scaled - i) * Math.PI);
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

const GLYPHS = ['·', '˚', '⋆', '✦', '·', '◆', '·', '˖', '✧', '·'];

export class Backdrop {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.rowColors = [];
    this.stars = [];
    this.top = [0, 0, 0];
    this.bot = [0, 0, 0];
  }

  rebuild(w, h) {
    this.w = w;
    this.h = h;
    // one array per row, mutated in place every frame — zero per-frame allocation
    this.rowColors = Array.from({ length: h }, () => [0, 0, 0]);
    this.stars = [];
    for (let y = 1; y < h - 2; y++) {
      for (let x = 1; x < w - 1; x++) {
        const hash = (Math.imul(x + 1, 2654435761) ^ Math.imul(y + 1, 40503)) >>> 0;
        if (hash % 41 !== 0) continue;
        this.stars.push({
          x, y,
          glyph: GLYPHS[hash % GLYPHS.length],
          pink: (hash >> 5) % 3 !== 0, // 2/3 pink, 1/3 lavender
          speed: 0.5 + ((hash >> 8) % 100) / 90,
          phase: ((hash >> 3) % 628) / 100,
        });
      }
    }
  }

  /** @param {import('../engine/framebuffer.js').Framebuffer} fb */
  draw(fb, time) {
    if (fb.width !== this.w || fb.height !== this.h) this.rebuild(fb.width, fb.height);

    // the gradient's two ends drift around the keyframe loop, offset so the
    // screen always spans two moods; a slow wave rolls down through the rows
    const phase = time / LOOP;
    sample(phase, this.top);
    sample(phase + 0.28, this.bot);
    const denom = Math.max(1, this.h - 1);
    for (let y = 0; y < this.h; y++) {
      const wave = 0.07 * Math.sin(time * 0.45 + y * 0.16);
      let u = y / denom + wave;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const color = this.rowColors[y];
      color[0] = Math.round(this.top[0] + (this.bot[0] - this.top[0]) * u);
      color[1] = Math.round(this.top[1] + (this.bot[1] - this.top[1]) * u);
      color[2] = Math.round(this.top[2] + (this.bot[2] - this.top[2]) * u);
      const base = y * this.w;
      for (let x = 0; x < this.w; x++) fb.cells[base + x].bg = color;
    }

    // twinkling motes — calm, sparse
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(time * s.speed + s.phase);
      fb.set(s.x, s.y, s.glyph, dim(s.pink ? UI.PINK : UI.LAVENDER, 0.14 + 0.26 * tw));
    }

    drawFrame(fb, time);
  }
}

function drawFrame(fb, time) {
  const w = fb.width;
  const h = fb.height;
  const border = dim(UI.FRAME, 0.8);

  for (let x = 1; x < w - 1; x++) {
    fb.set(x, 0, '─', border);
    fb.set(x, h - 1, '─', border);
  }
  for (let y = 1; y < h - 1; y++) {
    fb.set(0, y, '│', border);
    fb.set(w - 1, y, '│', border);
  }
  fb.set(0, 0, '╭', border);
  fb.set(w - 1, 0, '╮', border);
  fb.set(0, h - 1, '╰', border);
  fb.set(w - 1, h - 1, '╯', border);

  // blossoms breathing at the corners
  const glow = pulseRange(time, 0.55, 0.95, 1.3);
  fb.set(2, 0, '❀', dim(UI.PINK, glow));
  fb.set(w - 3, 0, '❀', dim(UI.PINK, glow));
  fb.set(2, h - 1, '✿', dim(UI.PINK_DEEP, glow * 0.9));
  fb.set(w - 3, h - 1, '✿', dim(UI.PINK_DEEP, glow * 0.9));

  // title chip rides the wordmark's rose→lavender sweep
  const chip = '· ✿ termcute ✿ ·';
  const cx = Math.floor((w - chip.length) / 2);
  for (let i = 0; i < chip.length; i++) {
    fb.set(cx + i, 0, chip[i], dim(sweep(i / (chip.length - 1), time), 0.8));
  }
}
