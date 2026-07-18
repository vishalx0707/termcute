import { Timeline } from '../animation/timeline.js';
import { UI } from '../constants.js';
import { Modal } from '../components/modal.js';
import { restoreOriginal } from '../wt/restore.js';

/**
 * Restore Default — the "give me my old terminal back" escape hatch.
 * A single confirm modal, then the original settings.json (captured the
 * first time TermCute ever touched it) is restored byte-for-byte.
 */
export function createRestoreScreen(ctx) {
  const timeline = new Timeline();
  let modal = null;

  return {
    id: 'restore',

    enter() {
      timeline.clear();
      modal = new Modal({
        title: 'Restore Default',
        lines: [
          'Return Windows Terminal to your original settings?',
          '',
          'This restores the exact settings you had before TermCute',
          'ever changed anything. Themes applied since will be undone.',
        ],
        options: ['Restore', 'Cancel'],
        defaultIndex: 1,
      });
      modal.open(timeline);
    },

    exit() {},

    update(dt) {
      timeline.update(dt);
    },

    onKey(key) {
      const result = modal.onKey(key);
      if (result === 'cancel' || (result === 'confirm' && modal.options[modal.index] === 'Cancel')) {
        ctx.go('home');
        return;
      }
      if (result === 'confirm') {
        const outcome = restoreOriginal(ctx.adapter);
        if (outcome.ok) {
          ctx.manager.refreshActive();
          ctx.sparkles.burst(Math.floor(ctx.fbWidth() / 2), Math.floor(ctx.fbHeight() / 2));
          ctx.toast('Your original terminal is back ✿', UI.MINT);
        } else {
          ctx.toast(outcome.reason, UI.GOLD);
        }
        ctx.go('home');
      }
    },

    draw(fb, time) {
      modal.draw(fb, time);
    },
  };
}
