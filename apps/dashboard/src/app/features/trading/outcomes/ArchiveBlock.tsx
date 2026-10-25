/**
 * outcome-ledger — the Archive block (UX_BLUEPRINT §5.9). Present in EVERY state, including empty
 * and unreadable (export must work with zero history, and on an empty surface the archive is the
 * only useful thing here).
 *
 * ⚠ UNGATED (AC-25, `[server-side-gate-enforcement]`). NO `useGate`, NO `gate.guard`, NO
 * `gate.prompt`, NO `simTradeGate`, NO `SignInPrompt`, NO `features/auth` import. `PortfolioPanel` —
 * the component directly above this one on the same page — server-gates every write, and Import
 * *looks* like a write. It is not comparable: it reaches no server, creates no position, costs
 * nothing, and writes only into the user's own browser. There is no boundary at which a gate could
 * be enforced, so an FE-only gate would be decorative — and a decorative gate is forbidden.
 * **Ungated is the decision, not an oversight.**
 *
 * ⚠ ONLY-ADDS (`[loss-free-durable-migration]`). No Restore, no Replace, no Overwrite, no Clear, no
 * Reset, no "Start fresh", no "Import as new" — not a button, not a mode, not a checkbox, not a copy
 * line. Nothing is parsed-and-written before Import is pressed; a declined import leaves the stores
 * byte-untouched and says so.
 */
import { TR_ARCHIVE_PARTIAL_NOTE } from '@/features/trading/positions/labels';
import { positionsFaulted } from '@/features/trading/positions/store';
import { MONO_FACE } from '@/shared/figure';
import { extrasFor } from '@/shared/theme/tokens';
import { bottomSheetActionsSx, bottomSheetDialogSx, grabHandleSx } from '@/shared/ui/bottomSheet';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import type { Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useCallback, useRef, useState } from 'react';
import {
  DeclineReason,
  downloadArchive,
  importArchive,
  ImportReport,
  parseArchive,
} from './archive';
import {
  TR_ARCHIVE_HEADING,
  TR_ARCHIVE_LEAD,
  TR_DECLINE_NOT_OURS,
  TR_DECLINE_UNREADABLE,
  TR_DECLINE_VERSION,
  TR_DIALOG_CLOSE,
  TR_EXPORT_LABEL,
  TR_IMPORT_CANCEL,
  TR_IMPORT_CONFIRM,
  TR_IMPORT_CONFIRM_BODY,
  TR_IMPORT_CONFIRM_NOTE,
  TR_IMPORT_CONFIRM_TITLE,
  TR_IMPORT_DECLINED_STORE_BODY,
  TR_IMPORT_DECLINED_STORE_TITLE,
  TR_IMPORT_DECLINED_TITLE,
  TR_IMPORT_DONE,
  TR_IMPORT_DONE_TITLE,
  TR_IMPORT_FOOTER,
  TR_IMPORT_LABEL,
  trExportEmpty,
  trExportOk,
  trImportAdded,
  trImportConfirmFile,
  trImportConflict,
  trImportDeclinedBody,
  trImportSkipped,
} from './copy';

/**
 * The decline set is CLOSED, in TWO CLASSES (§5.9.1) — never a raw parser message, never a stack
 * trace. This map is CLASS A ONLY: the `{reason}` fragments the shared template composes.
 *
 * ⚠ `store_unreadable` is CLASS B and is deliberately absent — it is NOT a `{reason}` fragment. It
 * renders its own title + body DIRECTLY (below), because class A's template ends "Your existing data
 * was not changed," which is inverted here: not touching your data IS the entire event. The
 * `Exclude<>` makes that structural — adding class B back to this map is a type error.
 */
const DECLINE_COPY: Record<Exclude<DeclineReason, 'store_unreadable'>, string> = {
  unreadable: TR_DECLINE_UNREADABLE,
  not_ours: TR_DECLINE_NOT_OURS,
  version: TR_DECLINE_VERSION,
};

/** The board's ghost `sm` button (`.btn.ghost.sm`): 30px, radius 8, steel; 44 on a coarse pointer
 *  (the theme's floor for every button). */
const closeButtonSx = {
  width: 30,
  height: 30,
  borderRadius: '8px',
  color: 'text.secondary',
} as const;

/** The board's dialog head (`.v4dlg .dh`): the 16px/700 title, then its close, over a divider
 *  (the body's own, `DialogContent dividers`). */
function DialogHead({
  title,
  testid,
  onClose,
}: {
  title: string;
  testid: string;
  onClose: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: '18px', py: '14px' }}>
      <DialogTitle
        data-testid={testid}
        sx={{ p: 0, flex: '1 1 auto', minWidth: 0, fontSize: '1rem', fontWeight: 700 }}
      >
        {title}
      </DialogTitle>
      <IconButton size="small" aria-label={TR_DIALOG_CLOSE} onClick={onClose} sx={closeButtonSx}>
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
}

/** The board's body (`.v4dlg .db`): 16px 18px, its parts 14px apart. */
const dialogBodySx = {
  px: '18px',
  py: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
} as const;

