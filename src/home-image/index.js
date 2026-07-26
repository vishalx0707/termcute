import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 900;
const SUPPORTED_FITS = new Set(['smart', 'crop', 'pad']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp']);

export const CUSTOM_IMAGE_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'TermCute',
  'custom-images',
);

/**
 * Read an image's dimensions without adding a heavyweight image dependency.
 * The actual resize is intentionally delegated to Windows' built-in GDI+.
 */
export function inspectImage(file) {
  const source = path.resolve(file);
  if (!fs.existsSync(source)) throw new Error(`Image not found: ${source}`);
  const ext = path.extname(source).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) throw new Error('Use a PNG, JPG, GIF, or BMP image.');

  const bytes = fs.readFileSync(source);
  const size = readSize(bytes);
  if (!size || !size.width || !size.height) {
    throw new Error('Could not read this image\'s resolution.');
  }
  return { source, ext, ...size };
}

/** Import (copy + normalize) a local image for Windows Terminal's background. */
export function prepareCustomImage(file, { fit = 'smart' } = {}) {
  if (!SUPPORTED_FITS.has(fit)) throw new Error(`Unknown image fit "${fit}".`);
  const image = inspectImage(file);
  const mode = resolveFit(image.width, image.height, fit);
  fs.mkdirSync(CUSTOM_IMAGE_DIR, { recursive: true });

  const stamp = fs.statSync(image.source);
  const key = crypto.createHash('sha1')
    .update(`${image.source}\0${stamp.size}\0${stamp.mtimeMs}\0${mode}`)
    .digest('hex')
    .slice(0, 16);
  const output = path.join(CUSTOM_IMAGE_DIR, `${key}-${TARGET_WIDTH}x${TARGET_HEIGHT}.png`);
  if (!fs.existsSync(output)) resizeWithWindows(image.source, output, mode);
  if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
    throw new Error('Image preprocessing did not create an output file.');
  }

  return {
    ...image,
    output,
    fit: mode,
    targetWidth: TARGET_WIDTH,
    targetHeight: TARGET_HEIGHT,
  };
}

/** Open the native Windows file picker for the Custom Image screen. */
export function chooseCustomImageFile() {
  if (process.platform !== 'win32') throw new Error('Image upload picker is currently available on Windows.');
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object Windows.Forms.OpenFileDialog
$dialog.Title = 'Choose a custom terminal image'
$dialog.Filter = 'Images|*.png;*.jpg;*.jpeg;*.gif;*.bmp'
$dialog.Multiselect = $false
if ($dialog.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }
$dialog.Dispose()
`;
  const selected = runPowerShell(script, [], true).trim();
  if (!selected) throw new Error('Image selection cancelled.');
  return selected;
}

/** Save a bitmap already copied to the Windows clipboard, then normalize it. */
export function prepareClipboardCustomImage({ fit = 'smart' } = {}) {
  if (process.platform !== 'win32') throw new Error('Clipboard image import is currently available on Windows.');
  fs.mkdirSync(CUSTOM_IMAGE_DIR, { recursive: true });
  const clipboardFile = path.join(CUSTOM_IMAGE_DIR, `clipboard-${Date.now()}.png`);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if (-not [Windows.Forms.Clipboard]::ContainsImage()) { throw 'No image found in the clipboard.' }
$image = [Windows.Forms.Clipboard]::GetImage()
try { $image.Save($tcArgs[0], [Drawing.Imaging.ImageFormat]::Png) } finally { $image.Dispose() }
`;
  runPowerShell(script, [clipboardFile], true);
  if (!fs.existsSync(clipboardFile)) throw new Error('Clipboard image import did not create an image file.');
  return prepareCustomImage(clipboardFile, { fit });
}

export function resolveFit(width, height, fit) {
  if (fit !== 'smart') return fit;
  const sourceRatio = width / height;
  const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;
  // Near-native landscape shots can be safely cover-cropped. Extremely wide,
  // tall, or square artwork gets a calm matte instead of losing its subject.
  return sourceRatio > targetRatio * 0.62 && sourceRatio < targetRatio * 1.65 ? 'crop' : 'pad';
}

function resizeWithWindows(source, output, mode) {
  if (process.platform !== 'win32') {
    throw new Error('Image preprocessing currently requires Windows.');
  }
  const script = `
Add-Type -AssemblyName System.Drawing
$source = $tcArgs[0]; $output = $tcArgs[1]; $mode = $tcArgs[2]
$targetW = [int]$tcArgs[3]; $targetH = [int]$tcArgs[4]
$image = [Drawing.Image]::FromFile($source)
$canvas = New-Object Drawing.Bitmap $targetW, $targetH, ([Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [Drawing.Graphics]::FromImage($canvas)
try {
  $graphics.Clear([Drawing.Color]::FromArgb(255, 22, 18, 28))
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
  $scaleX = $targetW / $image.Width; $scaleY = $targetH / $image.Height
  if ($mode -eq 'pad') { $scale = [Math]::Min($scaleX, $scaleY) } else { $scale = [Math]::Max($scaleX, $scaleY) }
  $drawW = [int][Math]::Round($image.Width * $scale); $drawH = [int][Math]::Round($image.Height * $scale)
  $drawX = [int][Math]::Floor(($targetW - $drawW) / 2); $drawY = [int][Math]::Floor(($targetH - $drawH) / 2)
  $graphics.DrawImage($image, (New-Object Drawing.Rectangle $drawX, $drawY, $drawW, $drawH))
  $canvas.Save($output, [Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $canvas.Dispose(); $image.Dispose() }
`;
  runPowerShell(script, [source, output, mode, TARGET_WIDTH, TARGET_HEIGHT]);
}

function runPowerShell(script, args, sta = false) {
  const argEnv = Object.fromEntries(args.map((arg, i) => [`TERMCUTE_IMAGE_ARG_${i}`, String(arg)]));
  const encoded = Buffer.from(
    `$ErrorActionPreference = 'Stop'\n$tcArgs = @($env:TERMCUTE_IMAGE_ARG_0, $env:TERMCUTE_IMAGE_ARG_1, $env:TERMCUTE_IMAGE_ARG_2, $env:TERMCUTE_IMAGE_ARG_3, $env:TERMCUTE_IMAGE_ARG_4)\n${script}`,
    'utf16le',
  ).toString('base64');
  const result = spawnSync(
    process.env.ComSpec ? 'powershell.exe' : 'pwsh',
    ['-NoProfile', '-NonInteractive', ...(sta ? ['-STA'] : []), '-EncodedCommand', encoded],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ...argEnv },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Windows could not preprocess the image.').trim());
  return result.stdout || '';
}

function readSize(bytes) {
  if (bytes.length >= 24 && bytes.subarray(1, 4).toString() === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 10 && bytes.subarray(0, 3).toString() === 'GIF') {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (bytes.length >= 26 && bytes.subarray(0, 2).toString() === 'BM') {
    return { width: bytes.readUInt32LE(18), height: Math.abs(bytes.readInt32LE(22)) };
  }
  if (bytes.length >= 30 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') {
    const type = bytes.subarray(12, 16).toString();
    if (type === 'VP8X') return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
    if (type === 'VP8L') {
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (type === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return readJpegSize(bytes);
  return null;
}

function readJpegSize(bytes) {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    const length = bytes.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}
