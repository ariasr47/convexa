import { extrasFor, typographyTokens } from '@/shared/theme/tokens';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect } from 'react';
import { BANNED_ON_SCREEN, COPY, originRejectedBody } from './copy';
import { lookupCoverageCell } from './occupancy';
import { TRIO, type TrioSymbol } from './schedule';
import { useSessionArchive, type UseSessionArchiveOptions } from './useSessionArchive';
import type { ArchiveState } from './viewModel';

const mono = { fontFamily: typographyTokens.monoFontFamily } as const;

void BANNED_ON_SCREEN;

export type OperatorSessionArchiveProps = UseSessionArchiveOptions;

function GateForm({
  api,
  originError,
  tokenError,
}: {
  api: ReturnType<typeof useSessionArchive>;
  originError?: boolean;
  tokenError?: boolean;
}) {
  return (
    <Stack spacing={2} sx={{ maxWidth: 560 }}>
      <Typography variant="body2" color="text.secondary">
        {COPY.lockedCaption}
      </Typography>
      {api.documentIsPages && (
        <Typography variant="body2" color="text.secondary" data-testid="osa-pages-helper">
          {COPY.pagesHelper}
        </Typography>
      )}
      <Tooltip title={COPY.originTooltip}>
        <TextField
          label={COPY.originLabel}
          helperText={COPY.originHelper}
          value={api.originDraft}
          onChange={(e) => api.setOriginDraft(e.target.value)}
          autoComplete="off"
          // Not type="url" — native URL validation must not replace our Alert.
          type="text"
          error={originError}
          fullWidth
          slotProps={{
            htmlInput: {
              'data-testid': 'osa-origin',
              spellCheck: false,
              inputMode: 'url',
            },
          }}
        />
      </Tooltip>
      <Tooltip title={COPY.tokenTooltip}>
        <TextField
          label={COPY.tokenLabel}
          helperText={COPY.tokenHelper}
          value={api.tokenDraft}
          onChange={(e) => api.setTokenDraft(e.target.value)}
          autoComplete="off"
          type="password"
          error={tokenError}
          fullWidth
          slotProps={{
            htmlInput: {
              'data-testid': 'osa-token',
            },
          }}
        />
      </Tooltip>
      <Button
        variant="contained"
        onClick={api.unlock}
        sx={{ minHeight: 44, alignSelf: 'flex-start' }}
        data-testid="osa-unlock"
      >
        {COPY.unlock}
      </Button>
    </Stack>
  );
}

function StandingAlert({
  title,
  body,
  caption,
  onRetry,
}: {
  title: string;
  body: string;
  caption?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert severity="warning" role="alert" data-testid="osa-standing-alert">
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2">{body}</Typography>
      {caption && (
        <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
          {caption}
        </Typography>
      )}
      {onRetry && (
        <Button
          size="small"
          onClick={onRetry}
          sx={{ mt: 1, minHeight: 44 }}
          data-testid="osa-retry"
        >
          {COPY.retry}
        </Button>
      )}
    </Alert>
  );
}

