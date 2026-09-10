/**
 * `SnapshotHint` — fidelity repair 2, N5: the "Reads the current snapshot, as of {iso}" idle hint
 * reads through `fmtAsOfEt`, never the raw ISO string (design: `Snapshot as of 10:41:52 ET`).
 */
import { makeBundle } from '@/features/auth/testBackend';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SnapshotHint } from './AiRecPanelBlocks';

afterEach(cleanup);

describe('SnapshotHint — as-of is formatted, never raw (fidelity repair 2, N5)', () => {
  it('renders the exchange-clock form and never the raw ISO snapshot timestamp', () => {
    const bundle = makeBundle();
    render(<SnapshotHint bundle={bundle} />);
    const hint = screen.getByText(/Reads the current snapshot/);
    expect(hint.textContent).not.toContain('2026-06-26T14:00:00Z');
    expect(hint.textContent).toMatch(/, as of \d{2}:\d{2}:\d{2} ET/);
  });

  it('a null bundle renders the base sentence with no trailing clause (unchanged)', () => {
    render(<SnapshotHint bundle={null} />);
    expect(screen.getByText('Reads the current snapshot.')).toBeInTheDocument();
  });
});
