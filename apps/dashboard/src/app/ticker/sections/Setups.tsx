/**
 * Setups — the rule-based setup cards with conviction tags (Figma `Ticker · Setups`, node 149:687),
 * or the calm "no clean setup" info. Each card: setup name + a tinted conviction chip (HIGH amber /
 * MEDIUM blue / LOW grey) over the plain-language rationale. Static bundle read off `signals.setups`.
 */
import { Card, CardContent, Stack, Typography, Alert } from '@mui/material';
import type { Setup } from '@org/api';
import { TintChip } from './TintChip';
import { Widget } from './Widget';

interface Props {
  setups: Setup[] | undefined;
}

const convictionTone = (c: string): 'warning' | 'info' | 'neutral' => {
  const v = c.toLowerCase();
  return v === 'high' ? 'warning' : v === 'medium' ? 'info' : 'neutral';
};

export function Setups({ setups }: Props) {
  return (
    <Widget id="setups" title="Setups" span={2}>
      {setups?.length ? (
        <Stack spacing={1.5}>
          {setups.map((s, i) => (
            <Card key={i} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.name}</Typography>
                  <TintChip tone={convictionTone(s.conviction)} label={s.conviction.toUpperCase()} />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{s.rationale}</Typography>
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