function CoverageCard({
  state,
  onPresent,
  onRetry,
}: {
  state: ArchiveState;
  onPresent: (id: { symbol: string; et_date: string }) => void;
  onRetry: () => void;
}) {
  const c = state.coverage;
  if (c.kind === 'hidden' || c.kind === 'loading') {
    if (c.kind === 'loading') {
      return (
        <Box data-testid="osa-coverage" aria-busy>
          <CircularProgress size={18} />
        </Box>
      );
    }
    return null;
  }
  if (c.kind === 'unavailable') {
    return (
      <Card variant="outlined" data-testid="osa-coverage">
        <CardContent>
          <StandingAlert
            title={COPY.coverageUnavailable}
            body={COPY.coverageUnavailableCaption}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }
  if (c.kind === 'withheld') {
    return (
      <Card variant="outlined" data-testid="osa-coverage">
        <CardContent>
          <StandingAlert
            title={
              c.error === 'not-storing'
                ? 'session archive not storing'
                : 'session archive store error:'
            }
            body={c.detail ?? ''}
            caption={COPY.traderUnaffected}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }
  if (c.kind === 'invariant-fault') {
    return (
      <Card variant="outlined" data-testid="osa-coverage">
        <CardContent>
          <StandingAlert
            title={COPY.invariantTitle}
            body={COPY.invariantCoverage}
            caption={COPY.traderUnaffected}
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    );
  }

  const m = c.matrix;
  // Empty-expected keys off payload framing + empty rows/holes — not verdict===not_due alone
  // (that footgun hid not-yet-due session weekdays behind no-expected chrome).
  const emptyExpected =
    m.framing === COPY.coverageFramingWeekend && m.rows.length === 0 && m.holes.length === 0;
  return (
    <Card variant="outlined" data-testid="osa-coverage">
      <CardContent>
        <Typography variant="subtitle1">{m.framing || COPY.coverageFraming}</Typography>
        <Typography variant="body2" sx={mono}>
          {COPY.coverageCommand}
        </Typography>
        <Typography variant="body2" sx={mono}>
          {COPY.coverageEvidence}
        </Typography>
        <Typography variant="body2">{COPY.coverageSymbols}</Typography>
        <Typography variant="body2" sx={mono}>
          {COPY.coverageCheckpoint}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, ...mono }}>
          {`Expected due: ${m.expected_due} · present: ${m.present} · missing: ${m.missing} · unreadable: ${m.unreadable} · not yet due: ${m.not_yet_due}`}
          {` · blocked occupancy: ${m.blocked_occupancy}`}
        </Typography>
        {!emptyExpected && (
          <Typography
            variant="body2"
            sx={(theme) => ({
              mt: 1,
              ...mono,
              ...(m.verdict === 'fail' ? { color: extrasFor(theme).textAmber } : {}),
            })}
          >
            {m.verdict}
          </Typography>
        )}
        {!emptyExpected && (
          <Stack spacing={0.5} sx={{ mt: 1 }} data-testid="osa-coverage-rows">
            {m.rows.map((row) => {
              const looked = lookupCoverageCell(row.cell);
              const token = looked.kind === 'known' ? looked.cell : row.cell;
              const isPresent = token === 'present';
              if (isPresent) {
                return (
                  <Button
                    key={`${row.symbol}-${row.et_date}`}
                    size="small"
                    onClick={() => onPresent({ symbol: row.symbol, et_date: row.et_date })}
                    sx={{ justifyContent: 'flex-start', minHeight: 44, ...mono }}
                    data-testid={`osa-present-${row.symbol}`}
                  >
                    {`${row.symbol} ${row.et_date} ${token}`}
                  </Button>
                );
              }
              return (
                <Typography
                  key={`${row.symbol}-${row.et_date}`}
                  variant="body2"
                  sx={mono}
                  component="div"
                >
                  {`${row.symbol} ${row.et_date} ${token}`}
                </Typography>
              );
            })}
          </Stack>
        )}
        {m.rows.map((row) =>
          row.last_readable ? (
            <Typography
              key={`lr-${row.symbol}`}
              variant="caption"
              sx={{ ...mono, display: 'block' }}
            >
              {`last readable: ${row.last_readable}`}
            </Typography>
          ) : null,
        )}
        {m.holes.map((h) => (
          <Typography
            key={`h-${h.symbol}-${h.et_date}`}
            variant="caption"
            sx={{ ...mono, display: 'block' }}
          >
            {`${h.symbol} ${h.et_date} ${h.class}`}
          </Typography>
        ))}
        <Typography variant="body2" sx={{ mt: 1 }}>
          {COPY.coverageClosing}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function OperatorSessionArchive(props: OperatorSessionArchiveProps = {}) {
  const api = useSessionArchive(props);
  const { state } = api;

  useEffect(() => {
    const prev = document.title;
    document.title = COPY.documentTitle;
    return () => {
      document.title = prev || 'Convexa';
    };
  }, []);

  const standing = state.standing;
  const showGate =
    standing.kind === 'locked' ||
    standing.kind === 'origin-rejected' ||
    standing.kind === 'unauthorized' ||
    standing.kind === 'origin-blocked' ||
    !state.gateCollapsed;

  const pageLevelExclusive =
    standing.kind === 'not-storing' ||
    standing.kind === 'list-store-error' ||
    standing.kind === 'cors-fault' ||
    standing.kind === 'origin-blocked' ||
    standing.kind === 'unauthorized' ||
    standing.kind === 'origin-rejected' ||
    standing.kind === 'locked';

  return (
    <Box data-testid="operator-session-archive" sx={{ minHeight: '100vh' }}>
      <AppBar position="static" elevation={0} color="default">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {COPY.appBar}
          </Typography>
          <Chip size="small" variant="outlined" label={COPY.readOnlyChip} sx={{ mr: 1 }} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack spacing={2}>
          {state.gateCollapsed && standing.kind === 'open' && (
            <Button
              size="small"
              onClick={api.reopenGate}
              sx={{ alignSelf: 'flex-start', minHeight: 44 }}
              data-testid="osa-change-gate"
            >
              {COPY.changeOriginOrToken}
            </Button>
          )}

          {showGate && (
            <GateForm
              api={api}
              originError={standing.kind === 'origin-rejected'}
              tokenError={standing.kind === 'unauthorized'}
            />
          )}

          {standing.kind === 'origin-rejected' && (
            <StandingAlert
              title={COPY.originRejectedTitle}
              body={originRejectedBody(standing.reason)}
            />
          )}
          {standing.kind === 'origin-blocked' && (
            <StandingAlert
              title={COPY.originBlockedTitle}
              body={COPY.originBlockedBody}
              caption={COPY.traderUnaffected}
            />
          )}
          {standing.kind === 'unauthorized' && (
            <StandingAlert
              title={COPY.unauthorizedTitle}
              body={standing.detail || COPY.unauthorizedBody}
              caption={COPY.unauthorizedHelper}
            />
          )}
          {standing.kind === 'cors-fault' && (
            <StandingAlert
              title={COPY.corsTitle}
              body={COPY.corsBody}
              caption={COPY.traderUnaffected}
              onRetry={api.pageRetry}
            />
          )}
          {standing.kind === 'not-storing' && (
            <StandingAlert
              title="session archive not storing"
              body={standing.detail || 'session archive not storing'}
              caption={COPY.traderUnaffected}
              onRetry={api.pageRetry}
            />
          )}
          {standing.kind === 'list-store-error' && (
            <StandingAlert
              title="session archive store error:"
              body={standing.detail || ''}
              caption={COPY.traderUnaffected}
              onRetry={api.pageRetry}
            />
          )}
          {standing.kind === 'list-invariant-fault' && (
            <StandingAlert
              title={COPY.invariantTitle}
              body={COPY.invariantList}
              caption={COPY.traderUnaffected}
              onRetry={api.pageRetry}
            />
          )}

          {!pageLevelExclusive && (
            <>
              {(state.books.kind === 'ready' || state.books.kind === 'stale') && (
                <Typography variant="body2" data-testid="osa-authorizes">
                  {`${COPY.authorizesLabel} ${COPY.authorizesNothing}`}
                </Typography>
              )}

              <Stack direction="row" spacing={1} data-testid="osa-chips">
                {TRIO.map((sym) => (
                  <Chip
                    key={sym}
                    label={sym}
                    color={state.selected === sym ? 'primary' : 'default'}
                    variant={state.selected === sym ? 'filled' : 'outlined'}
                    onClick={() => api.selectChip(sym as TrioSymbol)}
                    sx={{ minHeight: 44 }}
                    data-testid={`osa-chip-${sym}`}
                  />
                ))}
              </Stack>

              {api.stale && (
                <Chip
                  size="small"
                  label={COPY.staleChip}
                  data-testid="osa-stale-chip"
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}

              <CoverageCard state={state} onPresent={api.presentClick} onRetry={api.pageRetry} />

              <Box data-testid="osa-books">
                {state.books.kind === 'loading' && (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} aria-busy>
                    <CircularProgress size={18} />
                    <Typography variant="body2">{COPY.loading}</Typography>
                  </Stack>
                )}
                {state.books.kind === 'offline' && (
                  <StandingAlert
                    title={COPY.offline}
                    body={COPY.traderUnaffected}
                    onRetry={api.pageRetry}
                  />
                )}
                {state.books.kind === 'empty' && (
                  <Alert severity="info" data-testid="osa-empty">
                    <Typography variant="subtitle2">
                      {state.books.framing || COPY.booksFramingEmpty}
                    </Typography>
                    <Typography variant="body2">{state.books.detail}</Typography>
                  </Alert>
                )}
                {(state.books.kind === 'ready' || state.books.kind === 'stale') && (
                  <Table size="small" data-testid="osa-books-table">
                    <TableHead>
                      <TableRow>
                        <TableCell>et_date</TableCell>
                        <TableCell>
                          <Tooltip title={COPY.sourceTooltip}>
                            <span>source</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell>source_as_of</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {state.books.rows.map((row) => (
                        <TableRow
                          key={`${row.symbol}-${row.et_date}`}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => api.openBook({ symbol: row.symbol, et_date: row.et_date })}
                          data-testid={`osa-book-row-${row.et_date}`}
                        >
                          <TableCell sx={mono}>{row.et_date}</TableCell>
                          <TableCell sx={mono}>{row.source}</TableCell>
                          <TableCell sx={mono}>{row.source_as_of}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>

              <Box data-testid="osa-digest">
                {state.digest.kind === 'loading' && (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} aria-busy>
                    <CircularProgress size={18} />
                    <Typography variant="body2">{COPY.loading}</Typography>
                  </Stack>
                )}
                {state.digest.kind === 'ready' && (
                  <Card variant="outlined" data-testid="osa-digest-ready">
                    <CardContent>
                      <Typography variant="subtitle1">{state.digest.digest.framing}</Typography>
                      <Typography variant="body2" sx={mono}>
                        {`${state.digest.digest.symbol} · ${state.digest.digest.et_date}`}
                      </Typography>
                      <Typography variant="body2" sx={mono}>
                        {state.digest.digest.source_as_of}
                      </Typography>
                      <Typography variant="body2" sx={mono}>
                        {state.digest.digest.source}
                      </Typography>
                      <Typography variant="body2">
                        {`${COPY.authorizesLabel} ${state.digest.digest.authorizes}`}
                      </Typography>
                      <Typography variant="body2">{state.digest.digest.provenance}</Typography>
                      <Typography variant="body2">{state.digest.digest.license}</Typography>
                      <Tooltip title={COPY.contractsCountTooltip}>
                        <Typography variant="body2" sx={mono}>
                          {`contracts: ${state.digest.digest.contractsCount}`}
                        </Typography>
                      </Tooltip>
                      <Typography variant="body2" sx={mono}>
                        {`daily_bars: ${state.digest.digest.dailyBarsCount}`}
                      </Typography>
                      <Typography variant="body2" sx={mono}>
                        {`minutes: ${state.digest.digest.minutesCount}`}
                      </Typography>
                      <Typography variant="body2" sx={mono}>
                        {`trades: ${state.digest.digest.tradesCount}`}
                      </Typography>
                    </CardContent>
                  </Card>
                )}
                {state.digest.kind === 'load-miss' && (
                  <StandingAlert title="load-miss" body={state.digest.detail || ''} />
                )}
                {state.digest.kind === 'unreadable' && (
                  <StandingAlert
                    title="session book unreadable:"
                    body={state.digest.detail || ''}
                    caption={COPY.traderUnaffected}
                    onRetry={api.digestRetry}
                  />
                )}
                {state.digest.kind === 'invariant-fault' && (
                  <StandingAlert
                    title={COPY.invariantTitle}
                    body={COPY.invariantLoad}
                    caption={COPY.traderUnaffected}
                    onRetry={api.digestRetry}
                  />
                )}
              </Box>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
