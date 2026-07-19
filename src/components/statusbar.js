import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';
import { dim } from '../animation/fade.js';
import { gradientText } from './glam.js';

/**
 * Bottom status bar, drawn on every screen. Left: a small chip naming the
 * theme currently applied to the real terminal ("default" until one is) —
 * the persistent current-theme indicator. Center: key hints. Right: version.
 */
export function drawStatusBar(fb, ctx, hints) {
  const y = fb.height - 2;
  const bg = hexToRgb(UI.BG_PANEL);
  fb.fillRect(1, y, fb.width - 2, 1, ' ', null, bg);

  const slug = ctx.manager.activeSlug;
  const name = slug === null
    ? 'default'
    : slug === 'custom' ? 'Custom' : (ctx.manager.bySlug(slug)?.name ?? 'Custom');
  const chip = ` ♥ ${name} `;
  if (slug === null) {
    fb.drawText(2, y, chip, hexToRgb(UI.DIM), hexToRgb(UI.CHIP_BG));
  } else {
    // an applied theme wears the wordmark gradient
    gradientText(fb, 2, y, chip, Date.now() / 1000, { bg: hexToRgb(UI.CHIP_BG) });
  }

  fb.drawText(Math.max(chip.length + 4, Math.floor((fb.width - hints.length) / 2)), y, hints, dim(UI.DIM, 0.95), bg);

  const version = `v${ctx.version} `;
  fb.drawText(fb.width - version.length - 2, y, version, dim(UI.DIMMER, 1), bg);
}
