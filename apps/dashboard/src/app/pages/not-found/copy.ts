/**
 * 404 copy — SPEC §4 "404", pinned bytes (AC-C1). The arrow on the primary action is deliberate:
 * it matches the shipped forward-action convention (`RequireAuth.tsx:106` — `Open free Ticker →`),
 * over the design list's arrowless form.
 */
export const NOT_FOUND_COPY = {
  code: '404',
  headline: 'Nothing at this address.',
  body: 'The address may be old or mistyped. The desk is one symbol away.',
  primary: 'Open the Ticker →',
  secondary: 'Home',
  /** After the shortcut, which is drawn as keys. Hidden on touch, where there is no keyboard. */
  hintBefore: 'or press',
  hintAfter: 'to jump to a ticker or note',
} as const;
