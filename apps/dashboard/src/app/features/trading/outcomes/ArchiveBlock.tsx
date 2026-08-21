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
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
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
  TR_EXPORT_LABEL,
  TR_IMPORT_CANCEL,
  TR_IMPORT_CONFIRM,
  TR_IMPORT_CONFIRM_BODY,
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

  return (
    <Box data-testid="tr-archive" sx={{ mt: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {TR_ARCHIVE_HEADING}
      </Typography>
      <Typography
        variant="body2"
        data-testid="tr-archive-lead"
        sx={{ color: 'text.secondary', mb: 1 }}
      >
        {faulted ? `${TR_ARCHIVE_LEAD} ${TR_ARCHIVE_PARTIAL_NOTE}` : TR_ARCHIVE_LEAD}
      </Typography>
      <Stack direction="row" spacing={1}>
        {/* Always enabled, never gated, never disabled — an empty archive is a valid archive. */}
        <Button size="small" variant="outlined" onClick={onExport} data-testid="tr-export">
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

      <Dialog open={dialog.step !== 'closed'} onClose={() => setDialog({ step: 'closed' })}>
        {dialog.step === 'confirm' && (
          <>
            <DialogTitle data-testid="tr-import-confirm-title">
              {TR_IMPORT_CONFIRM_TITLE}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" data-testid="tr-import-confirm-body">
                {TR_IMPORT_CONFIRM_BODY}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 1, color: 'text.secondary' }}
              >
                {trImportConfirmFile(dialog.filename)}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialog({ step: 'closed' })}>{TR_IMPORT_CANCEL}</Button>
              <Button variant="contained" onClick={onConfirmImport} data-testid="tr-import-confirm">
                {TR_IMPORT_CONFIRM}
              </Button>
            </DialogActions>
          </>
        )}
        {dialog.step === 'report' && (
          <>
            <DialogTitle data-testid="tr-import-done-title">{TR_IMPORT_DONE_TITLE}</DialogTitle>
            <DialogContent>
              {/* All three lines ALWAYS render, including zeros. */}
              <Typography variant="body2" data-testid="tr-import-added">
                {trImportAdded(dialog.report.added)}
              </Typography>
              <Typography variant="body2" data-testid="tr-import-skipped">
                {trImportSkipped(dialog.report.skipped)}
              </Typography>
              <Typography variant="body2" data-testid="tr-import-conflict">
                {trImportConflict(dialog.report.conflicts)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {TR_IMPORT_FOOTER}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setDialog({ step: 'closed' })}>
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
            <DialogTitle data-testid="tr-import-declined-title">
              {TR_IMPORT_DECLINED_STORE_TITLE}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" data-testid="tr-import-declined-body">
                {TR_IMPORT_DECLINED_STORE_BODY}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setDialog({ step: 'closed' })}>
                {TR_IMPORT_DONE}
              </Button>
            </DialogActions>
          </>
        )}
        {/* Class A — the FILE is the problem. The shared template + a closed `{reason}` fragment. */}
        {dialog.step === 'declined' && dialog.reason !== 'store_unreadable' && (
          <>
            <DialogTitle data-testid="tr-import-declined-title">
              {TR_IMPORT_DECLINED_TITLE}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" data-testid="tr-import-declined-body">
                {trImportDeclinedBody(DECLINE_COPY[dialog.reason])}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setDialog({ step: 'closed' })}>
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
