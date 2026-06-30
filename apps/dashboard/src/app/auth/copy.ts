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
    // NOTE: `settings`/`logOut` (the old nav dropdown labels) were removed in the convexa-redesign —
    // the dropdown is gone; log out now lives on the Settings Account panel (`settings.signOut`).
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
    subtitle: 'Saved to your account.',
    // Panel headings (convexa-redesign Figma `4:2572`).
    accountHeading: 'Account',
    preferencesHeading: 'Preferences',
    signOut: 'Sign out',
    signIn: 'Sign in',
    accountSignedOutPrompt: 'Sign in to sync your settings across devices.',
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
    // byo-ai-key (UX_BLUEPRINT §5; verbatim). Write-only key entry; the masked last-4 hint is all
    // that's ever read back. NO reveal/show/copy control anywhere (PRODUCT_CONTRACT §6).
    aiKey: {
      heading: 'AI key',
      helper:
        'Your own Anthropic key lets AI recommendations run on your key, at your cost. It\'s stored ' +
        'encrypted and used only for your own recommendations — it\'s never shown again and never ' +
        'leaves the server.',
      inputLabel: 'Anthropic API key',
      inputPlaceholder: 'sk-ant-…',
      inputHelper: "Starts with sk-ant-. Stored encrypted; you won't be able to view it again.",
      addBtn: 'Add key',
      addingBtn: 'Adding…',
      setSubLine: 'Stored encrypted. Used only for your recommendations. Never shown again.',
      replaceBtn: 'Replace',
      replaceSubmitBtn: 'Replace key',
      replacingBtn: 'Replacing…',
      removeBtn: 'Remove',
      removeConfirmTitle: 'Remove your stored Anthropic key?',
      removeConfirmBody:
        'AI recommendations will stop running on your key. You can add a key again any time.',
      removeConfirmBtn: 'Remove key',
      removeCancelBtn: 'Keep key',
      cancelBtn: 'Cancel',
      savedAdd: 'AI key saved.',
      savedRemove: 'AI key removed.',
      saveError: "Couldn't save your key. Please try again.",
      validationEmpty: 'Enter your Anthropic key.',
      validationFormat:
        "That doesn't look like an Anthropic key (it should start with sk-ant-).",
      storageUnavailable:
        "Key storage isn't set up on this deployment yet, so a key can't be saved right now. The " +
        'manual export hand-off still works without a key.',
      anonymous: 'Sign in to add your own Anthropic key for AI recommendations.',
    },
  },
  gate: {
    // The "couldn't reach sign-in" copy on a gated action when the auth subsystem is degraded (503).
    unavailable: "Couldn't reach sign-in right now. Please try again in a moment.",
  },
} as const;

/** `Key set ···· {last4}` masked display for a stored AI key (UX_BLUEPRINT §5). The last-4 hint is
 *  the ONLY credential datum the FE ever receives — the full key is never shown again (AC-7/10). */
export const maskedKeyLabel = (last4: string | null) => `Key set ···· ${last4 ?? '????'}`;

/** App defaults applied when a server pref value is null (UX_BLUEPRINT §2.9). */
export const SETTINGS_DEFAULTS = {
  personaId: 'default',
  ticker: 'TSLA',
  theme: 'dark' as const,
};
