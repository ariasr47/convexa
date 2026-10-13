/**
 * Whether the UI offers a way to create an account. Owner decision 2026-10-12: sign-ups stay closed
 * (Convexa has one user), so the nav shows only "Log in" and the sign-in dialog has no
 * "Create an account" switch. The server refuses sign-up on its own (`allow_signup`, default
 * false), so this is presentation only. Reopening sign-ups: set the server flag AND this to true.
 */
export const SIGNUPS_OPEN = false;
