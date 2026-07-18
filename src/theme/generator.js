import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../utils.js';
import { SCHEME_PREFIX } from '../constants.js';

/**
 * Builds a full Windows Terminal theme from a single accent color.
 *
 * Design: the six ANSI hues keep their SEMANTIC hue families (red stays
 * red-ish, green green-ish — errors and diffs must remain readable) but
 * their saturation/lightness are normalized and gently pulled toward the
 * accent hue, while background, selection, and cursor are built directly
 * from the accent. The result reads as one cohesive palette rather than
 * eight random colors.
 */

const ANSI_HUES = { red: 0, green: 130, yellow: 45, blue: 220, purple: 285, cyan: 180 };

/**
 * @param {object} opts
 * @param {string} opts.accent            hex color the palette grows from
 * @param {number} opts.opacity           0-100
 * @param {boolean} opts.useAcrylic
 * @param {string} opts.cursorShape
 * @param {string} opts.padding
 * @param {string} [opts.fontFace]
 * @param {string|null} [opts.backgroundImage]
 * @param {number} [opts.backgroundImageOpacity]
 * @returns {import('../types.js').Theme}
 */
export function generateCustomTheme({
  accent,
  opacity,
  useAcrylic,
  cursorShape,
  padding,
  fontFace,
  backgroundImage = null,
  backgroundImageOpacity = 0.3,
}) {
  const rgb = hexToRgb(accent);
  if (!rgb) throw new Error(`"${accent}" is not a valid hex color.`);
  const [h] = rgbToHsl(rgb);

  const tinted = (baseHue, s, l) => {
    // pull each semantic hue ~18° toward the accent, shortest way around
    let delta = ((h - baseHue + 540) % 360) - 180;
    return rgbToHex(hslToRgb(baseHue + delta * 0.12, s, l));
  };

  const scheme = {
    name: `${SCHEME_PREFIX}Custom`,
    background: rgbToHex(hslToRgb(h, 0.32, 0.06)),
    foreground: rgbToHex(hslToRgb(h, 0.14, 0.88)),
    cursorColor: rgbToHex(rgb),
    selectionBackground: rgbToHex(hslToRgb(h, 0.45, 0.24)),
    black: rgbToHex(hslToRgb(h, 0.22, 0.13)),
    brightBlack: rgbToHex(hslToRgb(h, 0.14, 0.4)),
    white: rgbToHex(hslToRgb(h, 0.12, 0.8)),
    brightWhite: rgbToHex(hslToRgb(h, 0.08, 0.96)),
  };
  for (const [name, hue] of Object.entries(ANSI_HUES)) {
    scheme[name] = tinted(hue, 0.62, 0.62);
    const bright = `bright${name[0].toUpperCase()}${name.slice(1)}`;
    scheme[bright] = tinted(hue, 0.72, 0.72);
  }

  return {
    slug: 'custom',
    name: 'Custom',
    description: `Generated from ${accent}`,
    scheme,
    profile: {
      opacity,
      useAcrylic,
      cursorShape,
      padding,
      ...(fontFace ? { font: { face: fontFace } } : {}),
      backgroundImage,
      ...(backgroundImage ? { backgroundImageOpacity } : {}),
    },
  };
}
