/**
 * generate-brand-assets — ONE-OFF brand asset generator (redesign-stage-2 §3.4 + the §10-3
 * UPGRADED ruling: og-image regenerated from the new mark). Run manually:
 *
 *   node apps/dashboard/tools/generate-brand-assets.mts
 *
 * (Node ≥ 23 type-stripping runs the .mts + its .ts imports directly — no new dependency, no
 * build-step coupling; the COMMITTED binaries are the contract, verified by brand-assets.spec.ts.)
 *
 * Emits into apps/dashboard/public/:
 *   - favicon.svg          — the arc-X monogram (ink rounded-square field, gammaAmber strokes)
 *   - favicon.ico          — 16×16 + 32×32 entries (PNG-compressed), same geometry
 *   - apple-touch-icon.png — 180×180, opaque ink field
 *   - og-image.png         — 1200×630, the CONVEXA lockup on ink (minimal composition)
 *
 * Geometry is single-sourced from `shared/ui/arc.ts`; the ONLY color literals are the token
 * VALUES imported from `shared/theme/tokens.ts` (the blog-generator precedent — static assets
 * can't consume the theme; §8-5 pins favicon.svg's hexes byte-exact to tokens).
 *
 * Rasterization: headless Chrome/Edge screenshots (already on every dev machine — no dependency).
 * Override the browser with CHROME_BIN if needed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gammaAmber, ink, phosphor } from '../src/app/shared/theme/tokens.ts';
import {
  ARC_X_FAVICON_STROKE,
  ARC_X_PATHS,
  ARC_X_STROKE,
  ARC_X_VIEWBOX,
} from '../src/app/shared/ui/arc.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '..', 'public');
const ARCHIVO_WOFF2 = resolve(PUBLIC, 'fonts', 'archivo', 'archivo-latin-standard-normal.woff2');

// ---------------------------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------------------------

function findBrowser(): string {
  const candidates = [
    process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter((c): c is string => Boolean(c));
  const hit = candidates.find((c) => existsSync(c));
  if (!hit) throw new Error('No Chrome/Edge found — set CHROME_BIN');
  return hit;
}

const BROWSER = findBrowser();
const WORK = mkdtempSync(join(tmpdir(), 'convexa-brand-'));

function screenshot(
  html: string,
  name: string,
  width: number,
  height: number,
  transparent: boolean,
): Buffer {
  const page = join(WORK, `${name}.html`);
  const out = join(WORK, `${name}.png`);
  writeFileSync(page, html);
  execFileSync(BROWSER, [
    '--headless=new',
    '--disable-gpu',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    `--user-data-dir=${join(WORK, 'profile')}`,
    ...(transparent ? ['--default-background-color=00000000'] : []),
    '--virtual-time-budget=4000',
    `--screenshot=${out}`,
    `--window-size=${width},${height}`,
    pathToFileURL(page).href,
  ]);
  const png = readFileSync(out);
  const [w, h] = pngDims(png);
  if (w !== width || h !== height)
    throw new Error(`${name}: got ${w}×${h}, wanted ${width}×${height}`);
  return png;
}

/** PNG IHDR width/height (big-endian u32 at offsets 16/20). */
function pngDims(png: Buffer): [number, number] {
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

// ---------------------------------------------------------------------------------------------
// The monogram SVG (shared by favicon.svg, the .ico entries, and the apple-touch icon)
// ---------------------------------------------------------------------------------------------

/** The two arc-X strokes, inset within the field via a centered scale. */
function glyph(scale: number, stroke: number): string {
  return (
    `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">` +
    ARC_X_PATHS.map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${gammaAmber}" stroke-width="${stroke}" stroke-linecap="round"/>`,
    ).join('') +
    `</g>`
  );
}

/** rounded=true → the browser-tab monogram; rounded=false → the opaque apple-touch field. */
function monogramSvg(rounded: boolean): string {
  const field = rounded
    ? `<rect width="100" height="100" rx="24" fill="${ink}"/>`
    : `<rect width="100" height="100" fill="${ink}"/>`;
  // Small-size master: heavier stroke than the lockup, glyph inset clear of the corner radius.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ARC_X_VIEWBOX}">` +
    field +
    glyph(rounded ? 0.66 : 0.6, ARC_X_FAVICON_STROKE) +
    `</svg>`
  );
}

