import { saveTimestamped } from './backup.js';

/**
 * Live-preview session. Browsing themes writes to the real settings file
 * (Windows Terminal hot-reloads, so the terminal restyles around the user)
 * — this class is what makes that safe:
 *
 *   begin()  → snapshot the current file text
 *   apply()  → write a theme, no timestamped backup (previews are ephemeral)
 *   revert() → put the snapshot back verbatim (Esc / quit / crash path)
 *   commit() → keep what's on disk; the snapshot becomes the timestamped
 *              backup, so "undo last apply" state is exactly pre-browse
 */
export class PreviewSession {
  /** @param {import('./adapter.js').WTAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
    this.snapshot = null;
    this.active = false;
  }

  begin() {
    if (this.active || !this.adapter.available()) return;
    this.snapshot = this.adapter.readRaw();
    this.active = true;
  }

  apply(theme) {
    if (!this.adapter.available()) return;
    if (!this.active) this.begin();
    this.adapter.applyTheme(theme, { timestampBackup: false });
  }

  revert() {
    if (!this.active) return;
    this.adapter.writeRaw(this.snapshot);
    this.end();
  }

  commit() {
    if (!this.active) return;
    saveTimestamped(this.adapter.settingsPath, this.snapshot);
    this.end();
  }

  end() {
    this.snapshot = null;
    this.active = false;
  }
}
