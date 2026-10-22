/**
 * Read by screen readers, not drawn: the standard clip-rect visually-hidden technique.
 *
 * Written with plain CSS property names so the one object serves both an MUI `sx` and a React
 * `style` prop. The sizes are '1px' STRINGS on purpose: in MUI `sx` a bare width/height <= 1 is a
 * percentage (1 -> '100%') and a bare margin is spacing units (-1 -> -8px), which once made a
 * hidden label a full-width box that overhung a 393px viewport.
 */
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
