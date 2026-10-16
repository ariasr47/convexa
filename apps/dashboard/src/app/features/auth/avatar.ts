/**
 * Avatar helpers — single-sourced so the nav profile (AccountControl) and the Settings Account
 * panel render the IDENTICAL 32px circle (convexa-redesign Figma `4:2572`, README §1/§6).
 *
 * redesign-stage-3 §5.1: the gradient treatment is RETIRED with the `brandGradient` token (the
 * skill's "the gradient mark is dead" + the measured-broken white-on-amber label ~2:1).
 *
 * Owner ruling A (2026-10-15): amber is spent on each screen's one contained primary, so the disc
 * is NEUTRAL — the Final shell board's `.ss-av`: the `raised2` fill (`extrasFor(t).panelRaised2`)
 * with a `text.primary` initial, mode-aware through `extrasFor`.
 */
import { extrasFor } from '@/shared/theme/tokens';
import type { AuthUser } from '@convexa/api';
import type { SxProps, Theme } from '@mui/material/styles';

/** The user's initial (display name first, else email), uppercased; a neutral dot when unknown. */
export function avatarInitial(user: AuthUser | null | undefined): string {
  const source = user?.display_name?.trim() || user?.email?.trim() || '';
  return source ? source[0].toUpperCase() : '•';
}

/** The shared 32px neutral disc (contrast-safe initial centered, token slots only). */
export const AVATAR_SX: SxProps<Theme> = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: '0.85rem',
  lineHeight: 1,
  bgcolor: (t) => extrasFor(t).panelRaised2,
  color: 'text.primary',
};
