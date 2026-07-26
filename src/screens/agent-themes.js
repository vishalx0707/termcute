import { hexToRgb } from '../utils.js';
import { UI } from '../constants.js';
import { Timeline } from '../animation/timeline.js';
import { easeOutCubic } from '../animation/easing.js';
import { stagger } from '../animation/slide.js';
import { dim } from '../animation/fade.js';
import { pulseRange } from '../animation/pulse.js';
import { drawPanel } from '../components/card.js';
import { drawStatusBar } from '../components/statusbar.js';

/** Pick a theme and apply it globally — the theme shows up in every
 *  terminal tab, including when you type agent commands like `opencode`,
 *  `claude`, `codex`, or `gh` in any shell. */
export function createAgentThemesScreen(ctx) {
  const timeline = new Timeline();
  let agents = [];
  let index = 0;
  let entrances = [];
  let themeIndex = -1;

  const rows = () => [
    { id: 'theme', label: 'Theme', type: 'theme' },
    ...agents.map((agent) => ({ id: `agent:${agent.id}`, agent, type: 'agent' })),
    { id: 'apply', label: 'Apply theme globally', type: 'button' },
  ];

  const apply = () => {
    if (themeIndex === -1) throw new Error('Pick a theme first (use ←→ arrows).');
    const theme = structuredClone(ctx.manager.themes[themeIndex]);
    // Preserve the user's existing custom background image from
    // profiles.defaults — merge it into the theme so the wallpaper
    // stays visible alongside the new color scheme.
    if (!theme.profile?.backgroundImage) {
      try {
        const settings = ctx.adapter.readJson();
        const defaults = Array.isArray(settings.profiles) ? {} : (settings.profiles?.defaults || {});
        if (defaults.backgroundImage && typeof defaults.backgroundImage === 'string') {
          theme.profile = theme.profile || {};
          theme.profile.backgroundImage = defaults.backgroundImage;
          theme.profile.backgroundImageOpacity = defaults.backgroundImageOpacity ?? 0.3;
          theme.profile.backgroundImageStretchMode = defaults.backgroundImageStretchMode ?? 'uniformToFill';
          // Keep the user's terminal opacity if the theme doesn't set one
          if (theme.profile.opacity === undefined && defaults.opacity !== undefined) {
            theme.profile.opacity = defaults.opacity;
          }
        }
      } catch { /* can't read settings — apply without image */ }
    }
    ctx.adapter.applyTheme(theme, { scope: 'global' });
    cleanupStaleAgentProfiles(ctx.adapter);
    ctx.sparkles.burst(Math.floor(ctx.fbWidth() * 0.72), Math.floor(ctx.fbHeight() / 2));
    ctx.toast(`${theme.name} applied globally`, UI.PINK);
  };

  return {
    id: 'agent-themes',
    enter() {
      agents = ctx.agents.scan();
      index = 0;
      themeIndex = -1;
      timeline.clear();
      entrances = rows().map((_, i) => timeline.add({ duration: 0.35, delay: stagger(i, 0.045), ease: easeOutCubic }));
    },
    exit() {},
    update(dt) { timeline.update(dt); },
    onKey(key) {
      const list = rows(); const row = list[index];
      if (key.name === 'up') index = (index - 1 + list.length) % list.length;
      else if (key.name === 'down' || key.name === 'tab') index = (index + 1) % list.length;
      else if (key.name === 'left' || key.name === 'right') this.adjust(row, key.name === 'right' ? 1 : -1);
      else if (key.name === 'enter') {
        try {
          if (row.type === 'theme') this.adjust(row, 1);
          else if (row.id === 'apply') apply();
        } catch (err) { ctx.toast(err.message, UI.RED); }
      } else if (key.name === 'esc') ctx.go('home');
    },
    adjust(row, direction) {
      if (row.type === 'theme') {
        const choices = [-1, ...ctx.manager.themes.map((_, i) => i)];
        const at = choices.indexOf(themeIndex);
        themeIndex = choices[(at + direction + choices.length) % choices.length];
      }
    },
    draw(fb, time) {
      fb.drawText(4, 1, '✦ Agent Themes', hexToRgb(UI.PINK));
      fb.drawText(20, 1, 'pick a theme — applies to all terminals globally', dim(UI.DIM, 0.9));
      const list = rows(); const x = 4; const startY = 4;
      for (let i = 0; i < list.length; i++) {
        const row = list[i]; const y = startY + i * 2; const focused = i === index;
        if (focused) fb.fillRect(x - 1, y, 52, 1, ' ', null, hexToRgb(UI.SEL_BG));
        const color = focused ? hexToRgb(UI.WHITE) : dim(UI.PINK, (entrances[i]?.value ?? 1) * 0.6);
        if (row.type === 'agent') {
          const status = row.agent.available ? 'detected' : 'not found';
          fb.drawText(x, y, `  ${row.agent.name}`, row.agent.available ? (focused ? hexToRgb(UI.WHITE) : dim(UI.MINT, 0.75)) : dim(UI.DIM, 0.8), focused ? hexToRgb(UI.SEL_BG) : undefined);
          fb.drawText(x + 27, y, status, row.agent.available ? dim(UI.WHITE, 0.55) : dim(UI.RED, 0.75), focused ? hexToRgb(UI.SEL_BG) : undefined);
        } else if (row.type === 'theme') {
          fb.drawText(x, y, 'Theme', color, focused ? hexToRgb(UI.SEL_BG) : undefined);
          const themeLabel = themeIndex === -1 ? '← pick a theme →' : ctx.manager.themes[themeIndex].name;
          fb.drawText(x + 18, y, `‹ ${themeLabel} ›`, focused ? hexToRgb(UI.PINK_SOFT) : dim(UI.WHITE, 0.65));
        } else {
          fb.drawText(x, y, `[ ${row.label} ]`, focused ? dim(UI.PINK_SOFT, pulseRange(time, 0.65, 1, 3)) : dim(UI.WHITE, 0.65));
        }
      }
      drawInfo(fb, agents, themeIndex, ctx.manager.themes);
      drawStatusBar(fb, ctx, '←→ choose theme · ⏎ apply · esc back');
    },
  };
}

function drawInfo(fb, agents, themeIndex, themes) {
  if (fb.width < 74) return;
  const w = 39; const x = fb.width - w - 4; const y = 4;
  drawPanel(fb, x, y, w, 8, { title: 'how it works', borderColor: hexToRgb(UI.LAVENDER), bgColor: hexToRgb(UI.BG_PANEL) });
  const detected = agents.filter((a) => a.available).length;
  const themeName = themeIndex === -1 ? 'none' : themes[themeIndex].name;
  const lines = [
    `${detected} agents detected on PATH`,
    `theme: ${themeName}`,
    'applies to profiles.defaults',
    'visible in every terminal tab',
  ];
  lines.forEach((line, i) => fb.drawText(x + 3, y + 2 + i, line.slice(0, w - 6), i === 0 ? dim(UI.MINT, 0.85) : dim(UI.WHITE, 0.65)));
}

/** Remove any leftover TermCute Agent profiles (no GUID) from previous
 *  runs that used the per-profile approach. */
function cleanupStaleAgentProfiles(adapter) {
  try {
    const settings = adapter.readJson();
    const list = Array.isArray(settings.profiles) ? settings.profiles : settings.profiles?.list;
    if (!list) return;
    let changed = false;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (p && !p.guid && typeof p.commandline === 'string') {
        list.splice(i, 1);
        changed = true;
      }
    }
    if (changed) adapter.writeJson(settings);
  } catch { /* best effort */ }
}