/** The board's foot (`.v4dlg .df`): 12px 18px, the actions at the end. */
const dialogFootSx = { px: '18px', py: '12px', gap: 1, '& > :not(style) ~ :not(style)': { ml: 0 } };

/** The board's callout (`.ov-call`): the raised surface, radius 8, 12.5px steel with its glyph. */
const calloutSx = (t: Theme) => ({
  display: 'flex',
  gap: '8px',
  alignItems: 'flex-start',
  p: '10px 12px',
  borderRadius: '8px',
  bgcolor: extrasFor(t).panelRaised,
  color: 'text.secondary',
  fontSize: '0.78125rem',
  lineHeight: 1.45,
});

type DialogState =
  | { step: 'closed' }
  /** Step 1 — the mandatory confirm. The file is HELD here, unparsed and unwritten. */
  | { step: 'confirm'; filename: string; text: string }
  /** Step 2 — the mandatory report, after EVERY attempt. */
  | { step: 'report'; report: ImportReport }
  | { step: 'declined'; reason: DeclineReason };

export function ArchiveBlock({
  onImported,
  // READ FROM THE STORE, synchronously on every render — not threaded as a prop. `TrackRecordSection`
  // is bound by AC-E17 to exactly one prop, and correctly so: it is a STATIC historical read that
  // must never take a liveness input. Store health is not liveness, and this block already imports
  // the positions store for the archive itself, so it asks directly.
  faulted = positionsFaulted(),
}: {
  onImported: () => void;
  /**
   * The positions store is faulted (SPEC §2.9, AC-68). Export STILL WORKS and the `Export archive`
   * label is UNCHANGED — an archive of what loaded is exactly what a trader in this state needs.
   * What changes is honesty about completeness: the lead and the post-export snack both say the
   * archive holds only the records that could be read.
   */
  faulted?: boolean;
}) {
  const [dialog, setDialog] = useState<DialogState>({ step: 'closed' });
  const [snack, setSnack] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = useCallback(() => {
    const { filename, empty } = downloadArchive();
    const base = empty ? trExportEmpty(filename) : trExportOk(filename);
    setSnack(faulted ? `${base} ${TR_ARCHIVE_PARTIAL_NOTE}` : base);
  }, [faulted]);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    // `FileReader` rather than `File.text()`: it is universally available, and reading the file is
    // the one step here that can fail on the user's machine. An unreadable file is a DECLINE with a
    // stated reason — never a throw, never a broken page. NOTHING is written on this path.
    try {
      const reader = new FileReader();
      reader.onload = () =>
        setDialog({ step: 'confirm', filename: file.name, text: String(reader.result ?? '') });
      reader.onerror = () => setDialog({ step: 'declined', reason: 'unreadable' });
      reader.readAsText(file);
    } catch {
      setDialog({ step: 'declined', reason: 'unreadable' });
    }
  }, []);

  /** ⚠ The ONLY path that can write. It runs only from the Import button in step 1 — nothing is
   *  parsed-and-written before the user presses it (AC-22). */
  const onConfirmImport = useCallback(() => {
    if (dialog.step !== 'confirm') return;
    const parsed = parseArchive(dialog.text);
    if (!parsed.ok) {
      setDialog({ step: 'declined', reason: parsed.reason });
      return;
    }
    const result = importArchive(parsed.envelope);
    if (!result.ok) {
      setDialog({ step: 'declined', reason: result.reason });
      return;
    }
    setDialog({ step: 'report', report: result });
    // Recompute the read FROM THE STORES — never patch it.
    onImported();
  }, [dialog, onImported]);

  const close = useCallback(() => setDialog({ step: 'closed' }), []);

  return (
    <Box data-testid="tr-archive" sx={{ mt: 2 }}>
      {/* The heading with its two actions at the row's end, then the lead beneath at full width
          (the Track record panel beside the orders panel is half the column, so a lead squeezed
          between them ran five lines; owner NO-6 A, 2026-10-25). Source order is unchanged:
          heading, lead, actions — `order` only moves the lead under them. */}
      <Stack
        direction="row"
        useFlexGap
        spacing={1.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
          {TR_ARCHIVE_HEADING}
        </Typography>
        <Typography
          variant="body2"
          data-testid="tr-archive-lead"
          sx={{ color: 'text.secondary', flex: '1 1 100%', minWidth: 0, order: 3 }}
        >
          {faulted ? `${TR_ARCHIVE_LEAD} ${TR_ARCHIVE_PARTIAL_NOTE}` : TR_ARCHIVE_LEAD}
        </Typography>
        {/* Always enabled, never gated, never disabled — an empty archive is a valid archive. */}
        <Button
          size="small"
          variant="outlined"
          onClick={onExport}
          data-testid="tr-export"
          sx={{ ml: 'auto' }}
        >
          {TR_EXPORT_LABEL}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => fileRef.current?.click()}
          data-testid="tr-import"
        >
          {TR_IMPORT_LABEL}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={onPick}
          data-testid="tr-import-input"
          style={{ display: 'none' }}
        />
      </Stack>

      {/* The board's dialog (`final-overlays-archive`, fidelity SITE-15): 560 wide, a head with its
          close, the body between dividers, the actions in a foot; under 600px the shared bottom
          sheet. The surface (panel, line, radius 16) is the theme's. Every step takes the same
          frame, so the confirm and the report it leads to are one dialog. */}
      <Dialog
        open={dialog.step !== 'closed'}
        onClose={close}
        fullWidth
        maxWidth={false}
        sx={[{ '& .MuiDialog-paper': { maxWidth: 560 } }, bottomSheetDialogSx]}
      >
        <Box aria-hidden sx={grabHandleSx} />
        {dialog.step === 'confirm' && (
          <>
            <DialogHead
              title={TR_IMPORT_CONFIRM_TITLE}
              testid="tr-import-confirm-title"
              onClose={close}
            />
            <DialogContent dividers sx={dialogBodySx}>
              <Typography
                variant="body2"
                data-testid="tr-import-confirm-body"
                sx={{ fontSize: '0.875rem', lineHeight: 1.55 }}
              >
                {TR_IMPORT_CONFIRM_BODY}
              </Typography>
              <Typography
                component="span"
                data-testid="tr-import-confirm-file"
                sx={{
                  ...MONO_FACE,
                  display: 'block',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  color: 'text.secondary',
                }}
              >
                {trImportConfirmFile(dialog.filename)}
              </Typography>
              <Box data-testid="tr-import-confirm-note" sx={calloutSx}>
                <InfoOutlinedIcon aria-hidden sx={{ fontSize: 14, mt: '2px', flex: 'none' }} />
                <span>{TR_IMPORT_CONFIRM_NOTE}</span>
              </Box>
            </DialogContent>
            <DialogActions sx={[dialogFootSx, bottomSheetActionsSx]}>
              <Button onClick={close}>{TR_IMPORT_CANCEL}</Button>
              <Button variant="contained" onClick={onConfirmImport} data-testid="tr-import-confirm">
                {TR_IMPORT_CONFIRM}
              </Button>
            </DialogActions>
          </>
        )}
        {dialog.step === 'report' && (
          <>
            <DialogHead
              title={TR_IMPORT_DONE_TITLE}
              testid="tr-import-done-title"
              onClose={close}
            />
            <DialogContent dividers sx={dialogBodySx}>
              {/* All three lines ALWAYS render, including zeros. */}
              <Box>
                <Typography variant="body2" data-testid="tr-import-added">
                  {trImportAdded(dialog.report.added)}
                </Typography>
                <Typography variant="body2" data-testid="tr-import-skipped">
                  {trImportSkipped(dialog.report.skipped)}
                </Typography>
                <Typography variant="body2" data-testid="tr-import-conflict">
                  {trImportConflict(dialog.report.conflicts)}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {TR_IMPORT_FOOTER}
              </Typography>
            </DialogContent>
            <DialogActions sx={[dialogFootSx, bottomSheetActionsSx]}>
              <Button variant="contained" onClick={close}>
                {TR_IMPORT_DONE}
              </Button>
            </DialogActions>
          </>
        )}
        {/* Class B — YOUR STORED HISTORY is the problem, and we will not touch it. A third variant
            beside `complete` and `declined (file)`, rendered DIRECTLY: its own title, its own body,
            NOT composed through `trImportDeclinedBody`. Same Done button — a decline is a report,
            not a dead end. */}
        {dialog.step === 'declined' && dialog.reason === 'store_unreadable' && (
          <>
            <DialogHead
              title={TR_IMPORT_DECLINED_STORE_TITLE}
              testid="tr-import-declined-title"
              onClose={close}
            />
            <DialogContent dividers sx={dialogBodySx}>
              <Typography variant="body2" data-testid="tr-import-declined-body">
                {TR_IMPORT_DECLINED_STORE_BODY}
              </Typography>
            </DialogContent>
            <DialogActions sx={[dialogFootSx, bottomSheetActionsSx]}>
              <Button variant="contained" onClick={close}>
                {TR_IMPORT_DONE}
              </Button>
            </DialogActions>
          </>
        )}
        {/* Class A — the FILE is the problem. The shared template + a closed `{reason}` fragment. */}
        {dialog.step === 'declined' && dialog.reason !== 'store_unreadable' && (
          <>
            <DialogHead
              title={TR_IMPORT_DECLINED_TITLE}
              testid="tr-import-declined-title"
              onClose={close}
            />
            <DialogContent dividers sx={dialogBodySx}>
              <Typography variant="body2" data-testid="tr-import-declined-body">
                {trImportDeclinedBody(DECLINE_COPY[dialog.reason])}
              </Typography>
            </DialogContent>
            <DialogActions sx={[dialogFootSx, bottomSheetActionsSx]}>
              <Button variant="contained" onClick={close}>
                {TR_IMPORT_DONE}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={snack != null}
        autoHideDuration={6000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnack(null)} data-testid="tr-export-result">
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ArchiveBlock;
