/**
 * The AI read on a live build without the options feed (Final · AI read, "Production · Not live"):
 * what a read would show, why it is off, how reads run on a build with the feed, and the export's
 * production form, "What a read sends", which says nothing is sent. It calls nothing: the read and
 * its export read the options structure, so `/api/recommendation/*` is never requested here.
 *
 * The export opens in a drawer (420, a full-width sheet on a phone) so its "Nothing sent" tag stays
 * out of the desk's "On this page" count: the panel itself is one of the twelve Not live panels.
 *
 * Design: design/src/screens/final/deep-read.mjs (productionBody).
 */
import { MONO, PANEL_SX } from '@/pages/research/ui';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { extrasFor } from '@/shared/theme/tokens';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

const linkSx = { color: (theme: Parameters<typeof extrasFor>[0]) => extrasFor(theme).textInfo };

export type AiFeedOff = 'not_live' | 'paused';

const OFF: Record<AiFeedOff, string> = {
  not_live: 'which needs the paid options feed this site doesn’t run.',
  paused: 'which needs the options feed, and it is paused on this site.',
};

const SENT: [string, string][] = [
  ['The computed snapshot', 'levels, regime, score, implied move'],
  ['Candidate contracts', 'the set in the read’s DTE band'],
  ['Your risk inputs', 'account size and per-trade cap, if set'],
  ['Open simulated positions', 'this ticker only, from this browser'],
  ['The persona’s prompt and a field glossary', ''],
];

const HOW = [
  'You ask; it never runs on its own, and it is pinned to the snapshot it read.',
  '“No trade” is a complete answer, drawn with the same weight as a trade.',
  'A newer snapshot marks the read as older; it never refreshes itself.',
  'A read, not an order: a simulated trade needs your review and confirm.',
];

function Para({ lead, children }: { lead?: string; children: React.ReactNode }) {
  return (
    <Box
      component="p"
      sx={{ m: 0, fontSize: 13.5, lineHeight: 1.55, color: 'text.secondary', textWrap: 'pretty' }}
    >
      {lead && (
        <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
          {lead}
        </Box>
      )}
      {lead && ' '}
      {children}
    </Box>
  );
}

/** The read's shape with nothing in it: where the verdict and the four risk figures would sit. */
function Anatomy() {
  const ghost = (h: number, w: string) => (
    <Box sx={{ height: h, width: w, border: 1, borderColor: 'divider', borderRadius: '8px' }} />
  );
  return (
    <Box aria-hidden sx={{ display: 'grid', gap: 1.25, alignContent: 'start' }}>
      {ghost(14, '46%')}
      {ghost(30, '70%')}
      {ghost(12, '90%')}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
        {['Max risk', 'Invalidation', 'Entry', 'Target'].map((l) => (
          <Box
            key={l}
            sx={(t) => ({
              display: 'grid',
              gap: 0.25,
              p: '8px 10px',
              borderRadius: '8px',
              border: 1,
              borderColor: 'divider',
              bgcolor: extrasFor(t).well,
            })}
          >
            <Box
              component="span"
              sx={{
                ...MONO,
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'text.secondary',
              }}
            >
              {l}
            </Box>
            <Box component="span" sx={{ ...MONO, fontSize: 16, color: 'text.secondary' }}>
              —
            </Box>
          </Box>
        ))}
      </Box>
      {ghost(56, '100%')}
    </Box>
  );
}

function Mark() {
  return (
    <Box
      component="span"
      aria-hidden
      sx={(t) => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        flex: 'none',
        borderRadius: '8px',
        bgcolor: extrasFor(t).well,
        color: 'text.secondary',
      })}
    >
      <AutoAwesomeIcon sx={{ fontSize: 15 }} />
    </Box>
  );
}

/** "What a read sends": the export's production form. Nothing is sent, so it lists what a read
 *  would send and what never leaves. */
