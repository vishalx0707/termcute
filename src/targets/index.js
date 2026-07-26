import fs from 'node:fs';
import path from 'node:path';

/**
 * Each agent has:
 *  - id/name/command: the basics
 *  - matchNames: lowercase substrings that positively identify a WT profile
 *    by its `name` field (checked case-insensitively)
 *  - matchCommands: executable basenames (without extension) that can appear
 *    in the profile's `commandline` field.  The adapter matches with an
 *    optional .exe/.cmd/.bat/.ps1 suffix and word-boundary awareness.
 *  - source: optional `source` field value that WT itself sets on some
 *    built-in profiles (e.g. "Windows.Terminal.Wsl" for WSL distros).
 */
const AGENTS = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    matchNames: ['claude code', 'claude'],
    matchCommands: ['claude'],
  },
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    matchNames: ['codex'],
    matchCommands: ['codex'],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    command: 'opencode',
    matchNames: ['opencode', 'open code'],
    matchCommands: ['opencode'],
  },
  {
    id: 'github',
    name: 'GitHub CLI',
    command: 'gh',
    matchNames: ['github cli', 'github copilot'],
    matchCommands: ['gh'],
  },
  {
    id: 'aider',
    name: 'Aider',
    command: 'aider',
    matchNames: ['aider'],
    matchCommands: ['aider'],
  },
  {
    id: 'amp',
    name: 'Amp',
    command: 'amp',
    matchNames: ['amp', 'sourcegraph'],
    matchCommands: ['amp'],
  },
];

/** Detect installed agent CLIs and create dedicated Windows Terminal profiles
 * for only the selected agents. */
export class AgentTargetManager {
  constructor(adapter) {
    this.adapter = adapter;
  }

  scan() {
    return AGENTS.map((agent) => ({ ...agent, available: commandOnPath(agent.command) }));
  }

  apply(theme, ids) {
    const selected = this.scan().filter((agent) => ids.includes(agent.id));
    if (!selected.length) throw new Error('Select at least one agent CLI.');
    const unavailable = selected.find((agent) => !agent.available);
    if (unavailable) throw new Error(`${unavailable.name} is not available.`);
    this.adapter.applyAgentTheme(theme, selected);
    return selected;
  }

  applyDefault(background, ids) {
    const selected = this.scan().filter((agent) => ids.includes(agent.id));
    if (!selected.length) throw new Error('Select at least one agent CLI.');
    const unavailable = selected.find((agent) => !agent.available);
    if (unavailable) throw new Error(`${unavailable.name} is not available.`);
    this.adapter.applyAgentDefault(background, selected);
    return selected;
  }
}

function commandOnPath(command) {
  const paths = (process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  return paths.some((dir) => extensions.some((ext) => fs.existsSync(path.join(dir, `${command}${ext}`))));
}
