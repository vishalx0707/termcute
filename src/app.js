import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { PKG_ROOT, UI } from './constants.js';
import { hexToRgb } from './utils.js';
import { Loop } from './engine/loop.js';
import { Framebuffer } from './engine/framebuffer.js';
import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { ResizeWatcher, size } from './engine/resize.js';
import { Timeline } from './animation/timeline.js';
import { easeOutBack } from './animation/easing.js';
import { fadeIn, dim } from './animation/fade.js';
import { ParticleEngine } from './particles/particle-engine.js';
import { SakuraEmitter } from './particles/emitters/sakura.js';
import { SparkleEmitter } from './particles/emitters/sparkles.js';
import { Backdrop } from './components/backdrop.js';
import { WTAdapter } from './wt/adapter.js';
import { PreviewSession } from './wt/preview.js';
import { ThemeManager } from './theme/manager.js';
import { createHomeScreen } from './screens/home.js';
import { createBrowseScreen } from './screens/browse.js';
import { createCustomScreen } from './screens/custom.js';
import { createSettingsScreen } from './screens/settings.js';
import { createRestoreScreen } from './screens/restore.js';

/**
 * The app shell: owns the loop, framebuffer, particles, and screen state
 * machine. Guarantees that no matter how the process ends — Esc, Ctrl+C,
 * crash — the terminal leaves the alt screen with its cursor back, and any
 * uncommitted live preview is reverted.
 */
export function runApp() {
  const app = new App();
  app.start();
}

class App {
  constructor() {
    const { width, height } = size();
    this.fb = new Framebuffer(width, height);
    this.renderer = new Renderer();
    this.adapter = new WTAdapter();
    this.preview = new PreviewSession(this.adapter);
    this.manager = new ThemeManager(this.adapter);
    this.version = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;

    this.backdrop = new Backdrop();
    this.particles = new ParticleEngine();
    this.particles.addEmitter(new SakuraEmitter());
    this.sparkles = this.particles.addEmitter(new SparkleEmitter());

    this.toastState = null;
    this.appTimeline = new Timeline();

    const ctx = {
      adapter: this.adapter,
      preview: this.preview,
      manager: this.manager,
      sparkles: this.sparkles,
      version: this.version,
      go: (id) => this.go(id),
      quit: () => this.quit(),
      toast: (msg, color) => this.toast(msg, color),
      fbWidth: () => this.fb.width,
      fbHeight: () => this.fb.height,
    };

    this.screens = {
      home: createHomeScreen(ctx),
      browse: createBrowseScreen(ctx),
      custom: createCustomScreen(ctx),
      settings: createSettingsScreen(ctx),
      restore: createRestoreScreen(ctx),
    };
    this.screen = this.screens.home;

    this.input = new Input((key) => this.onKey(key));
    this.resizeWatcher = new ResizeWatcher(this.fb);
    this.loop = new Loop((dt, time) => this.tick(dt, time));
  }

  start() {
    this.installSafetyNets();
    this.pregenWallpapers();
    this.renderer.enter();
    this.input.start();
    this.resizeWatcher.start();
    this.screen.enter();
    this.loop.start();
  }

  go(id) {
    this.screen.exit?.();
    this.screen = this.screens[id];
    this.screen.enter();
  }

  onKey(key) {
    if (key.name === 'ctrl-c') return this.quit();
    this.screen.onKey(key);
  }

  tick(dt, time) {
    this.appTimeline.update(dt);
    this.screen.update(dt, time);
    this.particles.update(dt, time, { width: this.fb.width, height: this.fb.height });

    this.fb.clear();
    this.backdrop.draw(this.fb, time);
    this.particles.draw(this.fb);
    this.screen.draw(this.fb, time);
    this.drawToast(time);
    this.renderer.render(this.fb);
  }

  /** Paint theme wallpapers in a detached child so the very first live
   *  preview never pauses the animation — by the time the user reaches
   *  Browse, the PNGs are already on disk. */
  pregenWallpapers() {
    try {
      const mod = pathToFileURL(path.join(PKG_ROOT, 'src', 'wallpaper', 'index.js')).href;
      spawn(
        process.execPath,
        ['-e', `import(${JSON.stringify(mod)}).then(m => m.ensureAllWallpapers()).catch(() => {})`],
        { detached: true, stdio: 'ignore' },
      ).unref();
    } catch { /* wallpapers will paint lazily on first apply instead */ }
  }

  toast(msg, colorHex = UI.PINK) {
    this.toastState = {
      msg,
      color: colorHex,
      pop: this.appTimeline.add({ duration: 0.4, ease: easeOutBack }),
      bornAt: this.loop.time,
      ttl: 2.8,
    };
  }

  drawToast(time) {
    const t = this.toastState;
    if (!t) return;
    const age = time - t.bornAt;
    if (age > t.ttl) {
      this.toastState = null;
      return;
    }
    const fadeOut = Math.min(1, (t.ttl - age) / 0.4);
    const pop = t.pop.value;
    const text = ` ${t.msg} `;
    const x = Math.floor((this.fb.width - text.length) / 2);
    const y = this.fb.height - 4 + Math.round((1 - pop) * 2);
    this.fb.drawText(x, y, text, fadeIn(hexToRgb('#1a1420'), fadeOut), fadeIn(dim(t.color, 0.95), Math.min(pop, fadeOut)));
  }

  quit() {
    try {
      this.preview.revert(); // never leave a half-browsed theme applied
    } catch {
      // settings write failed on the way out — original backup still protects the user
    }
    this.shutdown();
    process.exit(0);
  }

  shutdown() {
    this.loop.stop();
    this.input.stop();
    this.resizeWatcher.stop();
    this.renderer.leave();
  }

  installSafetyNets() {
    process.on('exit', () => this.renderer.leave());
    process.on('SIGTERM', () => this.quit());
    process.on('uncaughtException', (err) => {
      try {
        this.preview.revert();
      } catch { /* best effort */ }
      this.shutdown();
      console.error('\ntermcute crashed (your terminal settings are safe — backups are next to settings.json):\n');
      console.error(err);
      process.exit(1);
    });
  }
}
