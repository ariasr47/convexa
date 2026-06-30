/**
 * Gradient-avatar helpers — single-sourced so the nav profile (AccountControl) and the Settings
 * Account panel render the IDENTICAL 32px circle (convexa-redesign Figma `4:2572`, README §1/§6).
 *
 * The gradient `#4f9cff → #7b5cff` is the one hardcoded literal the Settings/Auth contract permits
 * (the accent/violet token isn't an MUI palette entry); everything else uses theme tokens.
 */
import type { SxProps, Theme } from '@mui/material/styles';
import type { AuthUser } from '@org/api';

/** The user's initial (display name first, else email), uppercased; a neutral dot when unknown. */
export function avatarInitial(user: AuthUser | null | undefined): string {
  const source = user?.display_name?.trim() || user?.email?.trim() || '';
  return source ? source[0].toUpperCase() : '•';
}

/** The shared 32px gradient-circle styling (white 600 initial centered). */
export const GRADIENT_AVATAR_SX: SxProps<Theme> = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.85rem',
  lineHeight: 1,
  background: 'linear-gradient(135deg, #4f9cff, #7b5cff)',
};
