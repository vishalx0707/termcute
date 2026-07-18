import path from 'node:path';
import { hexToRgb } from '../utils.js';
import { UI, CURSOR_SHAPES, ASSETS_DIR } from '../constants.js';
import { Timeline } from '../animation/timeline.js';
import { easeOutCubic } from '../animation/easing.js';
import { stagger } from '../animation/slide.js';
import { fadeIn, dim } from '../animation/fade.js';
import { pulseRange } from '../animation/pulse.js';
import { drawPanel } from '../components/card.js';
import { drawStatusBar } from '../components/statusbar.js';
import { generateCustomTheme } from '../theme/generator.js';

const SUGGESTED_WALLPAPER = path.join(ASSETS_DIR, 'wallpapers', 'red_black_dots.jpg');

/**
 * Custom Theme editor. A full 16-color palette is generated live from the
 * accent color; every field change live-previews (debounced) through the
 * same PreviewSession as Browse, so Esc always means "put it back".
 */
export function createCustomScreen(ctx) {
  const timeline = new Timeline();
  let entrances = [];
  let index = 0;
  let editing = false;
  let editValue = '';
  let debounce = null;

  const fields = [
    { id: 'accent', label: 'Accent color', type: 'text', value: '#ff9ec7', hint: 'hex — the palette grows from this' },
    { id: 'font', label: 'Font face', type: 'text', value: '', hint: 'blank = keep current font' },
    { id: 'image', label: 'Background image', type: 'text', value: '', hint: `blank = none · try ${SUGGESTED_WALLPAPER}` },
    { id: 'opacity', label: 'Opacity', type: 'range', value: 92, min: 30, max: 100, step: 2 },
    { id: 'acrylic', label: 'Acrylic blur', type: 'toggle', value: false },
    { id: 'cursor', label: 'Cursor shape', type: 'cycle', value: 'bar', options: CURSOR_SHAPES },
    { id: 'padding', label: 'Padding', type: 'range', value: 12, min: 0, max: 32, step: 2 },
    { id: 'apply', label: 'Apply Theme ✨', type: 'button' },
  ];

  const get = (id) => fields.find((f) => f.id === id).value;

  const buildTheme = () => {
    return generateCustomTheme({
      accent: get('accent'),
      opacity: get('opacity'),
      useAcrylic: get('acrylic'),
      cursorShape: get('cursor'),
      padding: String(get('padding')),
      fontFace: get('font').trim() || undefined,
      backgroundImage: get('image').trim() || null,
    });
  };

  const schedulePreview = () => {
    if (!ctx.adapter.available()) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      try {
        ctx.preview.apply(buildTheme());
      } catch {
        // invalid accent mid-typing — preview just waits for a valid value
      }
    }, 300);
  };

  return {
    id: 'custom',

    enter() {
      timeline.clear();
      entrances = fields.map((_, i) => timeline.add({ duration: 0.4, delay: stagger(i, 0.05), ease: easeOutCubic }));
      index = 0;
      editing = false;
    },

    exit() {
      clearTimeout(debounce);
      debounce = null;
    },

    update(dt) {
      timeline.update(dt);
    },

    onKey(key) {
      const field = fields[index];

      if (editing) {
        if (key.name === 'enter') {
          field.value = editValue;
          editing = false;
          schedulePreview();
        } else if (key.name === 'esc') {
          editing = false;
        } else if (key.name === 'backspace') {
          editValue = editValue.slice(0, -1);
        } else if (key.name === 'char' || key.name === 'space') {
          editValue += key.ch ?? ' ';
        }
        return;
      }

      if (key.name === 'up') index = (index - 1 + fields.length) % fields.length;
      else if (key.name === 'down' || key.name === 'tab') index = (index + 1) % fields.length;
      else if (key.name === 'left' || key.name === 'right') {
        const dir = key.name === 'right' ? 1 : -1;
        if (field.type === 'range') {
          field.value = Math.min(field.max, Math.max(field.min, field.value + dir * field.step));
          schedulePreview();
        } else if (field.type === 'toggle') {
          field.value = !field.value;
          schedulePreview();
        } else if (field.type === 'cycle') {
          const i = field.options.indexOf(field.value);
          field.value = field.options[(i + dir + field.options.length) % field.options.length];
          schedulePreview();
        }
      } else if (key.name === 'space' && field.type === 'toggle') {
        field.value = !field.value;
        schedulePreview();
      } else if (key.name === 'enter') {
        if (field.type === 'text') {
          editing = true;
          editValue = field.value;
        } else if (field.type === 'toggle') {
          field.value = !field.value;
          schedulePreview();
        } else if (field.type === 'button') {
          this.apply();
        }
      } else if (key.name === 'esc') {
        try {
          ctx.preview.revert();
        } catch (err) {
          ctx.toast(`Revert failed: ${err.message}`, UI.RED);
        }
        ctx.go('home');
      }
    },

    apply() {
      clearTimeout(debounce);
      if (!ctx.adapter.available()) {
        ctx.toast('Windows Terminal not found — nothing to apply to', UI.GOLD);
        return;
      }
      try {
        const theme = buildTheme();
        ctx.preview.apply(theme);
        ctx.preview.commit();
        ctx.manager.refreshActive();
        ctx.sparkles.burst(Math.floor(ctx.fbWidth() * 0.72), Math.floor(ctx.fbHeight() / 2));
        ctx.toast('Custom theme applied — it\'s yours now ✨', UI.PINK);
      } catch (err) {
        ctx.toast(err.message, UI.RED);
      }
    },

    draw(fb, time) {
      fb.drawText(4, 1, '✁ Custom Theme', hexToRgb(UI.PINK));
      if (ctx.adapter.available()) {
        fb.drawText(19, 1, '● LIVE', dim(UI.MINT, pulseRange(time, 0.4, 1, 2.6)));
      }

      const labelW = 18;
      const startY = 4;
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const progress = entrances[i]?.value ?? 1;
        const x = 4;
        const y = startY + i * 2;
        const focused = i === index;
        const glow = focused ? pulseRange(time, 0.65, 1, 3) : 0;

        if (field.type === 'button') {
          const label = `[ ${field.label} ]`;
          fb.drawText(x, y + 1, label, focused ? dim(UI.PINK_DEEP, glow) : fadeIn(dim(UI.DIM, 0.9), progress));
          continue;
        }

        if (focused) fb.fillRect(x - 1, y, labelW + 1, 1, ' ', null, hexToRgb(UI.SEL_BG));
        fb.drawText(x, y, field.label, focused ? hexToRgb(UI.WHITE) : fadeIn(dim(UI.PINK, 0.5), progress), focused ? hexToRgb(UI.SEL_BG) : undefined);
        const vx = x + labelW;

        if (field.type === 'text') {
          const shown = editing && focused ? editValue : field.value;
          const display = shown || (focused ? '' : '—');
          fb.drawText(vx, y, display.slice(-34), focused ? hexToRgb(UI.PINK_SOFT) : dim(UI.WHITE, 0.6));
          if (editing && focused && pulseRange(time, 0, 1, 8) > 0.5) {
            fb.set(vx + Math.min(shown.length, 34), y, '▌', hexToRgb(UI.PINK));
          }
          if (field.id === 'accent') {
            const rgb = hexToRgb(shown);
            if (rgb) fb.drawText(vx + Math.min(shown.length, 34) + 2, y, '████', rgb);
          }
        } else if (field.type === 'range') {
          const barW = 20;
          const t = (field.value - field.min) / (field.max - field.min);
          const filled = Math.round(t * barW);
          fb.drawText(vx, y, '─'.repeat(barW), dim(UI.DIMMER, 1));
          fb.drawText(vx, y, '━'.repeat(filled), focused ? dim(UI.PINK_DEEP, Math.max(glow, 0.7)) : dim(UI.PINK, 0.6));
          fb.drawText(vx + barW + 2, y, String(field.value).padStart(3), focused ? hexToRgb(UI.WHITE) : dim(UI.WHITE, 0.6));
        } else if (field.type === 'toggle') {
          const on = field.value;
          fb.drawText(vx, y, on ? '● on ' : '○ off', on ? dim(UI.MINT, focused ? glow : 0.8) : dim(UI.DIM, 0.9));
        } else if (field.type === 'cycle') {
          fb.drawText(vx, y, `‹ ${field.value} ›`, focused ? dim(UI.PINK_SOFT, Math.max(glow, 0.8)) : dim(UI.WHITE, 0.6));
        }

        if (focused && field.hint) {
          fb.drawText(4, fb.height - 4, field.hint.slice(0, fb.width - 8), dim(UI.DIM, 0.8));
        }
      }

      drawPalettePreview(fb, time, fields, startY);

      const hints = editing
        ? 'type value · ⏎ done · esc cancel edit'
        : '↑↓ field · ←→ adjust · ⏎ edit/apply · esc revert & back';
      drawStatusBar(fb, ctx, hints);
    },
  };
}