function iconHtml(svg: string, size: number): string {
  return (
    `<!doctype html><html><head><style>` +
    `html,body{margin:0;padding:0;background:transparent}` +
    `svg{display:block;width:${size}px;height:${size}px}` +
    `</style></head><body>${svg}</body></html>`
  );
}

// ---------------------------------------------------------------------------------------------
// ICO container (PNG-compressed entries — valid for all modern browsers/Windows)
// ---------------------------------------------------------------------------------------------

function buildIco(entries: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const dirs: Buffer[] = [];
  const blobs: Buffer[] = [];
  let offset = 6 + 16 * entries.length;
  for (const { size, png } of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size >= 256 ? 0 : size, 0); // width
    dir.writeUInt8(size >= 256 ? 0 : size, 1); // height
    dir.writeUInt8(0, 2); // palette
    dir.writeUInt8(0, 3); // reserved
    dir.writeUInt16LE(1, 4); // planes
    dir.writeUInt16LE(32, 6); // bpp
    dir.writeUInt32LE(png.length, 8);
    dir.writeUInt32LE(offset, 12);
    offset += png.length;
    dirs.push(dir);
    blobs.push(png);
  }
  return Buffer.concat([header, ...dirs, ...blobs]);
}

// ---------------------------------------------------------------------------------------------
// The OG card — the lockup on ink, 1200×630 (minimal composition per the §10-3 ruling)
// ---------------------------------------------------------------------------------------------

function ogHtml(): string {
  const fontUrl = pathToFileURL(ARCHIVO_WOFF2).href;
  const x =
    `<svg class="x" viewBox="${ARC_X_VIEWBOX}">` +
    ARC_X_PATHS.map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${gammaAmber}" stroke-width="${ARC_X_STROKE}" stroke-linecap="round"/>`,
    ).join('') +
    `</svg>`;
  return `<!doctype html><html><head><style>
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 100 900;
  font-stretch: 62% 125%;
  src: url('${fontUrl}') format('woff2-variations');
}
html, body { margin: 0; padding: 0; }
body {
  width: 1200px; height: 630px; background: ${ink};
  display: flex; align-items: center; justify-content: center;
}
.lockup {
  display: flex; align-items: baseline;
  font-family: 'Archivo', sans-serif; font-weight: 700; font-stretch: 125%;
  font-size: 148px; letter-spacing: 0.03em; line-height: 1; color: ${phosphor};
}
.x { width: 0.74em; height: 0.72em; margin: 0 0.045em; overflow: visible; }
</style></head><body>
  <div class="lockup"><span>CONVE</span>${x}<span>A</span></div>
</body></html>`;
}

// ---------------------------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------------------------

try {
  mkdirSync(PUBLIC, { recursive: true });

  // 1. favicon.svg — committed verbatim (hexes pinned to tokens by brand-assets.spec.ts).
  const faviconSvg = monogramSvg(true) + '\n';
  writeFileSync(join(PUBLIC, 'favicon.svg'), faviconSvg);
  console.log('wrote favicon.svg');

  // 2. favicon.ico — 16 + 32 PNG entries from the same monogram.
  const png16 = screenshot(iconHtml(monogramSvg(true), 16), 'icon-16', 16, 16, true);
  const png32 = screenshot(iconHtml(monogramSvg(true), 32), 'icon-32', 32, 32, true);
  writeFileSync(
    join(PUBLIC, 'favicon.ico'),
    buildIco([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
    ]),
  );
  console.log('wrote favicon.ico (16 + 32)');

  // 3. apple-touch-icon.png — 180×180, opaque ink field (iOS applies its own corner mask).
  const png180 = screenshot(iconHtml(monogramSvg(false), 180), 'icon-180', 180, 180, false);
  writeFileSync(join(PUBLIC, 'apple-touch-icon.png'), png180);
  console.log('wrote apple-touch-icon.png (180)');

  // 4. og-image.png — 1200×630, the new lockup on ink.
  const og = screenshot(ogHtml(), 'og-image', 1200, 630, false);
  writeFileSync(join(PUBLIC, 'og-image.png'), og);
  console.log('wrote og-image.png (1200×630)');
} finally {
  rmSync(WORK, { recursive: true, force: true });
}
