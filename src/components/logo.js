import fs from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR } from '../constants.js';
import { chars, hslToRgb } from '../utils.js';
import { shimmerBand, boost } from '../animation/shimmer.js';
import { fadeIn } from '../animation/fade.js';
import { pulseRange } from '../animation/pulse.js';

/**
 * The huge ">_<  TERMCUTE" logo. Block art lives in assets/ascii/logo.txt;
 * this component paints it with a living pink→lavender gradient that slowly
 * drifts hue, plus a shimmer band sweeping across on a loop. Falls back to
 * a one-line logo when the terminal is too narrow for the block art.
 */

const raw = fs.readFileSync(path.join(ASSETS_DIR, 'ascii', 'logo.txt'), 'utf8');
const sections = {};
let current = null;
for (const line of raw.split(/\r?\n/)) {
  if (line.startsWith('@@')) {
    current = line.slice(2);
    sections[current] = [];
  } else if (current && line.length) {
    sections[current].push(line);
  }
}

const KAOMOJI = sections.KAOMOJI ?? [];
const TITLE = sections.TITLE ?? [];
const SMALL = (sections.SMALL ?? ['>_< TERMCUTE'])[0];

const TITLE_WIDTH = Math.max(...TITLE.map((l) => chars(l).length));
const KAOMOJI_WIDTH = Math.max(...KAOMOJI.map((l) => chars(l).length));

export const LOGO_HEIGHT = KAOMOJI.length + 1 + TITLE.length;
export const LOGO_WIDTH = TITLE_WIDTH;

/**
 * @param {import('../engine/framebuffer.js').Framebuffer} fb
 * @param {number} time    global seconds
 * @param {number} y       top row
 * @param {number} reveal  0..1 entrance progress (tween value)
 * @returns {number} rows consumed (so callers can lay out below it)
 */
export function drawLogo(fb, time, y, reveal = 1) {
  if (fb.width < TITLE_WIDTH + 2) return drawSmall(fb, time, y, reveal);

  const gradient = makeGradient(time);
  const shimmer = shimmerBand(time, TITLE_WIDTH);

  // kaomoji — brighter, pulses gently like a heartbeat
  const kx = Math.floor((fb.width - KAOMOJI_WIDTH) / 2);
  const glow = pulseRange(time, 0.75, 1, 1.8);
  for (let row = 0; row < KAOMOJI.length; row++) {
    const line = chars(KAOMOJI[row]);
    const rowReveal = revealFor(reveal, row, KAOMOJI.length + TITLE.length);
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') continue;
      const color = fadeIn(gradient(i / KAOMOJI_WIDTH).map((c) => c * glow), rowReveal);
      fb.set(kx + i, y + row, line[i], color);
    }
  }

  // title — per-column gradient + shimmer sweep
  const tx = Math.floor((fb.width - TITLE_WIDTH) / 2);
  const ty = y + KAOMOJI.length + 1;
  for (let row = 0; row < TITLE.length; row++) {
    const line = chars(TITLE[row]);
    const rowReveal = revealFor(reveal, KAOMOJI.length + row, KAOMOJI.length + TITLE.length);
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') continue;
      let color = gradient(i / TITLE_WIDTH);
      color = boost(color, shimmer(i));
      fb.set(tx + i, ty + row, line[i], fadeIn(color, rowReveal));
    }
  }

  return KAOMOJI.length + 1 + TITLE.length;
}

function drawSmall(fb, time, y, reveal) {
  const gradient = makeGradient(time);
  const line = chars(SMALL);
  const x = Math.max(0, Math.floor((fb.width - line.length) / 2));
  const shimmer = shimmerBand(time, line.length);
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') continue;
    fb.set(x + i, y + 1, line[i], fadeIn(boost(gradient(i / line.length), shimmer(i)), reveal));
  }
  return 3;
}

/** Pink → lavender, hue drifting slowly so the logo never sits still. */
function makeGradient(time) {
  const drift = Math.sin(time * 0.35) * 14;
  return (t) => hslToRgb(330 + drift - t * 55, 0.82, 0.72);
}

/** Rows reveal top-to-bottom as the entrance tween runs. */
function revealFor(reveal, row, totalRows) {
  const rowStart = (row / totalRows) * 0.7;
  return Math.max(0, Math.min(1, (reveal - rowStart) / 0.3));
}
