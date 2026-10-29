// One artboard's file, rendered from its screen: the body at the board's frame height, in the shell, with the
// canvas logic script. build.mjs writes these to design/canvas/; emit-project.mjs renders them again from the
// committed source into the publish folder (2026-10-28), so a published board is always what its source draws now,
// never a copy of a build that went stale, and the Changelog board reads the release tags present when it publishes.
import { shell } from './lib.mjs';
import { screens } from './screens/index.mjs';

const STATIC = 'class Component extends DCLogic {}';
const propsAttr = (props) => JSON.stringify(props).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
// type="text/x-dc": the canvas runtime reads the logic by `script[data-dc-script]` textContent; the type keeps the
// browser from also executing it as a classic script inside the artboard frame (DCLogic is not a global there).
const scriptTag = (props, code) => `<script type="text/x-dc" data-dc-script data-props='${propsAttr(props || {})}'>\n${code || STATIC}\n</script>`;

/** The .dc.html text for artboard `a` ({ name, screen, w, h, title, opts? }, from canvas.config.mjs). */
export function renderArtboard(a) {
  const scr = screens[a.screen];
  if (!scr) throw new Error(`artboard ${a.name}: unknown screen ${a.screen}`);
  const opts = { minHeight: a.h, ...(a.opts || {}) };
  const inner = scr.body(opts);
  const props = scr.interactive ? scr.interactive.props({ width: a.w, height: a.h, ...(a.opts || {}) }) : { $preview: { width: a.w, height: a.h } };
  const code = scr.interactive ? scr.interactive.script : STATIC;
  if (!scr.interactive && /\{\{/.test(inner)) throw new Error(`${a.name}: static screen contains template holes`);
  const html = shell(inner, { script: scriptTag(props, code), extraCss: scr.css || '', title: a.title });
  if (Buffer.from(html).includes(0)) throw new Error(`${a.name}: NUL byte`);
  return html;
}
