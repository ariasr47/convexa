/**
 * Auth microcopy — the SINGLE source of user-facing auth strings, verbatim from UX_BLUEPRINT §2.
 * The binding framing (non-enumerating login failure, honest positions disclosure, auth-outermost
 * gate prompts, Google-disabled affordance) is carried entirely by these strings. Do not improvise.
 *
 * CRITICAL (AC-C3/H3): `LOGIN.badCredentials` is used VERBATIM for BOTH wrong-email and
 * wrong-password — it must never reveal whether the email exists.
 */

export const AUTH_COPY = {
  account: {
    signIn: 'Sign in',
    settings: 'Settings',
    logOut: 'Log out',
  },
  signup: {
    title: 'Create your account',
    email: 'Email',
    password: 'Password',
    displayName: 'Display name (optional)',
    submit: 'Create account',
    submitting: 'Creating account…',
    switch: 'Already have an account? Sign in',
    emailTaken: 'That email is already registered. Try signing in instead.',
    invalidEmail: 'Enter a valid email address.',
    // {N} is the backend password floor, surfaced in the 422 message; the copy reads the number.
    passwordFloor: (n: number) => `Password must be at least ${n} characters.`,
    passwordFloorGeneric: 'Password is too short.',
    unavailable: "Couldn't reach sign-in right now. Please try again in a moment.",
  },
  login: {
    title: 'Sign in',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    switch: 'New here? Create an account',
    // THE EXACT non-enumerating message — identical for unknown-email AND wrong-password.
    badCredentials:
      "Those credentials didn't match. Check your email and password and try again.",
    invalidEmail: 'Enter a valid email address.',
    emptyPassword: 'Enter your password.',
    unavailable: "Couldn't reach sign-in right now. Please try again in a moment.",
  },
  google: {
    label: 'Continue with Google',
    helperDisabled: "Google sign-in isn't available yet — use your email and password.",
    tooltipDisabled:
      'Google sign-in is wired up but turned off until Google credentials are configured for this server. Email + password works now.',
  },
  positions: {
    // Honest browser-local disclosure (D6d, mandatory). Must NOT imply sync/privacy/account-scoping.
    disclosure:
      'Simulated positions are stored in this browser, not tied to your account yet. They aren’t synced across devices and aren’t cleared when you log out — anyone using this browser will see them.',
    disclosureCompact: 'Stored in this browser — not tied to your account.',
    gateTrack: 'Sign in to track simulated positions.',
    gateSaveView: 'Sign in to save a view.',
    gateAcceptRec: 'Sign in to add this to your tracker.',
  },
  askAi: {
    // Auth-gate OUTERMOST (D6f) — never ai-rec's cooldown/cap/no_key for a logged-out user.
    gate: 'Sign in to ask AI.',
    tooltip:
      "The AI recommendation call requires an account. Signing in unlocks it; the AI's own rate limits still apply afterward.",
  },
  settings: {
    title: 'Settings',
    activePersona: 'Active persona',
    defaultTicker: 'Default ticker',
    defaultTickerHelper: 'The symbol the Ticker viewer opens to by default.',
    theme: 'Theme',
    themeHelper: 'Affects appearance only.',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeSystem: 'System',
    saved: 'Saved',
    saveError: "Couldn't save that setting. Please try again.",
  },
  gate: {
    // The "couldn't reach sign-in" copy on a gated action when the auth subsystem is degraded (503).
    unavailable: "Couldn't reach sign-in right now. Please try again in a moment.",
  },
} as const;

/** App defaults applied when a server pref value is null (UX_BLUEPRINT §2.9). */
export const SETTINGS_DEFAULTS = {
  personaId: 'default',
  ticker: 'TSLA',
  theme: 'dark' as const,
};
