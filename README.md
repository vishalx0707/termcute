# >_< TERMCUTE

A heavily animated CLI that makes your terminal cute.

TermCute is **not** a terminal emulator — it customizes the terminal you already have. It edits your terminal's own configuration (Windows Terminal for now), with live preview, safe backups, and a one-key way back to your original setup.

```
██╗            ██╗
╚██╗          ██╔╝
 ╚██╗        ██╔╝       falling sakura ❀, a shimmering gradient logo,
 ██╔╝        ╚██╗       and your whole terminal restyling live
██╔╝ ▄▄▄▄▄▄▄  ╚██╗      as you browse themes.
╚═╝  ▀▀▀▀▀▀▀   ╚═╝
```

## Install

```bash
npm install -g termcute
termcute
```

Zero dependencies. No build step. Node ≥ 18, Windows Terminal.

## What it feels like

Launching `termcute` opens a full-screen animated TUI: a huge `>_< TERMCUTE` logo painted in a living pink→lavender gradient with a shimmer sweeping across it, sakura petals falling over a designer gradient backdrop that cycles rose → violet → indigo in a slow endless loop with a wave rolling through it, twinkling motes, smooth fade-in menus with a solid highlight bar, and sparkle bursts when a theme lands.

- **Browse Themes** — move the selection and *your actual terminal restyles around you* in real time (Windows Terminal hot-reloads its settings). `Esc` puts everything back exactly as it was. `Enter` applies **permanently** — it survives restarting the terminal, rebooting, or shutting down, because it's written into Windows Terminal's own settings.
- **Custom Theme** — pick an accent color and TermCute generates a full cohesive 16-color palette from it. Set background image, font, opacity, acrylic blur, cursor shape, and padding — all live-previewed as you adjust.
- **Settings** — see exactly which file TermCute manages and what backups exist.
- **Restore Default** — returns Windows Terminal to the **byte-identical** settings you had before TermCute ever touched it. Your old terminal is always one keypress away.
- **Current theme, always visible** — a small `♥` chip in the status bar names the theme currently applied to your real terminal (`default` until you apply one).

TermCute also clears per-profile `background`/`foreground`/opacity overrides when applying — Windows Terminal lets those silently mask a color scheme, which is why themes from other tools often look like they "didn't apply". (Your originals are in the backup.)

## Built-in themes

Themes restyle the **whole terminal** — not just the prompt colors. Current built-ins cover frosted glass, notebook paper, deep-water tones, and multiple retro terminal looks.

| theme | vibe |
|---|---|
| `liquid-glass` | Apple-style frosted glass — your desktop glows through the terminal |
| `notes` | Ruled notebook paper — blue lines, a red margin, ink-dark text |
| `ocean` | Deep water light — teal currents over navy depths |
| `matcha` | Green tea and cream — earthy, warm, and calm |
| `minimal` | Quiet monochrome — muted tones, zero noise |
| `amoled` | True black, pixels off — vivid color on the void |
| `retro-crt` | Green phosphor terminal — 1982 called, it looks great |
| `retro-amber` | Monochrome amber phosphor terminal — glowing amber scanlines |
| `retro-commodore` | Commodore 64 console — classic 80s blue screen scanlines |
| `retro-cyberpunk` | Vaporwave HUD console — hot neon magenta glowing scanlines |
| `retro-pipboy` | Fallout Pip-Boy terminal — radioactive green phosphors |

`liquid-glass` is true acrylic glass transparency — it uses Windows Terminal's native Acrylic blur with the desktop showing through at a highly transparent 20% opacity.

## CLI

```bash
termcute                # the animated picker
termcute list           # themes with color swatches
termcute apply liquid-glass  # apply straight from the shell
termcute restore        # switch back to your original terminal
termcute backups        # list safety backups
```

## Safety

Your settings file is treated as precious:

- The **first time** TermCute ever modifies your settings, it saves `settings.termcute-original.json` next to them — written once, never overwritten. That's what *Restore Default* restores.
- Every permanent apply also saves a timestamped backup (last 5 kept).
- Writes are atomic (temp file + rename) — a crash can never half-write your settings.
- Live preview snapshots the file before touching it and reverts on `Esc`, `Ctrl+C`, or even a crash.
- Windows Terminal's JSONC (comments, trailing commas) is parsed properly, and every theme is validated before a single byte is written.

## Scope

TermCute only changes what the terminal itself exposes: colors, fonts, background image, transparency/acrylic, cursor, padding. No unsupported UI hacks.

## Future

- Adapters: Ghostty, Kitty, WezTerm, Alacritty, iTerm2
- Palette generation from a wallpaper image

## Development

```bash
git clone <repo> && cd termcute
node bin/termcute.js          # run from source — no install needed
```

Architecture: `src/engine` (30 fps framebuffer renderer with synchronized output), `src/animation` (timeline + easing that all motion runs on), `src/particles` (sakura/sparkle emitters), `src/screens` + `src/components` (the TUI), `src/theme` (JSON theme catalog + accent-color palette generator), `src/wallpaper` (zero-dep PNG encoder + procedural background artwork, painted into `%LOCALAPPDATA%\TermCute\wallpapers`), `src/wt` (the only code that knows what a Windows Terminal settings.json looks like — future terminals get their own adapter folder).

MIT
