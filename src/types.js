/**
 * Shared JSDoc typedefs. This file exports nothing at runtime; it exists so
 * editors and reviewers have one place to see the data shapes flowing through
 * the app.
 *
 * @typedef {Object} WTScheme  A Windows Terminal color scheme.
 * @property {string} name        Namespaced "TermCute <Name>".
 * @property {string} background
 * @property {string} foreground
 * @property {string} cursorColor
 * @property {string} selectionBackground
 * @property {string} black
 * @property {string} red
 * @property {string} green
 * @property {string} yellow
 * @property {string} blue
 * @property {string} purple
 * @property {string} cyan
 * @property {string} white
 * @property {string} brightBlack
 * @property {string} brightRed
 * @property {string} brightGreen
 * @property {string} brightYellow
 * @property {string} brightBlue
 * @property {string} brightPurple
 * @property {string} brightCyan
 * @property {string} brightWhite
 *
 * @typedef {Object} ThemeProfile  Profile-level settings a theme controls.
 * @property {number} opacity                 0-100.
 * @property {boolean} useAcrylic
 * @property {string} cursorShape             bar|filledBox|emptyBox|underscore|doubleUnderscore|vintage.
 * @property {string} padding                 e.g. "12" or "8,8,8,8".
 * @property {{face: string, size?: number}} [font]  Only set when the theme specifies one.
 * @property {string|null} backgroundImage    null explicitly clears any image.
 * @property {number} [backgroundImageOpacity]     0-1.
 * @property {string} [backgroundImageStretchMode]
 *
 * @typedef {Object} Theme
 * @property {string} slug         Kebab-case id used by `termcute apply <slug>`.
 * @property {string} name         Display name.
 * @property {string} description  One-liner shown on the preview card.
 * @property {WTScheme} scheme
 * @property {ThemeProfile} profile
 *
 * @typedef {Object} Cell  One framebuffer cell.
 * @property {string} ch
 * @property {number[]|null} fg  [r,g,b] or null for terminal default.
 * @property {number[]|null} bg
 *
 * @typedef {Object} Particle
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} life     Seconds remaining.
 * @property {number} maxLife
 * @property {string} glyph
 * @property {number[]} color
 * @property {number} phase    Free-use per-particle randomness.
 *
 * @typedef {Object} KeyEvent
 * @property {string} name  up|down|left|right|enter|esc|backspace|delete|tab|space|char|ctrl-c
 * @property {string} [ch]  The character, when name === 'char'.
 */
export {};
