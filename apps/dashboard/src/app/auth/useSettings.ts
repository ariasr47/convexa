/**
 * useSettings — resolves the EFFECTIVE 3 prefs (active persona / default ticker / theme) honoring the
 * precedence rule (D7, UX_BLUEPRINT §2.9):
 *   - signed in ⇒ the SERVER `settings` WIN and are source of truth (null server value ⇒ app default).
 *   - anonymous ⇒ the existing CLIENT-LOCAL stores (personas store for persona, localPrefs for
 *     theme/ticker) — behaving EXACTLY as today (AC-A3/F3); no server pref applied.
 *
 * Writes:
 *   - signed in ⇒ PUT /api/auth/settings (server-wins; the AuthContext updates the carried settings).
 *     On failure the caller reverts (UX_BLUEPRINT §2.9 save-error). NEVER mirrored back into locals
 *     (that would break per-account isolation, AC-F2).
 *   - anonymous ⇒ the client-local stores, unchanged.
 *
 * SCORE-NEUTRAL (AC-F4): nothing here is ever wired into getTicker/streamTicker or the score path. A
 * pref change only changes which default a UI lands on.
 */
import { useCallback, useMemo, useState } from 'react';
import type { ThemePref, UserSettings } from '@org/api';
import { useAuth } from './AuthContext';
import { SETTINGS_DEFAULTS } from './copy';
import {
  loadLocalTheme, saveLocalTheme, loadLocalDefaultTicker, saveLocalDefaultTicker,
} from './localPrefs';
import { loadActiveId, saveActiveId } from '../personas/store';

export interface EffectiveSettings {
  /** 'default' | preset/custom persona id. */
  personaId: string;
  /** The default ticker for bare `/ticker` (uppercased). */
  defaultTicker: string;
  theme: ThemePref;
}

export interface SettingsApi {
  /** The resolved, ready-to-apply prefs (server-wins when signed in, else client-local). */
  effective: EffectiveSettings;
  /** True while the source is the server (signed in). Drives the Settings UI "server-wins" mode. */
  serverBacked: boolean;
  /** Save error message (null when clean). The UI shows it + reverts the control. */
  saveError: string | null;
  /** Set the active persona (server when signed in, client-local when anonymous). */
  setPersona: (id: string) => Promise<void>;
  setDefaultTicker: (t: string | null) => Promise<void>;
  setTheme: (t: ThemePref) => Promise<void>;
  clearSaveError: () => void;
}

export function useSettings(): SettingsApi {
  const auth = useAuth();
  // A local tick to force re-derivation after a client-local write (anonymous path has no React state).
  const [localTick, setLocalTick] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const serverBacked = auth.authenticated && auth.settings != null;

  const effective = useMemo<EffectiveSettings>(() => {
    if (serverBacked && auth.settings) {
      const s = auth.settings;
      return {
        personaId: s.active_persona_id ?? SETTINGS_DEFAULTS.personaId,
        defaultTicker: (s.default_ticker ?? SETTINGS_DEFAULTS.ticker).toUpperCase(),
        theme: s.theme,
      };
    }
    // Anonymous (or signed-in-without-settings degrade) ⇒ client-local, exactly as today.
    // `localTick` is read so the memo re-derives after a client-local write.
    void localTick;
    return {
      personaId: loadActiveId() ?? SETTINGS_DEFAULTS.personaId,
      defaultTicker: (loadLocalDefaultTicker() ?? SETTINGS_DEFAULTS.ticker).toUpperCase(),
      theme: loadLocalTheme(),
    };
  }, [serverBacked, auth.settings, localTick]);

  const writeServer = useCallback(async (patch: Partial<UserSettings>) => {
    try {
      await auth.updateSettings(patch);
      setSaveError(null);
    } catch {
      // Save-error (UX_BLUEPRINT §2.9): surface a non-blocking error; the control reverts to the last
      // confirmed (server) value because we never optimistically mutated it.
      setSaveError('save_failed');
    }
  }, [auth]);

  const setPersona = useCallback(async (id: string) => {
    if (serverBacked) await writeServer({ active_persona_id: id === 'default' ? null : id });
    else { saveActiveId(id === 'default' ? null : id); setLocalTick((n) => n + 1); }
  }, [serverBacked, writeServer]);

  const setDefaultTicker = useCallback(async (t: string | null) => {
    const norm = t && t.trim() ? t.trim().toUpperCase() : null;
    if (serverBacked) await writeServer({ default_ticker: norm });
    else { saveLocalDefaultTicker(norm); setLocalTick((n) => n + 1); }
  }, [serverBacked, writeServer]);

  const setTheme = useCallback(async (t: ThemePref) => {
    if (serverBacked) await writeServer({ theme: t });
    else { saveLocalTheme(t); setLocalTick((n) => n + 1); }
  }, [serverBacked, writeServer]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return { effective, serverBacked, saveError, setPersona, setDefaultTicker, setTheme, clearSaveError };
}
