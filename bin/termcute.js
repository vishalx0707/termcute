#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PKG_ROOT } from '../src/constants.js';
import { hexToRgb } from '../src/utils.js';

/**
 * CLI entry. No args → the animated restore UI. The restore subcommand is
 * available for scripted use.
 *
 *   termcute                 launch the restore UI
 *   termcute restore         restore the original settings
 */

const c = (hex, s) => {
  const [r, g, b] = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
};
const version = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;
const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case undefined: {
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        console.error('termcute needs an interactive terminal. Try `termcute restore`.');
        process.exit(1);
      }
      const { runApp } = await import('../src/app.js');
      runApp();
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

    case '-v':
    case '--version':
      console.log(version);
      break;

    case '-h':
    case '--help':
    default:
      console.log(`
  ${c('#ff9ec7', '>_<  TERMCUTE')} ${c('#6b6470', `v${version} — restore your terminal defaults`)}

  ${c('#f5f0f4', 'termcute')}                ${c('#6b6470', 'launch the animated restore UI')}
  ${c('#f5f0f4', 'termcute restore')}        ${c('#6b6470', 'switch back to your original terminal')}
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
