---
name: verify
description: Verify TermCute end-to-end by driving the real CLI against a scratch copy of Windows Terminal settings
---

# Verifying TermCute

Never point at the real WT settings. Copy them to a scratch dir and use `TERMCUTE_SETTINGS`:

```powershell
$scratch = "<temp dir>"
Copy-Item "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json" "$scratch\settings.json"
$env:TERMCUTE_SETTINGS = "$scratch\settings.json"
```

## Flows worth driving

- `node bin/termcute.js --version` and `list` — smoke; list must show all themes in `themes/`.
- `apply liquid-glass` → parse `$scratch\settings.json`: defaults get `colorScheme "TermCute Liquid Glass"`, `opacity 50`, `useAcrylic false`; scheme upserted into `schemes[]`; **every** `profiles.list` entry must have `background`/`foreground`/`colorScheme`/`opacity` stripped (masking-override regression).
- `apply aurora` (any `@gen:` theme) → `backgroundImage` points into `%LOCALAPPDATA%\TermCute\wallpapers\<name>-v1.png` and the PNG exists. Delete the PNG first to force a repaint through the wallpaper pipeline.
- `restore` → `settings.json` byte-identical (Get-FileHash) to `settings.termcute-original.json`.
- Package boundary: `npm pack --pack-destination $scratch`, then `npm install -g <tgz> --prefix $scratch\npm-prefix`, then run `$scratch\npm-prefix\termcute.cmd` for the same flows — catches `files[]` omissions.

## Probes

- `apply totally-fake-theme` → friendly error, exit 1.
- `apply` (no arg) → usage line, exit 1.
- `"" | node bin/termcute.js` → "needs an interactive terminal", exit 1 (TUI refuses non-TTY).

## Gotchas

- The interactive TUI needs a real TTY; there is no pty harness on this Windows box — eyeball it by running `termcute` in a real terminal.
- Backups accumulate as `settings.termcute-backup-<ts>.json` next to the settings file (last 5 kept); the scratch dir will collect them.
- Wallpapers cache at `%LOCALAPPDATA%\TermCute\wallpapers` and are shared with the real install — deleting one there affects the user's active theme until repainted.
