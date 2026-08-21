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
import { typographyTokens } from '@/shared/theme/tokens';
import type { BrokerBook, OptionRight } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
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
  source: 'broker_webull';
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

export function buildBrokerReassessment(
  view: BrokerPositionView,
  book: Pick<BrokerBook, 'as_of'> | null,
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

  return {
    source: 'broker_webull',
    ticker: view.ticker,
    as_of_basis:
      asOf != null
        ? `on your book as of ${asOf} (${stampTime(asOf)}) · Webull · read-only · read on demand — a snapshot, never live.`
        : 'book as-of unknown — Webull · read-only · read on demand — a snapshot, never live.',
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
        <DialogTitle sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
          Reassessment request — advisory only
        </DialogTitle>
        <DialogContent>
          {/* The visible basis carry (AC-18) — foregrounded, not buried in the JSON. */}
          <Typography
            data-testid="broker-reassess-basis"
            sx={{
              fontFamily: typographyTokens.monoFontFamily,
              fontSize: '0.8rem',
              fontVariantNumeric: 'tabular-nums',
              color: 'text.secondary',
              mb: 1,
            }}
          >
            {req.as_of_basis}
          </Typography>
          <Box
            component="pre"
            data-testid="broker-reassess-json"
            sx={{
              fontFamily: typographyTokens.monoFontFamily,
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
        </DialogContent>
        {/* Advisory display only: copy + close. NO accept, NO write, NO order path (AC-19). */}
        <DialogActions>
          <Button
            data-testid="broker-reassess-copy"
            onClick={() => void navigator.clipboard?.writeText?.(json)}
          >
            Copy request
          </Button>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
