/**
 * F6 — reassessment referencing a REAL holding (SPEC flow 3, AC-18/19).
 *
 * The request assembly CALLS the existing machinery, never reimplements it: the subject leg is
 * the projection's `eval_subject` (the existing `evalSubjectOf` selection, untouched), and the
 * contract-reference shape is EXACTLY the shipped `pos_*` position-context shape
 * (`TickerQuery.position` — expiration/strike/right/plPct) the app already assembles for sim
 * holdings. What broker adds is the AS-OF BASIS CARRY: the AI is never handed a real position
 * without its staleness disclosed — the basis line rides the request AND the visible export.
 *
 * ADVISORY ONLY (AC-19): the surface renders the assembled request for copy/hand-off and offers
 * NO Accept-into-store or any other write action. The sim reassessment Accept flow is untouched.
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { MONO_FACE } from '@/shared/figure';
import { dataMode, type BrokerBook, type OptionRight } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import type { BrokerPositionView } from './brokerView';
import { BROKER_COPY, stampTime } from './copy';

/** The existing position-context reference shape (`TickerQuery.position`), reused verbatim. */
export interface PositionContextRef {
  expiration: string;
  strike: number;
  right: OptionRight;
  plPct: number | null;
}

export interface BrokerReassessmentRequest {
  /** `demo_sample` on the demo build: its one holding is authored, so it never claims a broker. */
  source: 'broker_webull' | 'demo_sample';
  ticker: string;
  /** The HUMAN-READABLE basis carry (AC-18) — always present, staleness always disclosed. */
  as_of_basis: string;
  /** The machine stamp beside it (null only if the envelope somehow lacked one — never faked). */
  as_of: string | null;
  structure: string;
  structure_line: string;
  qty: string;
  /** The existing `pos_*` reference — null for a holding with no option subject (shares-only). */
  position: PositionContextRef | null;
  /** The modeled figure NEVER travels without its named basis. */
  modeled_pl_dollar: number | null;
  modeled_pl_basis: string;
}

/** "Oct 7, 2026 · 2:30 PM ET" — the scenario's own clock, in New York time. */
export function demoAsOfText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tz = { timeZone: 'America/New_York' } as const;
  const day = d.toLocaleDateString('en-US', {
    ...tz,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', { ...tz, hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time} ET`;
}

export function buildBrokerReassessment(
  view: BrokerPositionView,
  book: Pick<BrokerBook, 'as_of'> | null,
  { demo = dataMode === 'demo' }: { demo?: boolean } = {},
): BrokerReassessmentRequest {
  const asOf = book?.as_of ?? null;
  // The EXISTING subject selection (evalSubjectOf, called by the projection — one authority).
  const subject = view.eval_subject;
  const subjectLeg =
    subject.kind === 'none'
      ? null
      : (view.position.legs.find((l) => l.id === subject.leg_id) ?? null);
  const position: PositionContextRef | null =
    subjectLeg != null &&
    subjectLeg.expiration != null &&
    subjectLeg.strike != null &&
    subjectLeg.right != null
      ? {
          expiration: subjectLeg.expiration,
          strike: subjectLeg.strike,
          right: subjectLeg.right,
          plPct: view.pl_pct.kind === 'value' ? view.pl_pct.value : null,
        }
      : null;

  // The demo's holding is authored (canon: public demo data is synthetic): a demo source and a
  // synthetic basis, never a broker's name (Final More overlays, reassessment board).
  const as_of_basis = demo
    ? asOf != null
      ? `on the demo book as of ${demoAsOfText(asOf)} · synthetic · a snapshot, never live.`
      : 'demo book as-of unknown · synthetic · a snapshot, never live.'
    : asOf != null
      ? `on your book as of ${asOf} (${stampTime(asOf)}) · Webull · read-only · read on demand — a snapshot, never live.`
      : 'book as-of unknown — Webull · read-only · read on demand — a snapshot, never live.';
  return {
    source: demo ? 'demo_sample' : 'broker_webull',
    ticker: view.ticker,
    as_of_basis,
    as_of: asOf,
    structure: view.structure_label,
    structure_line: view.structure_line_full,
    qty: view.qty_text,
    position,
    modeled_pl_dollar: view.pl_dollar,
    modeled_pl_basis: BROKER_COPY.modeled.label,
  };
}

/** The row affordance + advisory export dialog. Never a write; never an accept. */
export function BrokerReassessAction({
  view,
  book,
}: {
  view: BrokerPositionView;
  book: Pick<BrokerBook, 'as_of'> | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  if (view.fidelity === 'unrecognized') return null; // nothing faithful to reference
  const req = buildBrokerReassessment(view, book);
  const json = JSON.stringify(req, null, 2);

  return (
    <>
      <Button
        size="small"
        variant="text"
        data-testid="broker-reassess"
        onClick={() => setOpen(true)}
        sx={{ minHeight: 44 }}
      >
        Build reassessment
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            fontSize: '1.05rem',
            fontWeight: 700,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {`Reassessment request · ${view.ticker}`}
          {dataMode === 'demo' && <DataStateTag state="sample" />}
        </DialogTitle>
        <DialogContent>
          {/* The visible basis carry (AC-18) — foregrounded, not buried in the JSON. */}
          <Typography
            data-testid="broker-reassess-basis"
            sx={{ ...MONO_FACE, fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}
          >
            {req.as_of_basis}
          </Typography>
          <Box
            component="pre"
            data-testid="broker-reassess-json"
            sx={{
              ...MONO_FACE,
              fontSize: '0.72rem',
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '8px',
              p: '10px',
              m: 0,
              overflow: 'auto',
              maxHeight: 320,
            }}
          >
            {json}
          </Box>
          <Typography
            variant="body2"
            data-testid="broker-reassess-advisory"
            sx={{ mt: 1.5, fontSize: 13, color: 'text.secondary', lineHeight: 1.5 }}
          >
            <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Advisory only.
            </Box>{' '}
            Copy it into a read of your own. Nothing here places, changes or cancels an order, and
            nothing is added to your book.
            {dataMode === 'demo' ? ' On the demo nothing is sent.' : ''}
          </Typography>
        </DialogContent>
        {/* Advisory display only: copy + close. NO accept, NO write, NO order path (AC-19). */}
        <DialogActions>
          <Button
            data-testid="broker-reassess-copy"
            aria-live="polite"
            onClick={() => {
              void navigator.clipboard?.writeText?.(json);
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy request'}
          </Button>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
