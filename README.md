# >_< TERMCUTE

A heavily animated CLI that makes your terminal cute.

TermCute customizes Windows Terminal with live preview, safe backups, and a
one-key way back to your original setup.

## Install

```bash
npm install -g termcute
termcute
```

Zero dependencies. No build step. Node.js 18+ and Windows Terminal are
required.

## Available features

- **Browse Themes** — preview built-in themes live and apply one permanently.
- **Custom Theme** — generate a cohesive terminal palette from an accent color,
  with live-previewed terminal settings.
- **Custom Image** — choose an image, paste one from the clipboard, or provide
  a local path; TermCute normalizes it before previewing and applying it.
- **Restore Defaults** — restore the byte-identical Windows Terminal settings
  saved before TermCute first made a change.

Built-in Wallpapers, Agent Themes, and Settings are no longer exposed in the
CLI or TUI. Their disabled UI modules are kept locally and are not included in
the published package.

When applying a theme while a background image is active, the interactive
picker asks whether to keep it. Choosing **Yes** preserves the image while
updating the theme's colors and text styling; choosing **No** lets the theme
replace it.

## CLI

```bash
termcute                                      # animated picker
termcute list                                 # list built-in themes
termcute apply <slug>                         # apply a theme permanently
termcute custom-image <path> [--fit smart|crop|pad]
termcute custom-image --clipboard
termcute restore                              # restore original settings
```

## Safety

- The first modification saves `settings.termcute-original.json` next to
  Windows Terminal's settings file and never overwrites it.
- Writes are atomic, and live preview is reverted on `Esc`, `Ctrl+C`, or a
  crash.

## Development

```bash
git clone https://github.com/vishalx0707/termcute.git
cd termcute
node bin/termcute.js
```

MIT
