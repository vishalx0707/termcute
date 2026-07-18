/**
 * Raw-mode keyboard input. Parses escape sequences into named key events
 * ({@link import('../types.js').KeyEvent}) and hands them to a single
 * listener. One chunk may contain several keys (fast typing, key repeat),
 * so parsing walks the chunk rather than assuming one key per event.
 */

const SEQ = new Map([
  ['[A', 'up'],
  ['[B', 'down'],
  ['[C', 'right'],
  ['[D', 'left'],
  ['[H', 'home'],
  ['[F', 'end'],
  ['[3~', 'delete'],
  ['[5~', 'pageup'],
  ['[6~', 'pagedown'],
  ['OA', 'up'],
  ['OB', 'down'],
  ['OC', 'right'],
  ['OD', 'left'],
]);

export class Input {
  /** @param {(key: import('../types.js').KeyEvent) => void} onKey */
  constructor(onKey) {
    this.onKey = onKey;
    this.handler = (chunk) => this.parse(chunk);
  }

  start() {
    const { stdin } = process;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.on('data', this.handler);
    stdin.resume();
  }

  stop() {
    const { stdin } = process;
    stdin.off('data', this.handler);
    if (stdin.isTTY) stdin.setRawMode(false);
    stdin.pause();
  }

  parse(chunk) {
    let i = 0;
    while (i < chunk.length) {
      const c = chunk[i];
      if (c === '\x1b') {
        let matched = false;
        // longest sequences first so '[3~' wins over a hypothetical '[3'
        for (const [seq, name] of [...SEQ.entries()].sort((a, b) => b[0].length - a[0].length)) {
          if (chunk.startsWith(seq, i + 1)) {
            this.onKey({ name });
            i += 1 + seq.length;
            matched = true;
            break;
          }
        }
        if (!matched) {
          // a lone ESC (or an unknown sequence we skip wholesale)
          this.onKey({ name: 'esc' });
          if (chunk[i + 1] === '[' || chunk[i + 1] === 'O') {
            i += 2;
            while (i < chunk.length && !/[a-zA-Z~]/.test(chunk[i])) i++;
            i++;
          } else {
            i++;
          }
        }
        continue;
      }
      i++;
      if (c === '\x03') this.onKey({ name: 'ctrl-c' });
      else if (c === '\r' || c === '\n') this.onKey({ name: 'enter' });
      else if (c === '\x7f' || c === '\b') this.onKey({ name: 'backspace' });
      else if (c === '\t') this.onKey({ name: 'tab' });
      else if (c === ' ') this.onKey({ name: 'space' });
      else if (c >= ' ') this.onKey({ name: 'char', ch: c });
    }
  }
}
