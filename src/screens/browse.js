import { hexToRgb } from '../utils.js';
import { UI, PREVIEW_DEBOUNCE_MS } from '../constants.js';
import { Timeline } from '../animation/timeline.js';
import { easeOutCubic } from '../animation/easing.js';
import { stagger } from '../animation/slide.js';
import { fadeIn, dim } from '../animation/fade.js';
import { pulseRange } from '../animation/pulse.js';
import { drawPanel } from '../components/card.js';
import { drawScrollbar } from '../components/scrollbar.js';
import { drawStatusBar } from '../components/statusbar.js';

/**
 * Browse Themes. The centerpiece interaction: moving the selection live-
 * restyles the actual terminal around the TUI (debounced writes via the
 * PreviewSession), Esc reverts to the pre-browse state, Enter commits
 * permanently with a sparkle burst. Rows fade in and the selection is a
 * solid highlight bar that moves cell-exact — nothing slides, nothing shakes.
 */
export function createBrowseScreen(ctx) {
  const timeline = new Timeline();
  let index = 0;
  let entrances = [];
  let cardIn = null;
  let debounce = null;
  let scrollOffset = 0;

  const themes = () => ctx.manager.themes;
  const listWidth = () => Math.max(...themes().map((t) => t.name.length)) + 9;

  const schedulePreview = () => {
    if (!ctx.adapter.available()) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try {
        ctx.preview.apply(themes()[index]);
      } catch (err) {
        ctx.toast(`Preview failed: ${err.message}`, UI.RED);
      }
    }, PREVIEW_DEBOUNCE_MS);
  };

  return {
    id: 'browse',

    enter() {
      timeline.clear();
      entrances = themes().map((_, i) => timeline.add({ duration: 0.35, delay: stagger(i, 0.04), ease: easeOutCubic }));
      cardIn = timeline.add({ duration: 0.5, delay: 0.1, ease: easeOutCubic });
      const activeIdx = themes().findIndex((t) => t.slug === ctx.manager.activeSlug);
      if (activeIdx >= 0) index = activeIdx;
    },

    exit() {
      clearTimeout(debounce);
      debounce = null;
    },

    update(dt) {
      timeline.update(dt);
    },

    onKey(key) {
      const list = themes();
      if (key.name === 'up' || key.name === 'down') {
        index = (index + (key.name === 'down' ? 1 : -1) + list.length) % list.length;
        schedulePreview();
        return;
      }
      if (key.name === 'enter') {
        clearTimeout(debounce);
        if (!ctx.adapter.available()) {
          ctx.toast('Windows Terminal not found — nothing to apply to', UI.GOLD);
          return;
        }
        try {
          ctx.preview.apply(list[index]); // ensure what's on disk is this theme
          ctx.preview.commit();
          ctx.manager.refreshActive();
          ctx.sparkles.burst(Math.floor(ctx.fbWidth() * 0.7), Math.floor(ctx.fbHeight() / 2));
          ctx.toast(`${list[index].name} applied — it's yours now ✨`, UI.PINK);
        } catch (err) {
          ctx.toast(`Apply failed: ${err.message}`, UI.RED);
        }
        return;
      }
      if (key.name === 'esc') {
        try {
          ctx.preview.revert();
        } catch (err) {
          ctx.toast(`Revert failed: ${err.message}`, UI.RED);
        }
        ctx.go('home');
      }
    },

    draw(fb, time) {
      const list = themes();
      drawHeader(fb, time, ctx);

      // ── theme list (left) ─────────────────────────────
      const listX = 4;
      const listY = 4;
      const barW = listWidth();
      const visible = Math.max(3, fb.height - listY - 4);
      if (index < scrollOffset) scrollOffset = index;
      if (index >= scrollOffset + visible) scrollOffset = index - visible + 1;

      for (let row = 0; row < Math.min(visible, list.length); row++) {
        const i = scrollOffset + row;
        if (i >= list.length) break;
        const theme = list[i];
        const progress = entrances[i]?.value ?? 1;
        const y = listY + row;
        const selected = i === index;
        const applied = theme.slug === ctx.manager.activeSlug;

        if (selected) {
          const glow = pulseRange(time, 0.65, 1, 2.4);
          const selBg = hexToRgb(UI.SEL_BG);
          fb.fillRect(listX - 1, y, barW, 1, ' ', null, selBg);
          fb.drawText(listX, y, '❯', dim(UI.PINK_DEEP, glow), selBg);
          fb.drawText(listX + 2, y, theme.name, hexToRgb(UI.WHITE), selBg);
          if (applied) fb.drawText(listX + 2 + theme.name.length + 1, y, '● applied', dim(UI.MINT, 0.9), selBg);
        } else {
          fb.drawText(listX + 2, y, theme.name, fadeIn(dim(UI.PINK, 0.5), progress));
          if (applied) fb.drawText(listX + 2 + theme.name.length + 1, y, '●', fadeIn(dim(UI.MINT, 0.8), progress));
        }
      }
      drawScrollbar(fb, listX + barW, listY, visible, list.length, visible, scrollOffset);

      // ── preview card (right) ──────────────────────────
      const cardW = Math.min(46, fb.width - listX - barW - 8);
      if (cardW >= 30) {
        const cardX = fb.width - cardW - 3;
        drawCard(fb, time, cardX, 3, cardW, Math.min(19, fb.height - 6), list[index], ctx, cardIn?.value ?? 1);
      }

      const hints = ctx.adapter.available()
        ? '↑↓ browse (live!) · ⏎ apply forever · esc revert & back'
        : '↑↓ browse · esc back';
      drawStatusBar(fb, ctx, hints);
    },
  };
}

