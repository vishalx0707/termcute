import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_ORIGINAL, BACKUP_PREFIX, BACKUP_KEEP } from '../constants.js';
import { timestamp } from '../utils.js';

/**
 * Backup rules — the contract the whole app trusts:
 *  1. The ORIGINAL backup is written once, the very first time TermCute ever
 *     touches this settings file, and is NEVER overwritten afterward. It is
 *     what "Restore Default" returns the user to.
 *  2. A timestamped backup is written on every permanent apply, capturing
 *     the state *before* that apply. Only the newest BACKUP_KEEP are kept.
 * Both live next to settings.json, where Windows Terminal ignores them.
 */

export function originalPath(settingsPath) {
  return path.join(path.dirname(settingsPath), BACKUP_ORIGINAL);
}

export function hasOriginal(settingsPath) {
  return fs.existsSync(originalPath(settingsPath));
}

/** Write the original backup if — and only if — it doesn't exist yet. */
export function ensureOriginal(settingsPath, rawText) {
  const dest = originalPath(settingsPath);
  if (fs.existsSync(dest)) return false;
  fs.writeFileSync(dest, rawText, 'utf8');
  return true;
}

/** Save `rawText` (the pre-change state) as a timestamped backup, then prune. */
export function saveTimestamped(settingsPath, rawText) {
  const dir = path.dirname(settingsPath);
  const dest = path.join(dir, `${BACKUP_PREFIX}${timestamp()}.json`);
  fs.writeFileSync(dest, rawText, 'utf8');
  prune(settingsPath);
  return dest;
}

export function listBackups(settingsPath) {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => path.join(dir, f));
}

function prune(settingsPath) {
  for (const file of listBackups(settingsPath).slice(BACKUP_KEEP)) {
    try {
      fs.unlinkSync(file);
    } catch {
      // a locked/vanished backup is not worth failing an apply over
    }
  }
}