export function WhatAReadSends({
  open,
  onClose,
  ticker,
}: {
  open: boolean;
  onClose: () => void;
  ticker: string;
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          'aria-labelledby': 'ai-sends-title',
          sx: {
            width: { xs: '100%', sm: 420 },
            p: 2.5,
            display: 'grid',
            gap: 2,
            alignContent: 'start',
            borderLeft: '1px solid',
            borderColor: 'divider',
          },
        } as object,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="h2"
          id="ai-sends-title"
          sx={{ m: 0, flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700 }}
        >
          {`What a read sends · ${ticker}`}
        </Box>
        <IconButton
          onClick={onClose}
          aria-label="Close what a read sends"
          sx={{ width: 44, height: 44, color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ justifySelf: 'start' }}>
        <DataStateTag state="notLive" detail="Nothing sent" />
      </Box>
      <Para>
        Nothing leaves this site right now: no read runs without the options feed. When one does, it
        sends exactly this, and the export shows it before you ask:
      </Para>
      <Box component="dl" sx={{ m: 0, display: 'grid' }}>
        {SENT.map(([what, detail]) => (
          <Box
            key={what}
            sx={(t) => ({
              display: 'grid',
              gap: 0.25,
              py: 1,
              borderTop: `1px solid ${t.palette.divider}`,
            })}
          >
            <Box component="dt" sx={{ fontSize: 13, color: 'text.primary' }}>
              {what}
            </Box>
            {detail && (
              <Box component="dd" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
                {detail}
              </Box>
            )}
          </Box>
        ))}
      </Box>
      <Para>Never: another ticker, your name or email, broker credentials, or an API key.</Para>
      <Box sx={{ display: 'grid', gap: 1, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box component="h3" sx={{ m: 0, fontSize: 14, fontWeight: 600 }}>
          How a read works
        </Box>
        <Box
          component="ul"
          sx={{
            m: 0,
            pl: 2.25,
            display: 'grid',
            gap: 0.5,
            fontSize: 13,
            lineHeight: 1.55,
            color: 'text.secondary',
          }}
        >
          {HOW.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </Box>
        <Link
          component={RouterLink}
          to="/methodology#ai-read-and-grounding"
          variant="body2"
          underline="always"
          sx={{ ...linkSx, justifySelf: 'start', minHeight: 24 }}
        >
          How Convexa works →
        </Link>
      </Box>
    </Drawer>
  );
}

/** The wide panel: one of the desk's twelve Not live panels, spanning its row. */
export function AiReadNotLive({
  ticker,
  feed,
  demoUrl,
}: {
  ticker: string;
  feed: AiFeedOff;
  demoUrl: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box
      component="article"
      aria-labelledby="feed-ai"
      sx={{
        ...PANEL_SX,
        gridColumn: '1 / -1',
        p: '18px 20px',
        display: 'grid',
        gap: 1.5,
        alignContent: 'start',
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px' }}>
        <Mark />
        <Box
          component="h3"
          id="feed-ai"
          sx={{ m: 0, flex: '1 1 auto', fontSize: 15, fontWeight: 600 }}
        >
          {`AI read · ${ticker}`}
        </Box>
        <DataStateTag state={feed === 'paused' ? 'paused' : 'notLive'} />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.2fr) minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          <Para lead="Would show">
            {`a verdict-first read of ${ticker}’s dealer structure: Trade or No trade, the risk before the rationale (max risk, invalidation, entry, target), why, and when to look again. Every figure says whether it traces to a Convexa number.`}
          </Para>
          <Para lead="Off because">
            {`a read reads the options structure (walls, flip, flow, the candidate contracts), ${OFF[feed]} Without the structure there is nothing honest to analyze.`}
          </Para>
          <Para>
            On a build with the feed, reads run on your own provider key (Anthropic, OpenAI, Gemini
            or Grok) after you sign in. No read ever places an order.
          </Para>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 20px' }}>
            <Link
              href={demoUrl}
              variant="body2"
              underline="always"
              sx={{ ...linkSx, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              See it on the demo →
            </Link>
            <Button
              variant="text"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              sx={{ ...linkSx, minHeight: 44, px: 0, fontWeight: 500, textTransform: 'none' }}
            >
              What a read sends →
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Anatomy />
        </Box>
      </Box>
      <WhatAReadSends open={open} onClose={() => setOpen(false)} ticker={ticker} />
    </Box>
  );
}

/** On a phone the twelve panels fold into one list; the export stays one tap away under it. */
export function WhatAReadSendsLink({ ticker }: { ticker: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="text"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        sx={{
          ...linkSx,
          justifySelf: 'start',
          minHeight: 44,
          px: 0,
          fontWeight: 500,
          textTransform: 'none',
        }}
      >
        What an AI read sends →
      </Button>
      <WhatAReadSends open={open} onClose={() => setOpen(false)} ticker={ticker} />
    </>
  );
}
