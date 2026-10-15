/**
 * “What’s live on this site” (#data) and the state words, in the form for this build: production
 * lists the live public sources with how late each is and the options-based reads that are Not
 * live (each linking to the same screen on the demo); staging opens “Nothing: this is the demo.”,
 * lists what each sample is shaped like and links to the live site. Static: no request, no chart.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs (liveSection).
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { LIVE_SITE_URL, STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { STAGING_WORDS, STATE_WORDS, WHATS_LIVE } from './copy';

const P_SX = { m: 0, mb: 1.5, lineHeight: 1.65 } as const;

/** Alternating plain and bold runs, starting bold when `boldFirst`. */
function Lead({ parts, boldFirst = false }: { parts: readonly string[]; boldFirst?: boolean }) {
  return (
    <Typography component="p" variant="body2" sx={P_SX}>
      {parts.map((part, i) =>
        (i % 2 === 0) === boldFirst ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>,
      )}
    </Typography>
  );
}

function SubHead({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="h3"
      sx={{
        fontSize: 14,
        fontWeight: 700,
        m: 0,
        mb: 0.75,
        display: 'flex',
        gap: 1,
        alignItems: 'center',
      }}
    >
      {children}
    </Typography>
  );
}

function Scroll({ children }: { children: ReactNode }) {
  return <Box sx={{ overflowX: 'auto', mb: 2.5 }}>{children}</Box>;
}

function Words({ words }: { words: readonly (readonly [DataStateKey, string])[] }) {
  return (
    <Box
      component="dl"
      data-testid="state-words"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'max-content minmax(0, 1fr)' },
        columnGap: 2,
        rowGap: { xs: 0.5, sm: 1 },
        alignItems: 'center',
      }}
    >
      {words.map(([state, means]) => (
        <Box key={state} sx={{ display: 'contents' }}>
          <Box component="dt" sx={{ pt: { xs: 1, sm: 0 } }}>
            <DataStateTag state={state} />
          </Box>
          <Box component="dd" sx={{ m: 0, fontSize: 13.5, color: 'text.secondary' }}>
            {means}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

const linkSx = { color: (t: Parameters<typeof extrasFor>[0]) => extrasFor(t).textInfo } as const;

function Production() {
  const c = WHATS_LIVE.production;
  return (
    <>
      <Lead parts={c.lead} />
      <SubHead>{c.liveHead}</SubHead>
      <Scroll>
        <Table size="small" data-testid="whats-live-live">
          <TableHead>
            <TableRow>
              <TableCell scope="col">What</TableCell>
              <TableCell scope="col">Source</TableCell>
              <TableCell scope="col">How late</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {c.live.map(([what, source, late]) => (
              <TableRow key={what}>
                <TableCell>{what}</TableCell>
                <TableCell>{source}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{late}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Scroll>
      <SubHead>
        {c.offHead} <DataStateTag state="notLive" />
      </SubHead>
      <Scroll>
        <Table size="small" data-testid="whats-live-off">
          <TableHead>
            <TableRow>
              <TableCell scope="col">{c.offColumn}</TableCell>
              <TableCell scope="col">
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Same screen on the demo
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {c.off.map(([what, path]) => (
              <TableRow key={what}>
                <TableCell>{what}</TableCell>
                <TableCell align="right">
                  <Link
                    href={`${STAGING_DEMO_URL}${path}`}
                    aria-label={`${what}: on the demo`}
                    sx={{ ...linkSx, whiteSpace: 'nowrap' }}
                  >
                    {c.onDemo}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Scroll>
      <Typography component="p" variant="body2" sx={P_SX}>
        {c.wordsLead}
      </Typography>
      <Words words={STATE_WORDS} />
    </>
  );
}

function Staging() {
  const c = WHATS_LIVE.staging;
  return (
    <>
      <Lead parts={c.lead} boldFirst />
      <SubHead>{c.demoHead}</SubHead>
      <Scroll>
        <Table size="small" data-testid="whats-live-demo">
          <TableHead>
            <TableRow>
              <TableCell scope="col">What</TableCell>
              <TableCell scope="col">Sample</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {c.demo.map(([what, shaped]) => (
              <TableRow key={what}>
                <TableCell>{what}</TableCell>
                <TableCell>
                  <DataStateTag state="sample" detail={shaped} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Scroll>
      <SubHead>{c.liveHead}</SubHead>
      <Typography component="p" variant="body2" sx={{ ...P_SX, color: 'text.secondary' }}>
        {c.liveBody}
      </Typography>
      <Typography component="p" variant="body2" sx={P_SX}>
        <Link href={`${LIVE_SITE_URL}/methodology#data`} sx={linkSx}>
          {c.liveLink} →
        </Link>
      </Typography>
      <Words words={STAGING_WORDS} />
    </>
  );
}

export function WhatsLiveBody({ demo }: { demo: boolean }) {
  return demo ? <Staging /> : <Production />;
}
