import { hexToRgb, chars } from '../utils.js';
import { UI } from '../constants.js';
import { Timeline } from '../animation/timeline.js';
import { easeOutCubic, easeOutQuint } from '../animation/easing.js';
import { stagger } from '../animation/slide.js';
import { fadeIn, dim } from '../animation/fade.js';
import { pulseRange } from '../animation/pulse.js';
import { drawLogo, LOGO_HEIGHT } from '../components/logo.js';
import { Menu } from '../components/menu.js';
import { drawStatusBar } from '../components/statusbar.js';

const TAGLINE = 'make your terminal cute ✿';

/**
 * Home: the huge animated logo over falling sakura, tagline typing itself
 * out, and the main menu sliding in item by item.
 */
export function createHomeScreen(ctx) {
  const timeline = new Timeline();
  const menu = new Menu([
    { label: 'Browse Themes', action: () => ctx.go('browse') },
    { label: 'Custom Theme', action: () => ctx.go('custom') },
    { label: 'Settings', action: () => ctx.go('settings') },
    { label: 'Restore Default', action: () => ctx.go('restore') },
    { label: 'Exit', action: () => ctx.quit() },
  ]);

  let logoReveal = null;
  let taglineReveal = null;

  return {
    id: 'home',

    enter() {
      timeline.clear();
      logoReveal = timeline.add({ duration: 0.9, ease: easeOutCubic });
      taglineReveal = timeline.add({ duration: 1.1, delay: 0.7, ease: easeOutQuint });
      menu.entrances = menu.items.map((_, i) =>
        timeline.add({ duration: 0.45, delay: stagger(i, 0.07, 0.5), ease: easeOutCubic }),
      );
    },

    exit() {},

    update(dt) {
      timeline.update(dt);
    },

    onKey(key) {
      if (menu.onKey(key)) return;
      if (key.name === 'enter') menu.selected().action();
      else if (key.name === 'esc') ctx.quit();
    },

    draw(fb, time) {
      const top = Math.max(1, Math.floor((fb.height - (LOGO_HEIGHT + menu.items.length + 7)) / 2));
      const logoRows = drawLogo(fb, time, top, logoReveal?.value ?? 1);

      // tagline types itself out, cursor block blinking at the head
      const tagY = top + logoRows + 1;
      const glyphs = chars(TAGLINE);
      const shown = Math.round((taglineReveal?.value ?? 1) * glyphs.length);
      const tagX = Math.floor((fb.width - glyphs.length) / 2);
      fb.drawText(tagX, tagY, glyphs.slice(0, shown).join(''), dim(UI.PINK_SOFT, 0.9));
      if (shown < glyphs.length && pulseRange(time, 0, 1, 8) > 0.5) {
        fb.set(tagX + shown, tagY, '▌', hexToRgb(UI.PINK));
      }

      const menuX = Math.floor(fb.width / 2) - 9;
      menu.draw(fb, menuX, tagY + 2, time);

      drawFooter(fb, time, ctx);
    },
  };
}

function drawFooter(fb, time, ctx) {
  drawStatusBar(fb, ctx, '↑↓ move · ⏎ select · esc quit');

  if (!ctx.adapter.available()) {
    const warn = '⚠ Windows Terminal not detected — themes can be browsed but not applied';
    fb.drawText(Math.max(1, Math.floor((fb.width - warn.length) / 2)), 1, warn, fadeIn(hexToRgb(UI.GOLD), pulseRange(time, 0.6, 1, 2)));
  }
}
