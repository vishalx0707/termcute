import { spawn } from 'node:child_process';
import path from 'node:path';
import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';
import { Timeline } from '../animation/timeline.js';
import { easeOutCubic } from '../animation/easing.js';
import { stagger } from '../animation/slide.js';
import { dim } from '../animation/fade.js';
import { drawStatusBar } from '../components/statusbar.js';
import { hasOriginal, listBackups } from '../wt/backup.js';
import { Menu } from '../components/menu.js';
import { drawPanel } from '../components/card.js';

/**
 * Settings: where TermCute is pointed, what safety nets exist, and a way
 * to open the backup folder in Explorer. Read-mostly by design — the
 * dangerous actions live behind their own screens.
 */
export function createSettingsScreen(ctx) {
  const timeline = new Timeline();

  const menu = new Menu([
    {
      label: 'Open backups folder',
      action: () => {
        if (!ctx.adapter.available()) return ctx.toast('No settings folder found', UI.GOLD);
        spawn('explorer', [path.dirname(ctx.adapter.settingsPath)], { detached: true, stdio: 'ignore' }).unref();
        ctx.toast('Opened in Explorer', UI.MINT);
      },
    },
    { label: 'Back', action: () => ctx.go('home') },
  ]);

  return {
    id: 'settings',

    enter() {
      timeline.clear();
      menu.entrances = menu.items.map((_, i) =>
        timeline.add({ duration: 0.4, delay: stagger(i, 0.06, 0.25), ease: easeOutCubic }),
      );
      menu.index = 0;
    },

    exit() {},

    update(dt) {
      timeline.update(dt);
    },

    onKey(key) {
      if (menu.onKey(key)) return;
      if (key.name === 'enter') menu.selected().action();
      else if (key.name === 'esc') ctx.go('home');
    },

    draw(fb, time) {
      fb.drawText(4, 1, '⚙ Settings', hexToRgb(UI.PINK));

      const available = ctx.adapter.available();
      const w = Math.min(fb.width - 8, 78);
      const x = 4;
      const y = 3;

      const backups = available ? listBackups(ctx.adapter.settingsPath) : [];
      const original = available && hasOriginal(ctx.adapter.settingsPath);
      const active = ctx.manager.activeSlug;

      const lines = [
        ['Terminal', available ? 'Windows Terminal ✓' : 'not detected'],
        ['Settings file', available ? shorten(ctx.adapter.settingsPath, w - 22) : '—'],
        ['Original backup', original ? 'saved ✓ — Restore Default will return to it' : 'not created yet (made on first apply)'],
        ['Apply backups', backups.length ? `${backups.length} kept (last 5)` : 'none yet'],
        ['Active theme', active === 'custom' ? 'Custom' : ctx.manager.bySlug(active)?.name ?? 'your original settings'],
      ];

      const h = lines.length * 2 + 3;
      drawPanel(fb, x, y, w, h, { title: 'status', borderColor: hexToRgb(UI.LAVENDER), bgColor: hexToRgb(UI.BG_PANEL) });
      const bg = hexToRgb(UI.BG_PANEL);
      lines.forEach(([label, value], i) => {
        fb.drawText(x + 3, y + 2 + i * 2, label, dim(UI.PINK, 0.7), bg);
        fb.drawText(x + 20, y + 2 + i * 2, String(value), hexToRgb(UI.WHITE), bg);
      });

      menu.draw(fb, x + 1, y + h + 1, time);

      drawStatusBar(fb, ctx, '↑↓ move · ⏎ select · esc back');
    },
  };
}

function shorten(p, max) {
  if (p.length <= max) return p;
  return `…${p.slice(p.length - max + 1)}`;
}
