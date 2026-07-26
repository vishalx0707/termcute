#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PKG_ROOT } from '../src/constants.js';
import { hexToRgb } from '../src/utils.js';

/**
 * CLI entry. No args → the animated TUI. Subcommands cover scripted use.
 *
 *   termcute                 launch the TUI
 *   termcute list            list built-in themes with swatches
 *   termcute apply <slug>    apply a theme permanently
 *   termcute restore         restore the original settings
 *   termcute custom-image    normalize and apply a custom image
 */

const c = (hex, s) => {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
};
const swatch = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m██\x1b[0m`;
};
const version = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case undefined: {
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        console.error('termcute needs an interactive terminal. Try `termcute list` or `termcute apply <theme>`.');
        process.exit(1);
      }
      const { runApp } = await import('../src/app.js');
      runApp();
      break;
    }

    case 'list': {
      const { loadThemes } = await import('../src/theme/loader.js');
      const { WTAdapter } = await import('../src/wt/adapter.js');
      const adapter = new WTAdapter();
      const active = adapter.available() ? adapter.activeSchemeName() : null;
      console.log(c('#ff9ec7', '\n  >_<  TermCute themes\n'));
      for (const theme of loadThemes()) {
        const s = theme.scheme;
        const swatches = [s.red, s.green, s.yellow, s.blue, s.purple, s.cyan].map(swatch).join('');
        const mark = s.name === active ? c('#9be8c8', ' ● applied') : '';
        console.log(`  ${swatches}  ${c('#f5f0f4', theme.slug.padEnd(14))} ${c('#6b6470', theme.description)}${mark}`);
      }
      console.log(c('#6b6470', '\n  termcute apply <slug> · or just `termcute` for the animated picker\n'));
      break;
    }

    case 'apply': {
      const slug = rest[0];
      if (!slug) exitWith('Usage: termcute apply <theme-slug>   (see `termcute list`)');
      const { loadThemes } = await import('../src/theme/loader.js');
      const { WTAdapter } = await import('../src/wt/adapter.js');
      const theme = loadThemes().find((t) => t.slug === slug);
      if (!theme) exitWith(`Unknown theme "${slug}". Run \`termcute list\`.`);
      const adapter = new WTAdapter();
      if (!adapter.available()) exitWith('Windows Terminal settings.json not found.');
      adapter.applyTheme(theme);
      console.log(c('#ff9ec7', `\n  ✿ ${theme.name} applied permanently — enjoy! `) + c('#6b6470', '(termcute restore brings your old terminal back)\n'));
      break;
    }

    case 'restore': {
      const { WTAdapter } = await import('../src/wt/adapter.js');
      const { restoreOriginal } = await import('../src/wt/restore.js');
      const result = restoreOriginal(new WTAdapter());
      if (!result.ok) exitWith(result.reason);
      console.log(c('#9be8c8', '\n  ✓ Your original terminal settings are back.\n'));
      break;
    }

    case 'custom-image': {
      const parsed = parseCustomImageArgs(rest);
      const { WTAdapter } = await import('../src/wt/adapter.js');
      const { prepareClipboardCustomImage, prepareCustomImage } = await import('../src/home-image/index.js');
      const adapter = new WTAdapter();
      if (!adapter.available()) exitWith('Windows Terminal settings.json not found.');
      const image = parsed.clipboard ? prepareClipboardCustomImage({ fit: parsed.fit }) : prepareCustomImage(parsed.source, { fit: parsed.fit });
      adapter.applyBackground({ backgroundImage: image.output, backgroundImageOpacity: 0.46, backgroundImageStretchMode: 'uniformToFill' });
      console.log(c('#9be8c8', `\n  ✓ Custom image applied (${image.width}×${image.height} → ${image.targetWidth}×${image.targetHeight}, ${image.fit}).\n`));
      break;
    }

    case '-v':
    case '--version':
      console.log(version);
      break;

    case '-h':
    case '--help':
    default:
      console.log(`
  ${c('#ff9ec7', '>_<  TERMCUTE')} ${c('#6b6470', `v${version} — make your terminal cute`)}

  ${c('#f5f0f4', 'termcute')}                ${c('#6b6470', 'launch the animated theme picker')}
  ${c('#f5f0f4', 'termcute list')}           ${c('#6b6470', 'list built-in themes')}
  ${c('#f5f0f4', 'termcute apply <slug>')}   ${c('#6b6470', 'apply a theme permanently')}
  ${c('#f5f0f4', 'termcute restore')}        ${c('#6b6470', 'switch back to your original terminal')}
  ${c('#f5f0f4', 'termcute custom-image <path>')} ${c('#6b6470', 'normalize and apply a custom image')}
`);
      if (cmd && !['-h', '--help'].includes(cmd)) process.exit(1);
  }
} catch (err) {
  console.error(`\n  ✗ ${err.message}\n`);
  process.exit(1);
}

function exitWith(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

function parseCustomImageArgs(args) {
  let source = null;
  let clipboard = false;
  let fit = 'smart';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--clipboard') clipboard = true;
    else if (arg === '--fit') {
      fit = args[++i];
      if (!fit) exitWith('Usage: termcute custom-image <path> [--fit smart|crop|pad]');
    } else if (!arg.startsWith('-') && !source) source = arg;
    else exitWith('Usage: termcute custom-image <path>|--clipboard [--fit smart|crop|pad]');
  }
  if (!clipboard && !source) exitWith('Provide an image path or use --clipboard.');
  if (clipboard && source) exitWith('Use either an image path or --clipboard, not both.');
  if (!['smart', 'crop', 'pad'].includes(fit)) exitWith('Fit must be smart, crop, or pad.');
  return { source, clipboard, fit };
}
