/**
 * Windows Terminal's settings.json is JSONC: it may contain // and block
 * comments and trailing commas. This parser strips both with full string
 * awareness — a URL inside a string ("https://…") must never be treated as
 * a comment, and a comma inside a string must never be "trailing".
 *
 * Comments are replaced with spaces (not removed) so that if parsing still
 * fails, the reported error position matches the original file.
 */

export function stripJsonc(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  let inString = false;

  while (i < n) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\') {
        out += text[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
      continue;
    }
    out += c;
    i++;
  }

  return stripTrailingCommas(out);
}

function stripTrailingCommas(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\') {
        out += text[i + 1] ?? '';
        i++;
      } else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') continue; // drop the comma
    }
    out += c;
  }
  return out;
}

/** Parse settings.json text → object. Throws with a friendly message on failure. */
export function parseSettings(text) {
  try {
    return JSON.parse(stripJsonc(text));
  } catch (err) {
    throw new Error(`Could not parse Windows Terminal settings.json: ${err.message}`);
  }
}
