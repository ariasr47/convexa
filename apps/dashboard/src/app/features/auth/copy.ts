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
    // Owner lockdown (2026-08-06). Must NOT reuse the `unavailable` copy — "temporarily
    // unavailable" would claim a fault where there is a deliberate policy, and the user would
    // retry forever. States the reason and that there is nothing to wait for.
    signupsClosed: 'New sign-ups are closed while Convexa is in private testing.',
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
    badCredentials: "Those credentials didn't match. Check your email and password and try again.",
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
    // Signed-out AI-rec body (Figma 149:598 signed-out variant): description + CTA button.
    signedOut: 'Sign in to ask the AI for a read.',
    cta: 'Sign in to ask AI',
    tooltip:
      "The AI recommendation call requires an account. Signing in unlocks it; the AI's own rate limits still apply afterward.",
  },
  settings: {
    title: 'Settings',
    // Mode-aware subtitle (redesign-stage-0 §4.1): the old single string falsely claimed "Saved to
    // your account." for ANONYMOUS users (whose prefs are client-local). SettingsPage picks by
    // `auth.authenticated`. The Account panel below carries the sign-in CTA — the subtitle must not
    // duplicate it.
    subtitleSignedIn: 'Saved to your account.',
    subtitleAnonymous: 'Stored in this browser.',
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
    // curvature-v2-surfaces U-19: one line, above the fields it freezes, removed the instant the
    // session resolves. Never claims signed-out or signed-in — the session state is not yet known.
    sessionResolving: 'Checking your session — these controls unlock in a moment.',
    // ai-providers (SPEC §4). Write-only keys; closed labels; no free / pool / cheaper / included.
    aiKey: {
      heading: 'AI providers',
      helper:
        'Connect Grok (while signed into Convexa) to run Ask-AI on your Grok subscription when ' +
        'available. Otherwise store your own API key for Anthropic, OpenAI, Gemini, or Grok — ' +
        "it's stored encrypted, never shown again, and used only for your recommendations.",
      preferredHeading: 'Your Grok subscription',
      alternativeHeading: 'Your API key',
      modelHeading: 'Model for recommendations',
      modelUnpoweredCaption: 'A power path is still needed before Ask-AI can run.',
      modelRecommendedCaption: 'Catalog recommended default',
      modelEmpty: 'No models listed for this path.',
      modelNotInCatalog: "The selected model isn't in the current catalog. Choose another model.",
      grokUnavailable:
        "Your Grok subscription isn't available to connect on this deployment yet. You can still " +
        'add your own API key below.',
      grokConnectBtn: 'Connect Grok',
      grokConnectingBtn: 'Connecting…',
      grokDisconnectBtn: 'Disconnect',
      grokUseBtn: 'Use this subscription',
      grokActive: 'Active',
      grokConnected: 'Connected to your Grok subscription.',
      grokDisconnected: 'Grok disconnected.',
      grokExpired:
        'Your Grok connection expired. Reconnect to use your subscription, or use your own key.',
      grokUnlinked: 'Connect Grok to use your Grok subscription, or use your own API key.',
      grokSubscriptionUnavailable:
        "Your Grok subscription isn't available for Ask-AI right now. You can still add your own " +
        'API key below.',
      inputLabel: 'API key',
      inputHelper: "Stored encrypted; you won't be able to view it again.",
      addBtn: 'Add key',
      addingBtn: 'Adding…',
      setSubLine: 'Stored encrypted. Used only for your recommendations. Never shown again.',
      replaceBtn: 'Replace',
      replaceSubmitBtn: 'Replace key',
      replacingBtn: 'Replacing…',
      removeBtn: 'Remove',
      useThisKeyBtn: 'Use this key',
      usingProvider: (label: string) => `Using your ${label} key.`,
      removeConfirmTitle: 'Remove this stored key?',
      removeConfirmBody:
        'Ask-AI will stop using this key. You can add a key again any time. Other providers stay as they are.',
      removeConfirmBtn: 'Remove key',
      removeCancelBtn: 'Keep key',
      cancelBtn: 'Cancel',
      savedAdd: 'AI key saved.',
      savedRemove: 'AI key removed.',
      saveError: "Couldn't save your key. Please try again.",
      validationEmpty: 'Enter your API key.',
      storageUnavailable:
        "Key storage isn't set up on this deployment yet, so a key can't be saved right now. The " +
        'manual export hand-off still works without a key.',
      anonymous: 'Sign in to manage AI providers for recommendations.',
    },
    // broker-connect (SPEC §4, verbatim). The byo-ai-key write-only/masked shape reused
    // deliberately: keys are SENT on save; only the App Key's last-4 hint is ever read back.
    // No reveal/show/copy control exists anywhere.
    brokerage: {
      heading: 'Brokerage',
      helper:
        'Connect Webull with your own Individual OpenAPI keys. Convexa reads positions only — ' +
        'it never places, changes, or cancels an order.',
      appKeyLabel: 'App Key',
      appSecretLabel: 'App Secret',
      inputHelper: 'Both halves are saved together, encrypted. Neither is ever shown again.',
      connectBtn: 'Connect Webull',
      connectingBtn: 'Connecting…',
      /** Saved-state masked hint — the ONLY credential datum this browser ever holds. */
      savedLabel: (last4: string | null) => `Webull · key ····${last4 ?? '????'}`,
      savedSubLine:
        'Saved encrypted. The full keys are never shown again and never sent to this browser — ' +
        'only the last 4 of the App Key remain as the hint.',
      replaceBtn: 'Replace keys',
      replaceSubmitBtn: 'Replace keys',
      replacingBtn: 'Replacing…',
      cancelBtn: 'Cancel',
      disconnectBtn: 'Disconnect',
      disconnectConfirmTitle: 'Disconnect Webull?',
      disconnectConfirmBody:
        'Convexa deletes your keys and stops reading your positions. Nothing changes at Webull — ' +
        'this only removes what Convexa stored.',
      disconnectConfirmBtn: 'Disconnect',
      disconnectCancelBtn: 'Keep connection',
      savedToast: 'Webull keys saved.',
      removedToast: 'Webull disconnected.',
      /** NEVER echoes any fragment of either input (AC-5). */
      saveError: "Couldn't save your keys. Please try again.",
      validationBoth: 'Enter both the App Key and the App Secret — they are saved together.',
      storageUnavailable:
        "Key storage isn't set up on this deployment yet, so Webull keys can't be saved right " +
        'now. Nothing was stored.',
      anonymous: 'Sign in to connect your Webull account.',
    },
  },
  gate: {
    // The "couldn't reach sign-in" copy on a gated action when the auth subsystem is degraded (503).
    unavailable: "Couldn't reach sign-in right now. Please try again in a moment.",
    // curvature-v2-landing-and-site SPEC §5 — the degraded wall. Degrading the ROUTE DECISION to
    // anonymous is correct; degrading the SENTENCE is not. With subsystemDegraded === true the
    // shipped wall today tells a trader who may well be signed in `Sign in to open the scanner` —
    // an assertion about identity built on a read that FAILED.
    sessionUnknown: "We couldn't check your session.",
    retry: 'Try again',
  },
} as const;

