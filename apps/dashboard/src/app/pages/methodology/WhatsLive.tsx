/**
 * “What’s live on this site” (#data) and the state words, in the form for this build: production
 * lists the live public sources with how late each is, the public sources switched off (FINRA, with
 * the reason) and the options-based reads that are Not live (each linking to the same screen on the
 * demo); staging opens “Nothing: this is the demo.”, lists what each sample is shaped like in the
 * demo's own words (“Demo · shaped like …”, as on /credits) and links to the live site. Static: no
 * request, no chart.
 *
 * As the board draws it (fidelity SITE-02): the lead and the state words are article copy (15.5/1.65
 * steel, `DOC_BODY`); the groups between them sit in bordered panels (the board's `.ss-live`: panel
 * fill, hairline, radius 12, padding 16px 18px, 10px inside, 16px apart). Production's first panel
 * holds what is live and what is switched off; its second, what needs the options feed. Staging's
 * hold the demo's sources and the pointer to the live site. Every element returned here is a direct
 * child of the methodology section, so the article's 18px rhythm spaces them.
 *
 * Design: design/src/screens/final/shell-site-docs.mjs (liveSection), shell-site-kit.mjs (.ss-live).
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { LIVE_SITE_URL, STAGING_DEMO_URL } from '@/shared/lib/demoSite';
import { extrasFor } from '@/shared/theme/tokens';
import { standaloneLinkSx } from '@/shared/ui/touch';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { STAGING_WORDS, STATE_WORDS, WHATS_LIVE, type StateWordRow } from './copy';

/** Article body copy, the board's `.doc article p`: 15.5/1.65 steel, bold runs in `text.primary`.
 *  The same values as the trust pages' `Para` (`trust/DocPage.tsx`); pages never import a sibling
 *  page, so methodology keeps its own copy and `MethodologyPage.tsx` reads it from here. */
export const DOC_BODY = {
  m: 0,
  fontSize: 15.5,
  lineHeight: 1.65,
  color: 'text.secondary',
  textWrap: 'pretty',
  '& strong': { color: 'text.primary', fontWeight: 600 },
} as const;

/** A note inside a panel: the board's 13.5px steel `.dline`. */
const NOTE_SX = { m: 0, fontSize: 13.5, lineHeight: 1.65, color: 'text.secondary' } as const;

/** Alternating plain and bold runs, starting bold when `boldFirst`. */
function Lead({ parts, boldFirst = false }: { parts: readonly string[]; boldFirst?: boolean }) {
  return (
    <Typography component="p" sx={DOC_BODY}>
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
        fontSize: 15,
        fontWeight: 700,
        m: 0,
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
  return <Box sx={{ overflowX: 'auto' }}>{children}</Box>;
}

/** A panel's table, the board's `.ss-live table`: 13px, caps steel headers over the strong line,
 *  steel cells top-aligned on hairlines with no lead-in padding, the first column in bold primary. */
const PANEL_TABLE_SX = (t: Theme) =>
  ({
    '& th': {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      lineHeight: 1.45,
      color: 'text.secondary',
      p: '6px 8px 6px 0',
      borderBottom: `1px solid ${extrasFor(t).lineStrong}`,
    },
    '& td': {
      fontSize: 13,
      lineHeight: 1.45,
      color: 'text.secondary',
      verticalAlign: 'top',
      p: '8px 8px 8px 0',
      borderBottom: `1px solid ${t.palette.divider}`,
    },
    '& td:first-of-type': { color: 'text.primary', fontWeight: 600 },
  }) as const;

/** The board's `.ss-live`: the panels, one column, 16px apart. */
function Panels({ children }: { children: ReactNode }) {
  return (
    <Box
      data-testid="whats-live-panels"
      sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}
    >
      {children}
    </Box>
  );
}

/** One panel: panel fill, hairline, radius 12, padding 16px 18px, 10px between its parts. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: '12px',
        bgcolor: 'background.paper',
        p: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
}

function Words({ words }: { words: readonly StateWordRow[] }) {
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
      {words.map(([state, means, word]) => (
        <Box key={state} sx={{ display: 'contents' }}>
          <Box component="dt" sx={{ pt: { xs: 1, sm: 0 } }}>
            <DataStateTag state={state} word={word} />
          </Box>
          <Box component="dd" sx={{ m: 0, fontSize: 13.5, color: 'text.secondary' }}>
            {means}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function Production() {
  const c = WHATS_LIVE.production;
  return (
    <>
      <Lead parts={c.lead} />
      <Panels>
        <Panel>
          <SubHead>
            <DataStateTag state="updated" word={c.liveHead} />
          </SubHead>
          <Scroll>
            <Table size="small" data-testid="whats-live-live" sx={PANEL_TABLE_SX}>
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
            <DataStateTag state="off" word={c.switchedOffHead} />
          </SubHead>
          <Typography component="p" sx={NOTE_SX}>
            {c.switchedOffBody}
          </Typography>
          <Scroll>
            <Table size="small" data-testid="whats-live-switched-off" sx={PANEL_TABLE_SX}>
              <TableHead>
                <TableRow>
                  <TableCell scope="col">What</TableCell>
                  <TableCell scope="col">Source</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {c.switchedOff.map(([what, source]) => (
                  <TableRow key={what}>
                    <TableCell>{what}</TableCell>
                    <TableCell>{source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scroll>
        </Panel>
        <Panel>
          <SubHead>
            <DataStateTag state="notLive" word={c.offHead} />
          </SubHead>
          <Scroll>
            <Table size="small" data-testid="whats-live-off" sx={PANEL_TABLE_SX}>
              <TableHead>
                <TableRow>
                  <TableCell scope="col">{c.offColumn}</TableCell>
                  <TableCell scope="col">
                    <Box component="span" sx={visuallyHidden}>
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
                        // A standalone link in its own cell: 44px under a coarse pointer (it
                        // measured 89x17 at 390 before; spec 2026-10-21/02, part (b)). Its text
                        // stays on the label's first line; the taller box runs down the row.
                        sx={[
                          { ...standaloneLinkSx, whiteSpace: 'nowrap' },
                          { '@media (pointer: coarse)': { alignItems: 'flex-start' } },
                        ]}
                      >
                        {c.onDemo}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scroll>
        </Panel>
      </Panels>
      <Typography component="p" sx={DOC_BODY}>
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
      <Panels>
        <Panel>
          <SubHead>{c.demoHead}</SubHead>
          <Scroll>
            <Table size="small" data-testid="whats-live-demo" sx={PANEL_TABLE_SX}>
              <TableHead>
                <TableRow>
                  <TableCell scope="col">What</TableCell>
                  <TableCell scope="col">Shaped like</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {c.demo.map(([what, shaped]) => (
                  <TableRow key={what}>
                    <TableCell>{what}</TableCell>
                    <TableCell>
                      <DataStateTag state="demo" word="Demo" detail={shaped} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scroll>
        </Panel>
        <Panel>
          <SubHead>{c.liveHead}</SubHead>
          <Typography component="p" sx={NOTE_SX}>
            {c.liveBody}
          </Typography>
          <Typography component="p" sx={{ ...NOTE_SX, fontWeight: 600 }}>
            <Link href={`${LIVE_SITE_URL}/methodology#data`} sx={standaloneLinkSx}>
              {c.liveLink} →
            </Link>
          </Typography>
        </Panel>
      </Panels>
      <Words words={STAGING_WORDS} />
    </>
  );
}

export function WhatsLiveBody({ demo }: { demo: boolean }) {
  return demo ? <Staging /> : <Production />;
}
