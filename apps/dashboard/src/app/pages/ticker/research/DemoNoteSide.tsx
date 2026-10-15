/**
 * The side column of the demo's research note (Final · Research tab · note, staging board): what the
 * sample is, then the public panels the production note carries beside it, on the demo's authored
 * figures: short interest shaped like FINRA's, and a filing list shaped like SEC EDGAR's. Both read
 * the demo transport's public-data answer (libs/api demo/public-data.ts), so nothing leaves the
 * browser; both are dashed and say what they are shaped like (canon P-3, P-8).
 */
import { ShortInterestCard } from '@/pages/research/NotePublicPanels';
import { formatShortDate } from '@/pages/research/format';
import type { Read } from '@/pages/research/publicData';
import { MONO } from '@/pages/research/ui';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { extrasFor } from '@/shared/theme/tokens';
import type { PublicTicker } from '@convexa/api';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';

function Panel({
  title,
  tag,
  sample = false,
  children,
}: {
  title: string;
  tag: ReactNode;
  sample?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={(t) => ({
        position: 'relative',
        display: 'grid',
        gap: 1,
        alignContent: 'start',
        p: '18px 18px 16px',
        borderRadius: '12px',
        bgcolor: 'background.paper',
        border: sample
          ? `1px dashed ${extrasFor(t).textTertiary}`
          : `1px solid ${t.palette.divider}`,
        ...(sample && {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 8,
            borderRadius: '11px 11px 0 0',
            pointerEvents: 'none',
            background: `repeating-linear-gradient(135deg, transparent 0 6px, ${alpha(
              t.palette.text.secondary,
              0.28,
            )} 6px 12px)`,
          },
        }),
      })}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px 10px',
        }}
      >
        <Box component="h2" sx={{ m: 0, fontSize: 15, fontWeight: 600 }}>
          {title}
        </Box>
        {tag}
      </Box>
      {children}
    </Box>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <Box
      component="span"
      sx={(t) => ({
        ...MONO,
        justifySelf: 'start',
        maxWidth: '100%',
        fontSize: 11,
        lineHeight: 1.35,
        px: 1.25,
        py: '4px',
        borderRadius: '12px',
        border: `1px dashed ${alpha(t.palette.text.secondary, 0.55)}`,
        color: 'text.secondary',
        overflowWrap: 'anywhere',
      })}
    >
      {text}
    </Box>
  );
}

/** `read`: the demo transport's public-data answer for the symbol, shared with the public-record
 *  band under the note (ResearchView), so the page reads it once. */
export function DemoNoteSide({ symbol, read }: { symbol: string; read: Read<PublicTicker> }) {
  const d = read.data;
  return (
    <Box
      component="aside"
      aria-label="About this note"
      sx={{ display: 'grid', gap: 2, minWidth: 0 }}
    >
      <Panel title="About this sample" tag={<DataStateTag state="demo" />}>
        <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary', textWrap: 'pretty' }}>
          Every figure cites a sample bar from the Oct 7 scenario. The production site shows the
          owner’s real notes, with their sources, freshness and the public panels.
        </Box>
      </Panel>
      {read.loading && !d ? (
        <Box
          aria-busy="true"
          aria-label={`Loading ${symbol} sample panels`}
          sx={{ display: 'grid', gap: 2 }}
        >
          <Skeleton variant="rounded" height={220} />
          <Skeleton variant="rounded" height={140} />
        </Box>
      ) : read.error || !d ? (
        <Panel title="Positioning and filings" tag={<DataStateTag state="couldntLoad" />} sample>
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
            Sample data could not load. Nothing was sent anywhere.
          </Box>
          <Button onClick={read.retry} sx={{ justifySelf: 'start', minHeight: 44 }}>
            Retry demo
          </Button>
        </Panel>
      ) : (
        <>
          <ShortInterestCard d={d} compact />
          <Panel title="Filings" tag={<DataStateTag state="sample" />} sample>
            {d.filings.length === 0 ? (
              <Box component="p" sx={{ m: 0, fontSize: 13, color: 'text.secondary' }}>
                {`The sample authors no filings for ${symbol}.`}
              </Box>
            ) : (
              <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
                {d.filings.map((f) => (
                  <Box
                    component="li"
                    key={f.accession}
                    sx={(t) => ({
                      display: 'grid',
                      gridTemplateColumns: '56px minmax(0, 1fr)',
                      gap: 1.25,
                      py: 1,
                      borderTop: `1px solid ${t.palette.divider}`,
                      fontSize: 13,
                    })}
                  >
                    <Box component="span" sx={{ ...MONO, color: 'text.secondary' }}>
                      {formatShortDate(f.filed)}
                    </Box>
                    <span>
                      <Box component="span" sx={{ ...MONO, fontSize: 12, mr: 1 }}>
                        {f.form}
                      </Box>
                      {f.items.length > 0 && (
                        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                          {`Item ${f.items.join(', ')}`}
                        </Box>
                      )}
                    </span>
                  </Box>
                ))}
              </Box>
            )}
            {d.filings.length > 0 && (
              <Box component="p" sx={{ m: 0, fontSize: 12, color: 'text.secondary' }}>
                A sample filing list for the scenario. Not SEC records.
              </Box>
            )}
            <Chip text="Sample · shaped like SEC EDGAR" />
          </Panel>
        </>
      )}
    </Box>
  );
}