// ---- tradeable-rec-inputs — Settings `Risk inputs` panel (SPEC §4; verbatim) -------------------
// Copy is design material, not filler. The egress sentence is FIRST, above BOTH fields, never a
// tooltip — that ordering is itself an acceptance criterion (AC-16, U-1/U-1b).
export const RISK_INPUTS_COPY = {
  heading: 'Risk inputs',
  // Section helper — visible above BOTH inputs, egress sentence first.
  helper:
    'These figures are sent to your AI provider with each recommendation request. Convexa never ' +
    'checks them against a broker, never enforces them, and never uses them to score anything.',
  viewWhatsSent: "View what's sent",
  openPositionsIncluded: 'Open positions included: your simulated positions in this browser.',
  accountSizeLabel: 'Account size',
  accountSizeHelper:
    'The account value you want sizing based on. You type it; Convexa never checks it against a ' +
    'broker.',
  maxRiskLabel: 'Max risk per trade',
  maxRiskHelper:
    "The most you're willing to lose on one trade. The AI is told this figure and asked to size " +
    'within it. Nothing in Convexa enforces it.',
  unitUsd: '$',
  unitPercent: '%',
  saved: 'Saved to your account.',
  notSetConsequence:
    'Not set — AI recommendations will show "not set" where a risk figure would go.',
  saveError: "Couldn't save that setting. Please try again.",
  errorGreaterThanZero: 'Enter a number greater than zero.',
  errorPercentRange: 'Enter a percentage between 0 and 100.',
  errorCapExceedsAccount: "Your per-trade cap can't exceed your account size.",
  storageUnavailable:
    "Risk inputs can't be saved on this deployment right now. Nothing was stored.",
  anonymous:
    "Sign in to save your risk inputs — they're stored with your account, never in this browser.",
  /** The field-scoped not-derivable-reason literal (never `$0`, never blank, never a cap verdict). */
  accountSizeNotSetReason: 'Account size: not set',
} as const;

/** `Key set ···· {last4}` masked display for a stored AI key (UX_BLUEPRINT §5). The last-4 hint is
 *  the ONLY credential datum the FE ever receives — the full key is never shown again (AC-7/10). */
export const maskedKeyLabel = (last4: string | null) => `Key set ···· ${last4 ?? '????'}`;

/** App defaults applied when a server pref value is null (UX_BLUEPRINT §2.9).
 *  `ticker`: TSLA → SPY (index-first-defaults AC-1) — the UNSET fallback only; a stored
 *  `default_ticker` preference (server or client-local) always wins and is never migrated (AC-2). */
export const SETTINGS_DEFAULTS = {
  personaId: 'default',
  ticker: 'SPY',
  theme: 'dark' as const,
};
