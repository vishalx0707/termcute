import path from 'node:path';
import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';
import { Timeline } from '../animation/timeline.js';
import { easeOutCubic } from '../animation/easing.js';
import { stagger } from '../animation/slide.js';
import { dim } from '../animation/fade.js';
import { pulseRange } from '../animation/pulse.js';
import { drawPanel } from '../components/card.js';
import { drawStatusBar } from '../components/statusbar.js';
import { chooseCustomImageFile, prepareClipboardCustomImage, prepareCustomImage } from '../home-image/index.js';

/** A small, image-only editor. Theme/agent decisions deliberately live on
 * their own screens so this flow stays about choosing and tuning one image. */
export function createCustomImageScreen(ctx) {
  const timeline = new Timeline();
  const fields = [
    { id: 'path', label: 'Image path', type: 'text', hint: 'paste a local PNG, JPG, GIF, or BMP path' },
    { id: 'upload', label: 'Upload image', type: 'button', hint: 'opens the Windows image picker' },
    { id: 'clipboard', label: 'Paste image', type: 'button', hint: 'copy an image, then press Enter here' },
    { id: 'fit', label: 'Auto fit', type: 'cycle', options: ['smart', 'crop', 'pad'], hint: 'smart crops ordinary landscapes and pads tall or wide art' },
    { id: 'imageOpacity', label: 'Image opacity', type: 'range', min: 10, max: 100, step: 5, hint: 'how visible the background image is' },
    { id: 'terminalOpacity', label: 'Terminal opacity', type: 'range', min: 30, max: 100, step: 5, hint: 'how transparent the terminal itself is' },
    { id: 'preview', label: 'Preview', type: 'button', hint: 'Esc restores your previous terminal appearance' },
    { id: 'apply', label: 'Apply custom image ✨', type: 'button', hint: 'applies this image globally to Windows Terminal' },
  ];
  let entrances = [];
  let index = 0;
  let editing = false;
  let editValue = '';
  let source = '';
  let fit = 'smart';
  let imageOpacity = 46;
  let terminalOpacity = 92;
  let prepared = null;
  let lastError = null;

  const prepare = () => {
    if (!source.trim()) throw new Error('Choose an image path or paste an image first.');
    if (!prepared || prepared.source !== path.resolve(source) || prepared.requestedFit !== fit) {
      prepared = { ...prepareCustomImage(source, { fit }), requestedFit: fit };
    }
    return prepared;
  };

  const buildBackground = () => {
    const image = prepare();
    return {
      opacity: terminalOpacity,
      backgroundImage: image.output,
      backgroundImageOpacity: imageOpacity / 100,
      backgroundImageStretchMode: 'uniformToFill',
    };
  };

  return {
    id: 'custom-image',
    enter() {
      const current = ctx.getCustomImage();
      if (current) {
        source = current.source;
        prepared = current.image;
        fit = current.fit;
        imageOpacity = current.imageOpacity;
        terminalOpacity = current.terminalOpacity;
      }
      timeline.clear();
      entrances = fields.map((_, i) => timeline.add({ duration: 0.35, delay: stagger(i, 0.045), ease: easeOutCubic }));
      index = 0;
      editing = false;
      lastError = null;
    },
    exit() {},
    update(dt) { timeline.update(dt); },
    onKey(key) {
      const field = fields[index];
      if (editing) {
        if (key.name === 'enter') { source = editValue.trim().replace(/^['"]|['"]$/g, ''); prepared = null; editing = false; }
        else if (key.name === 'esc') editing = false;
        else if (key.name === 'backspace') editValue = editValue.slice(0, -1);
        else if (key.name === 'char' || key.name === 'space') editValue += key.ch ?? ' ';
        return;
      }
      if (key.name === 'up') index = (index - 1 + fields.length) % fields.length;
      else if (key.name === 'down' || key.name === 'tab') index = (index + 1) % fields.length;
      else if (key.name === 'left' || key.name === 'right') this.adjust(field, key.name === 'right' ? 1 : -1);
      else if (key.name === 'enter') {
        try {
          if (field.id === 'path') { editing = true; editValue = source; }
          else if (field.id === 'upload') { source = chooseCustomImageFile(); prepared = null; ctx.toast('Image selected', UI.MINT); }
          else if (field.id === 'clipboard') {
            prepared = { ...prepareClipboardCustomImage({ fit }), requestedFit: fit };
            source = prepared.source;
            ctx.toast(`Image ready · ${prepared.width}×${prepared.height}`, UI.MINT);
          } else if (field.id === 'preview') { ctx.preview.applyBackground(buildBackground()); ctx.toast('Custom image previewing — Esc reverts', UI.MINT); }
          else if (field.id === 'apply') this.apply();
          else this.adjust(field, 1);
          lastError = null;
        } catch (err) { lastError = err.message; ctx.toast(err.message, UI.RED); }
      } else if (key.name === 'esc') {
        try { ctx.preview.revert(); } catch (err) { ctx.toast(`Revert failed: ${err.message}`, UI.RED); }
        ctx.go('home');
      }
    },
    adjust(field, direction) {
      if (field.id === 'fit') {
        const at = field.options.indexOf(fit);
        fit = field.options[(at + direction + field.options.length) % field.options.length];
        prepared = null;
      } else if (field.id === 'imageOpacity') imageOpacity = Math.min(field.max, Math.max(field.min, imageOpacity + direction * field.step));
      else if (field.id === 'terminalOpacity') terminalOpacity = Math.min(field.max, Math.max(field.min, terminalOpacity + direction * field.step));
    },
    apply() {
      const background = buildBackground();
      if (ctx.preview.active) { ctx.preview.applyBackground(background); ctx.preview.commit(); }
      else ctx.adapter.applyBackground(background);
      ctx.setCustomImage({ source, image: prepared, fit, imageOpacity, terminalOpacity });
      ctx.sparkles.burst(Math.floor(ctx.fbWidth() * 0.72), Math.floor(ctx.fbHeight() / 2));
      ctx.toast('Custom image applied globally ✨', UI.PINK);
    },
    draw(fb, time) {
      fb.drawText(4, 1, '✦ Custom Image', hexToRgb(UI.PINK));
      fb.drawText(21, 1, 'import · opacity · preview · apply', dim(UI.DIM, 0.9));
      const x = 4; const startY = 4; const labelW = 21;
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i]; const y = startY + i * 2; const focused = i === index;
        if (focused) fb.fillRect(x - 1, y, 53, 1, ' ', null, hexToRgb(UI.SEL_BG));
        fb.drawText(x, y, field.label, focused ? hexToRgb(UI.WHITE) : dim(UI.PINK, (entrances[i]?.value ?? 1) * 0.6), focused ? hexToRgb(UI.SEL_BG) : undefined);
        const valueX = x + labelW;
        if (field.id === 'path') {
          const shown = editing && focused ? editValue : source;
          fb.drawText(valueX, y, (shown || '— choose a file —').slice(-Math.max(12, fb.width - valueX - 5)), focused ? hexToRgb(UI.PINK_SOFT) : dim(UI.WHITE, 0.6));
          if (editing && pulseRange(time, 0, 1, 8) > 0.5) fb.set(valueX + Math.min(shown.length, fb.width - valueX - 6), y, '▌', hexToRgb(UI.PINK));
        } else if (field.id === 'fit') fb.drawText(valueX, y, `‹ ${fit} ›`, focused ? hexToRgb(UI.PINK_SOFT) : dim(UI.WHITE, 0.65));
        else if (field.type === 'range') drawRange(fb, valueX, y, field, field.id === 'imageOpacity' ? imageOpacity : terminalOpacity, focused, time);
        else fb.drawText(valueX, y, `[ ${field.label} ]`, focused ? dim(UI.PINK_SOFT, pulseRange(time, 0.65, 1, 3)) : dim(UI.WHITE, 0.55));
        if (focused) fb.drawText(4, fb.height - 5, field.hint.slice(0, fb.width - 8), dim(UI.DIM, 0.9));
      }
      drawImageInfo(fb, prepared, lastError);
      drawStatusBar(fb, ctx, editing ? 'type path · ⏎ import · esc cancel' : '↑↓ field · ←→ adjust · ⏎ action · esc back');
    },
  };
}

function drawRange(fb, x, y, field, value, focused, time) {
  const width = 16; const filled = Math.round(((value - field.min) / (field.max - field.min)) * width);
  fb.drawText(x, y, '─'.repeat(width), dim(UI.DIMMER, 1));
  fb.drawText(x, y, '━'.repeat(filled), focused ? dim(UI.PINK_DEEP, pulseRange(time, 0.65, 1, 3)) : dim(UI.PINK, 0.6));
  fb.drawText(x + width + 2, y, `${value}%`, focused ? hexToRgb(UI.WHITE) : dim(UI.WHITE, 0.6));
}

function drawImageInfo(fb, image, error) {
  if (fb.width < 72) return;
  const w = Math.min(46, Math.max(28, fb.width - 64)); const x = fb.width - w - 4; const y = 4;
  drawPanel(fb, x, y, w, 8, { title: 'image preview', borderColor: hexToRgb(UI.LAVENDER), bgColor: hexToRgb(UI.BG_PANEL) });
  if (!image) { fb.drawText(x + 3, y + 3, error ? 'Could not import image' : 'No image selected yet', error ? hexToRgb(UI.RED) : dim(UI.WHITE, 0.6)); return; }
  [`source  ${image.width}×${image.height}`, `output  ${image.targetWidth}×${image.targetHeight} PNG`, `fit     ${image.fit === 'crop' ? 'cover crop' : 'contain + padding'}`]
    .forEach((line, i) => fb.drawText(x + 3, y + 2 + i, line, i === 2 ? dim(UI.MINT, 0.9) : dim(UI.WHITE, 0.7)));
}