/** Right-side live palette generated from the current accent value. */
function drawPalettePreview(fb, time, fields, startY) {
  const accent = fields.find((f) => f.id === 'accent').value;
  const w = 34;
  if (fb.width < 64 + w) return;
  const x = fb.width - w - 3;
  let theme;
  try {
    theme = generateCustomTheme({
      accent,
      opacity: 100,
      useAcrylic: false,
      cursorShape: 'bar',
      padding: '0',
    });
  } catch {
    return; // invalid accent mid-edit — panel simply hides
  }
  const bg = hexToRgb(theme.scheme.background);
  const fg = hexToRgb(theme.scheme.foreground);
  drawPanel(fb, x, startY, w, 11, { title: 'palette', borderColor: hexToRgb(UI.LAVENDER), bgColor: bg });
  const keys = ['black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white'];
  for (const [line, prefix] of [[0, ''], [1, 'bright']]) {
    for (let i = 0; i < keys.length; i++) {
      const key = prefix ? `${prefix}${keys[i][0].toUpperCase()}${keys[i].slice(1)}` : keys[i];
      fb.drawText(x + 3 + i * 3, startY + 2 + line, '██', hexToRgb(theme.scheme[key]), bg);
    }
  }
  fb.drawText(x + 3, startY + 5, '❯ echo "so cute"', hexToRgb(theme.scheme.purple), bg);
  fb.drawText(x + 3, startY + 6, 'so cute', fg, bg);
  fb.drawText(x + 3, startY + 8, `cursor ${hexToRgb(accent) ? '' : '?'}`, dim(fg, 0.5), bg);
  const rgb = hexToRgb(accent);
  if (rgb) fb.drawText(x + 10, startY + 8, '▌▌', rgb, bg);
}
