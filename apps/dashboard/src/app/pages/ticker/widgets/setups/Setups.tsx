/**
 * Setups — the rule-based setup cards with conviction tags (Figma `Ticker · Setups`, node 149:687),
 * or the calm "no clean setup" info. Each card: setup name + a tinted conviction chip (HIGH amber /
 * MEDIUM blue / LOW grey) over the plain-language rationale. Static bundle read off `signals.setups`.
 *
 * Ticker fidelity repair, change 2 (F2) — the widget already spans 2 of the context band's 3
 * columns (`span={2}` below); `design/src/screens/desk.mjs:43`'s `contextCard('Setups', ..., 2)`
 * lays its own cards out as a 2-column `ctx-2` grid inside that span, not a vertical stack (the
 * pre-repair app rendered "three full-width rows" — `FIDELITY_AUDIT.md` F2).
 */
import { TintChip } from '@/shared/ui/TintChip';
import { Widget } from '@/shared/ui/Widget';
import type { Setup } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { setupsSubtitle } from '../_kit/copy';

interface Props {
  setups: Setup[] | undefined;
  /** REST-bundle age (seconds) — product spine #4. */
  structureAgeSeconds?: number | null;
}

// Stage-3 §5.3: HIGH binds the new brand-amber `emphasis` tone — a high-conviction setup is the
// "one line that matters" spend, NOT a warning (the old mechanical burnt-orange inheritance).
const convictionTone = (c: string): 'emphasis' | 'info' | 'neutral' => {
  const v = c.toLowerCase();
  return v === 'high' ? 'emphasis' : v === 'medium' ? 'info' : 'neutral';
};

export function Setups({ setups, structureAgeSeconds = null }: Props) {
  // Two states collapsed to one sentence (SPEC §4.6 criterion 56a): `undefined` — never delivered,
  // a ticker nobody scored, no market fact to state — reads "Setups unavailable this cycle."; `[]`
  // — checked and genuinely empty — keeps the shipped sentence byte-for-byte. Nothing else in this
  // widget's copy changes.
  return (
    <Widget id="setups" title="Setups" subtitle={setupsSubtitle(structureAgeSeconds)} span={2}>
      {setups === undefined ? (
        <Alert severity="info">Setups unavailable this cycle.</Alert>
      ) : setups.length ? (
        <Box
          data-testid="setups-grid"
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}
        >
          {/* Ticker fidelity repair, change 2 (F2) close-out: a plain `Box`, not a bordered `Card`/
              `CardContent` — matching the design's own compact setup card
              (`design/src/screens/desk.mjs`'s `ctx-2` setups block: `padding: 12px 14px`,
              `background: var(--ink-2)`, one hairline border, no elevation) rather than MUI Card's
              default ≈16px padding + shadow. The design still measures 248px for two real
              multi-sentence rationale cards at 390px width where this ran 534px (harness,
              desk-real-390-dark) — every field/testid this widget renders is unchanged. */}
          {setups.map((s, i) => (
            <Box
              key={i}
              sx={(t) => ({
                borderRadius: '10px',
                border: `1px solid ${t.palette.divider}`,
                bgcolor: 'background.paper',
                p: 1.5,
                minWidth: 0,
              })}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.name}</Typography>
                <TintChip tone={convictionTone(s.conviction)} label={s.conviction.toUpperCase()} />
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {s.rationale}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Alert severity="info">No clean setup right now.</Alert>
      )}
    </Widget>
  );
}

export default Setups;
