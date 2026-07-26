# >_< TERMCUTE

An animated CLI that restores your original Windows Terminal settings.

TermCute preserves a byte-identical copy of your Windows Terminal settings the
first time it modifies them. This release exposes only the restore flow; the
previous customization code remains in the package source but is not available
from the CLI or TUI.

## Install

```bash
npm install -g termcute
termcute
```

Node.js 18+ and Windows Terminal are required.

## Restore your defaults

Use the animated interface:

```bash
termcute
```

Or restore directly from a script or non-interactive terminal:

```bash
termcute restore
```

Both options restore the exact Windows Terminal settings saved before
TermCute first made a change. If no original backup exists, nothing is
modified.

## Safety

- The original settings file is saved as `settings.termcute-original.json`
  next to Windows Terminal's `settings.json` and is never overwritten.
- Restore writes the original file back atomically, so a crash cannot leave a
  partial settings file.
- `Esc` or `Ctrl+C` closes the interface without changing settings.

## Development

```bash
git clone https://github.com/vishalx0707/termcute.git
cd termcute
node bin/termcute.js
```

MIT
