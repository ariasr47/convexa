/**
 * Setups — the rule-based setup cards with conviction tags (Figma `Ticker · Setups`, node 149:687),
 * or the calm "no clean setup" info. Each card: setup name + a tinted conviction chip (HIGH amber /
 * MEDIUM blue / LOW grey) over the plain-language rationale. Static bundle read off `signals.setups`.
 */
import { TintChip } from '@/shared/ui/TintChip';
import { Widget } from '@/shared/ui/Widget';
import type { Setup } from '@convexa/api';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
        <Stack spacing={1.5}>
          {setups.map((s, i) => (
            <Card key={i} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.name}</Typography>
                  <TintChip
                    tone={convictionTone(s.conviction)}
                    label={s.conviction.toUpperCase()}
                  />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {s.rationale}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Alert severity="info">No clean setup right now.</Alert>
      )}
    </Widget>
  );
}

export default Setups;
