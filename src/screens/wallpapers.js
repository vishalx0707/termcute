import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';
import { Timeline } from '../animation/timeline.js';
import { easeOutCubic } from '../animation/easing.js';
import { stagger } from '../animation/slide.js';
import { dim } from '../animation/fade.js';
import { pulseRange } from '../animation/pulse.js';
import { drawPanel } from '../components/card.js';
import { drawStatusBar } from '../components/statusbar.js';
import { allWallpaperNames } from '../wallpaper/index.js';

const DETAILS = {
  sakura: 'Falling petals over a deep plum night',
  'liquid-glass': 'Iridescent frosted glass and soft caustics',
  notes: 'Ruled paper with a red margin and ink lines',
};

/** Built-in wallpaper picker kept separate from Custom Image: no file path,
 * no agent selection, just preview one of TermCute's own artworks. */
export function createWallpapersScreen(ctx) {
  const timeline = new Timeline();
  const wallpapers = allWallpaperNames();
  let index = 0;
  let entrances = [];

  const buildBackground = () => {
    const name = wallpapers[index];
    return {
      backgroundImage: `@gen:${name}`,
      backgroundImageOpacity: name === 'notes' ? 1 : 0.5,
      backgroundImageStretchMode: 'uniformToFill',
    };
  };

  return {
    id: 'wallpapers',
    enter() {
      timeline.clear();
      entrances = wallpapers.map((_, i) => timeline.add({ duration: 0.35, delay: stagger(i, 0.06), ease: easeOutCubic }));
      index = 0;
    },
    exit() {},
    update(dt) { timeline.update(dt); },
    onKey(key) {
      if (key.name === 'up' || key.name === 'down') {
        index = (index + (key.name === 'down' ? 1 : -1) + wallpapers.length) % wallpapers.length;
      } else if (key.name === 'enter') {
        try {
          ctx.preview.applyBackground(buildBackground());
          ctx.preview.commit();
          ctx.sparkles.burst(Math.floor(ctx.fbWidth() * 0.72), Math.floor(ctx.fbHeight() / 2));
          ctx.toast(`${formatName(wallpapers[index])} wallpaper applied ✨`, UI.PINK);
        } catch (err) { ctx.toast(`Wallpaper failed: ${err.message}`, UI.RED); }
      } else if (key.name === 'space') {
        try { ctx.preview.applyBackground(buildBackground()); ctx.toast('Wallpaper previewing — Esc reverts', UI.MINT); }
        catch (err) { ctx.toast(`Preview failed: ${err.message}`, UI.RED); }
      } else if (key.name === 'esc') {
        try { ctx.preview.revert(); } catch (err) { ctx.toast(`Revert failed: ${err.message}`, UI.RED); }
        ctx.go('home');
      }
    },
    draw(fb, time) {
      fb.drawText(4, 1, '✦ Built-in Wallpapers', hexToRgb(UI.PINK));
      fb.drawText(26, 1, 'preview or apply one artwork', dim(UI.DIM, 0.9));
      const x = 4; const y = 5;
      wallpapers.forEach((name, i) => {
        const row = y + i * 2; const focused = i === index; const progress = entrances[i]?.value ?? 1;
        if (focused) fb.fillRect(x - 1, row, 36, 1, ' ', null, hexToRgb(UI.SEL_BG));
        fb.drawText(x, row, focused ? '❯' : ' ', focused ? hexToRgb(UI.PINK_DEEP) : dim(UI.DIM, 0.5), focused ? hexToRgb(UI.SEL_BG) : undefined);
        fb.drawText(x + 3, row, formatName(name), focused ? hexToRgb(UI.WHITE) : dim(UI.PINK, progress * 0.65), focused ? hexToRgb(UI.SEL_BG) : undefined);
      });
      drawPreview(fb, wallpapers[index]);
      const hint = '↑↓ select · space preview · ⏎ apply · esc revert & back';
      drawStatusBar(fb, ctx, hint);
    },
  };
}

function drawPreview(fb, name) {
  if (fb.width < 66) return;
  const w = Math.min(44, fb.width - 43); const x = fb.width - w - 4; const y = 4;
  drawPanel(fb, x, y, w, 10, { title: 'wallpaper', borderColor: hexToRgb(UI.LAVENDER), bgColor: hexToRgb(UI.BG_PANEL) });
  fb.drawText(x + 3, y + 2, formatName(name), hexToRgb(UI.PINK_SOFT));
  fb.drawText(x + 3, y + 4, (DETAILS[name] || '').slice(0, w - 6), dim(UI.WHITE, 0.7));
  fb.drawText(x + 3, y + 6, 'Generated once, then cached locally.', dim(UI.MINT, 0.75));
  fb.drawText(x + 3, y + 7, 'It stays available after updates.', dim(UI.WHITE, 0.55));
}

function formatName(name) {
  return name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}
