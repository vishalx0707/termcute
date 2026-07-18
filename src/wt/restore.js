import fs from 'node:fs';
import { originalPath, hasOriginal } from './backup.js';

/**
 * "Restore Default" — put back the settings file exactly as it was before
 * TermCute ever touched it, byte for byte. The original backup is left in
 * place afterward so restore stays repeatable.
 *
 * @param {import('./adapter.js').WTAdapter} adapter
 * @returns {{ok: boolean, reason?: string}}
 */
export function restoreOriginal(adapter) {
  if (!adapter.available()) {
    return { ok: false, reason: 'Windows Terminal settings.json not found.' };
  }
  if (!hasOriginal(adapter.settingsPath)) {
    return { ok: false, reason: 'No original backup found — TermCute has not modified this terminal yet.' };
  }
  const original = fs.readFileSync(originalPath(adapter.settingsPath), 'utf8');
  adapter.writeRaw(original);
  return { ok: true };
}