function drawHeader(fb, time, ctx) {
  fb.drawText(4, 1, '✿ Browse Themes', hexToRgb(UI.PINK));
  if (ctx.adapter.available()) {
    const glow = pulseRange(time, 0.4, 1, 2.6);
    fb.drawText(20, 1, '● LIVE', dim(UI.MINT, glow));
    fb.drawText(27, 1, 'your whole terminal restyles as you browse', dim(UI.DIM, 0.85));
  }
  fb.drawText(4, 2, '─'.repeat(Math.max(0, fb.width - 8)), dim(UI.FRAME, 0.5));
}

function drawCard(fb, time, x, y, w, h, theme, ctx, progress) {
  const bg = hexToRgb(theme.scheme.background);
  const fg = hexToRgb(theme.scheme.foreground);
  drawPanel(fb, x, y, w, h, { title: `❀ ${theme.name}`, borderColor: fadeIn(hexToRgb(UI.PINK), progress), bgColor: bg });

  let row = y + 2;
  fb.drawText(x + 3, row, theme.description.slice(0, w - 6), dim(fg, 0.75), bg);
  row += 2;

  // 16 swatches, normal + bright rows
  const keys = ['black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white'];
  for (const [line, prefix] of [[0, ''], [1, 'bright']]) {
    for (let i = 0; i < keys.length; i++) {
      const key = prefix ? `${prefix}${keys[i][0].toUpperCase()}${keys[i].slice(1)}` : keys[i];
      const color = hexToRgb(theme.scheme[key]);
      fb.drawText(x + 3 + i * 4, row + line, '██▌', color, bg);
    }
  }
  row += 3;

  // fake prompt rendered in the theme's own colors
  fb.drawText(x + 3, row, '❯', hexToRgb(theme.scheme.purple), bg);
  fb.drawText(x + 5, row, 'echo', hexToRgb(theme.scheme.green), bg);
  fb.drawText(x + 10, row, '"hello cutie"', hexToRgb(theme.scheme.yellow), bg);
  row += 1;
  fb.drawText(x + 3, row, 'hello cutie', fg, bg);
  row += 2;

  const p = theme.profile;
  const meta = [
    `opacity ${p.opacity}%${p.useAcrylic ? ' · acrylic blur' : ''}`,
    `cursor ${p.cursorShape} · padding ${p.padding}`,
    p.backgroundImage ? 'full background artwork ✦' : null,
    p.font?.face ? `font ${p.font.face}` : null,
    p.retroEffect ? 'CRT scanline effect' : null,
  ].filter(Boolean);
  for (const line of meta) {
    if (row >= y + h - 2) break;
    fb.drawText(x + 3, row++, line.slice(0, w - 6), dim(fg, 0.55), bg);
  }

  if (theme.slug === ctx.manager.activeSlug) {
    fb.drawText(x + 3, y + h - 2, '● currently applied', hexToRgb(UI.MINT), bg);
  }
}
