/**
 * Chart blocks drawn with plain boxes: a column chart, a proportion bar, horizontal comparison bars, a
 * bridge (waterfall) and a unit chart. Each carries a role="img" label that states its numbers, so a
 * screen reader gets the same facts the bars show.
 */
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import type { NoteBlock } from '../types';
import { MONO } from '../ui';

type Of<T extends NoteBlock['type']> = Extract<NoteBlock, { type: T }>;

const fmt = (n: number) =>
  n.toLocaleString('en-US', {
    maximumFractionDigits: Math.abs(n) < 10 && n !== Math.round(n) ? 3 : 1,
  });

/** A round step for about four gridlines. */
function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

const HATCH = (t: Theme) =>
  `repeating-linear-gradient(135deg, ${alpha(t.palette.text.secondary, 0.7)} 0 6px, ${alpha(t.palette.text.secondary, 0.28)} 6px 12px)`;

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <Box component="figcaption" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
      {children}
    </Box>
  );
}

const FIGURE_SX = {
  m: 0,
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: '12px',
  p: 2.5,
  display: 'grid',
  gap: 1.5,
  minWidth: 0,
} as const;

export function ChartBlock({ block }: { block: Of<'chart'> }) {
  const H = 200;
  const max = Math.max(...block.bars.map((b) => b.value), 0);
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) }, (_, i) => (i + 1) * step);
  // Bars scale to H less headroom for the value printed above the tallest one.
  const scale = (H - 20) / top;
  const hasApprox = block.bars.some((b) => b.kind === 'approx');
  const hasGuide = block.bars.some((b) => b.kind === 'guide');
  const label = `${block.caption}: ${block.bars
    .map(
      (b) =>
        `${b.label} ${b.shown || fmt(b.value)}${b.kind ? ` (${b.kind === 'approx' ? 'approximate' : 'guidance'})` : ''}`,
    )
    .join(', ')}`;
  return (
    <Box component="figure" sx={FIGURE_SX}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1 }}>
        <Caption>{block.caption}</Caption>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.75,
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          <Legend swatch={(t) => ({ bgcolor: t.palette.text.secondary })}>Reported</Legend>
          {hasApprox && <Legend swatch={(t) => ({ background: HATCH(t) })}>Approximate</Legend>}
          {hasGuide && (
            <Legend
              swatch={(t) => ({ border: `1.5px dashed ${alpha(t.palette.text.primary, 0.7)}` })}
            >
              Guidance
            </Legend>
          )}
        </Box>
      </Box>
      <Box role="img" aria-label={label} sx={{ position: 'relative', height: H + 24, minWidth: 0 }}>
        {ticks.map((v) => (
          <Box
            key={v}
            sx={(t) => ({
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 24 + v * scale,
              borderTop: `1px dashed ${alpha(t.palette.text.secondary, 0.14)}`,
            })}
          >
            <Box
              component="span"
              sx={{
                ...MONO,
                position: 'absolute',
                left: 0,
                top: -9,
                fontSize: 10,
                color: 'text.secondary',
                bgcolor: 'background.paper',
                pr: 0.75,
              }}
            >
              {fmt(v)}
            </Box>
          </Box>
        ))}
        <Box
          sx={(t) => ({
            position: 'absolute',
            inset: '0 0 24px 44px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: { xs: 0.75, sm: 1.75 },
            borderBottom: `1px solid ${alpha(t.palette.text.secondary, 0.3)}`,
            pb: 0,
          })}
        >
          {block.bars.map((b, i) => {
            const latest = i === block.latest;
            return (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 0.5,
                  position: 'relative',
                }}
              >
                <Box
                  component="span"
                  sx={{
                    ...MONO,
                    fontSize: { xs: 9, sm: 11 },
                    color: latest || b.kind === 'guide' ? 'text.primary' : 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.shown || fmt(b.value)}
                </Box>
                <Box
                  sx={(t) => ({
                    width: '100%',
                    maxWidth: 64,
                    height: Math.max(2, b.value * scale),
                    borderRadius: '6px 6px 2px 2px',
                    boxSizing: 'border-box',
                    ...(b.kind === 'guide'
                      ? { border: `1.5px dashed ${alpha(t.palette.text.primary, 0.65)}` }
                      : b.kind === 'approx'
                        ? { background: HATCH(t) }
                        : { bgcolor: latest ? 'text.primary' : 'text.secondary' }),
                  })}
                />
                <Box
                  component="span"
                  sx={{
                    ...MONO,
                    position: 'absolute',
                    bottom: -22,
                    fontSize: { xs: 9, sm: 11 },
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.label}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function Legend({ swatch, children }: { swatch: (t: Theme) => object; children: React.ReactNode }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        component="span"
        sx={(t) => ({
          width: 10,
          height: 10,
          borderRadius: '2px',
          boxSizing: 'border-box',
          ...swatch(t),
        })}
      />
      {children}
    </Box>
  );
}

/** Shares of one total: the first segment is the strongest tint, so order carries emphasis. */
export function SplitBlock({ block }: { block: Of<'split'> }) {
  const tints = [0.95, 0.6, 0.35, 0.2, 0.12, 0.08, 0.06, 0.05];
  return (
    <Box component="figure" sx={FIGURE_SX}>
      {block.caption && <Caption>{block.caption}</Caption>}
      <Box
        role="img"
        aria-label={block.items
          .map((i) => `${i.label} ${i.share}%${i.detail ? `, ${i.detail}` : ''}`)
          .join('; ')}
        sx={{ display: 'flex', height: 34, borderRadius: '8px', overflow: 'hidden' }}
      >
        {block.items.map((item, i) => (
          <Box
            key={item.label}
            sx={(t) => ({
              width: `${item.share}%`,
              bgcolor: alpha(t.palette.info.main, tints[i] ?? 0.05),
              color: i === 0 ? 'background.default' : 'text.primary',
              display: 'flex',
              alignItems: 'center',
              pl: 1,
              ...MONO,
              fontSize: 12,
              fontWeight: i === 0 ? 600 : 400,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            })}
          >
            {item.share >= 9 ? `${Math.round(item.share)}%` : ''}
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 18px',
          fontSize: 12,
          color: 'text.secondary',
        }}
      >
        {block.items.map((item, i) => (
          <Box
            key={item.label}
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
          >
            <Box
              component="span"
              sx={(t) => ({
                width: 10,
                height: 10,
                borderRadius: '2px',
                bgcolor: alpha(t.palette.info.main, tints[i] ?? 0.05),
              })}
            />
            <Box component="span" sx={{ color: 'text.primary' }}>
              {item.label}
            </Box>
            <Box component="span" sx={MONO}>
              {Math.round(item.share * 10) / 10}%
            </Box>
            {item.detail && <span>· {item.detail}</span>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function CompareBlock({ block }: { block: Of<'compare'> }) {
  const max = Math.max(...block.items.map((i) => i.value), 0) || 1;
  return (
    <Box component="figure" sx={FIGURE_SX}>
      {block.caption && <Caption>{block.caption}</Caption>}
      <Box
        role="img"
        aria-label={block.items.map((i) => `${i.label}: ${i.shown}`).join('; ')}
        sx={{ display: 'grid', gap: 1 }}
      >
        {block.items.map((item) => (
          <Box
            key={item.label}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 150px) minmax(0, 1fr) auto',
              gap: 1.25,
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <Box
              component="span"
              sx={{
                color: item.emph ? 'text.primary' : 'text.secondary',
                fontWeight: item.emph ? 600 : 400,
              }}
            >
              {item.label}
            </Box>
            <Box
              sx={(t) => ({
                height: 14,
                borderRadius: '4px',
                bgcolor: alpha(t.palette.text.secondary, 0.12),
              })}
            >
              <Box
                sx={{
                  width: `${Math.max(1, (item.value / max) * 100)}%`,
                  height: '100%',
                  borderRadius: '4px',
                  bgcolor: item.emph ? 'text.primary' : 'text.secondary',
                }}
              />
            </Box>
            <Box component="span" sx={{ ...MONO, textAlign: 'right', minWidth: 56 }}>
              {item.shown}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** A walk from one total to another. Steps float at their running total; the sign is printed. */
export function BridgeBlock({ block }: { block: Of<'bridge'> }) {
  const H = 160;
  let running = block.steps[0].value;
  const bars = block.steps.map((s, i) => {
    const isTotal = i === 0 || i === block.steps.length - 1;
    if (isTotal) return { ...s, isTotal, from: 0, to: s.value };
    const from = running;
    running += s.value;
    return { ...s, isTotal, from: Math.min(from, running), to: Math.max(from, running) };
  });
  const max = Math.max(...bars.map((b) => b.to), 0) || 1;
  const label = block.steps
    .map((s, i) =>
      i === 0 || i === block.steps.length - 1
        ? `${s.label} ${fmt(s.value)}`
        : `${s.value >= 0 ? 'plus' : 'minus'} ${s.label} ${fmt(Math.abs(s.value))}`,
    )
    .join(', ');
  return (
    <Box component="figure" sx={FIGURE_SX}>
      {block.caption && <Caption>{block.caption}</Caption>}
      <Box
        role="img"
        aria-label={label}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
          gap: 2,
          alignItems: 'end',
          height: H + 22,
        }}
      >
        {bars.map((b, i) => {
          const last = i === bars.length - 1;
          return (
            <Box
              key={i}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <Box
                component="span"
                sx={(t) => ({
                  ...MONO,
                  fontSize: 12,
                  textAlign: 'center',
                  mb: 0.5,
                  color: b.isTotal
                    ? 'text.primary'
                    : b.value >= 0
                      ? t.palette.success.main
                      : t.palette.error.main,
                })}
              >
                {b.isTotal ? fmt(b.value) : `${b.value >= 0 ? '+' : '−'}${fmt(Math.abs(b.value))}`}
              </Box>
              <Box
                sx={(t) => {
                  const tone = b.value >= 0 ? t.palette.success.main : t.palette.error.main;
                  return {
                    height: Math.max(2, ((b.to - b.from) / max) * H),
                    mb: `${(b.from / max) * H}px`,
                    borderRadius: b.isTotal ? '6px 6px 2px 2px' : '4px',
                    boxSizing: 'border-box',
                    ...(b.isTotal
                      ? { bgcolor: last ? 'text.primary' : 'text.secondary' }
                      : { bgcolor: alpha(tone, 0.32), border: `1px solid ${alpha(tone, 0.6)}` }),
                  };
                }}
              />
            </Box>
          );
        })}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
          gap: 2,
          fontSize: 12,
          color: 'text.secondary',
          textAlign: 'center',
        }}
      >
        {bars.map((b, i) => (
          <Box
            component="span"
            key={i}
            sx={{ color: i === bars.length - 1 ? 'text.primary' : undefined }}
          >
            {b.label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** The total drawn as blocks of the unit: "29 years of this year's revenue". */
export function UnitsBlock({ block }: { block: Of<'units'> }) {
  const whole = Math.floor(block.count);
  const part = block.count - whole;
  const cells = Array.from({ length: Math.ceil(block.count) }, (_, i) => (i < whole ? 1 : part));
  return (
    <Box component="figure" sx={FIGURE_SX}>
      {block.caption && <Caption>{block.caption}</Caption>}
      <Box
        role="img"
        aria-label={`${fmt(block.count)} blocks of ${fmt(block.unit)}, totalling ${fmt(block.total)}`}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
      >
        {cells.map((fill, i) => (
          <Box
            key={i}
            sx={(t) => ({
              width: { xs: 22, sm: 28 },
              height: { xs: 22, sm: 28 },
              borderRadius: '6px',
              boxSizing: 'border-box',
              ...(i === 0
                ? { bgcolor: 'text.primary' }
                : fill < 1
                  ? {
                      border: `1px dashed ${alpha(t.palette.info.main, 0.55)}`,
                      background: `linear-gradient(90deg, ${alpha(t.palette.info.main, 0.3)} ${fill * 100}%, transparent ${fill * 100}%)`,
                    }
                  : {
                      bgcolor: alpha(t.palette.info.main, 0.3),
                      border: `1px solid ${alpha(t.palette.info.main, 0.55)}`,
                    }),
            })}
          />
        ))}
      </Box>
      <Box component="span" sx={{ ...MONO, fontSize: 12, color: 'text.secondary' }}>
        {fmt(block.total)} ÷ {fmt(block.unit)} = {fmt(block.count)} (calc)
      </Box>
    </Box>
  );
}
