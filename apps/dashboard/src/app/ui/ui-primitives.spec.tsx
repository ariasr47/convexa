/**
 * Foundation `ui/` primitives — component tests (FRONTEND_EXECUTION_CONTRACT "Tests to write").
 * Pure presentation: render each primitive's states/props and assert OBSERVABLE output + the promoted
 * invariants (ComingSoonBox carries NO nav; ValueCard CTA points at `to`; ConvexityMotif is the shared
 * decorative hero SVG).
 *
 * Scope note (convexa-redesign restart): only the Landing primitives exist right now — ConvexityMotif,
 * ValueCard, ComingSoonBox. The MonoValue/Tile/StatusChip cases land with their own surfaces (Ticker/
 * Positions); they are intentionally omitted here, not broken-imported.
 */
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { Button } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import LockIcon from '@mui/icons-material/Lock';
import { theme } from '../theme';
import { ComingSoonBox, ComingSoonCard, ValueCard, ConvexityMotif, Jargon } from './index';

afterEach(() => cleanup());

function renderUi(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

describe('ComingSoonBox (F2 — inert, no nav)', () => {
  it('renders its children', () => {
    renderUi(<ComingSoonBox><span>Scanner — coming soon</span></ComingSoonBox>);
    expect(screen.getByTestId('coming-soon-box')).toHaveTextContent('Scanner — coming soon');
  });

  it('carries NO navigating element of its own (structural inertness — §1.3)', () => {
    const { container } = renderUi(<ComingSoonBox><span>inert</span></ComingSoonBox>);
    const box = screen.getByTestId('coming-soon-box');
    // The box itself is not an anchor/button and adds no link.
    expect(box.tagName.toLowerCase()).not.toBe('a');
    expect(container.querySelector('[data-testid="coming-soon-box"] a')).toBeNull();
    expect(container.querySelector('[data-testid="coming-soon-box"] button')).toBeNull();
  });

  it('applies the dashed divider border (read as inert)', () => {
    renderUi(<ComingSoonBox><span>x</span></ComingSoonBox>);
    expect(screen.getByTestId('coming-soon-box')).toHaveStyle({ borderStyle: 'dashed' });
  });
});

describe('ValueCard (F2)', () => {
  it('renders icon, title, body and a CTA pointing at `to`', () => {
    renderUi(
      <ValueCard
        icon={<BarChartIcon data-testid="vc-glyph" />}
        title="Ticker / GEX analysis"
        body="dealer gamma walls"
        to="/ticker"
        ctaLabel="Analyze a ticker →"
      />,
    );
    expect(screen.getByTestId('vc-glyph')).toBeInTheDocument();
    expect(screen.getByText('Ticker / GEX analysis')).toBeInTheDocument();
    expect(screen.getByText('dealer gamma walls')).toBeInTheDocument();
    const cta = screen.getByTestId('value-card-cta');
    expect(cta).toHaveTextContent('Analyze a ticker →');
    expect(cta).toHaveAttribute('href', '/ticker');
  });

  it('honors per-card test-id overrides (callers tag each card distinctly)', () => {
    renderUi(
      <ValueCard
        icon={<BarChartIcon />}
        title="t"
        body="b"
        to="/positions"
        ctaLabel="go →"
        testId="vp-positions"
        ctaTestId="vp-positions-cta"
      />,
    );
    expect(screen.getByTestId('vp-positions')).toBeInTheDocument();
    expect(screen.getByTestId('vp-positions-cta')).toHaveAttribute('href', '/positions');
  });
});

describe('Jargon (dotted jargon-tooltip term)', () => {
  it('renders the term inline and surfaces the gloss on hover', async () => {
    const user = userEvent.setup();
    renderUi(<Jargon term="dealer gamma" gloss="A plain-language explanation." />);
    const trigger = screen.getByTestId('jargon');
    expect(trigger).toHaveTextContent('dealer gamma');
    // It is a decorative inline span — never a navigating element.
    expect(trigger.tagName.toLowerCase()).toBe('span');
    expect(trigger.querySelector('a')).toBeNull();
    // The gloss copy surfaces on hover (verbatim, caller-supplied).
    await user.hover(trigger);
    expect(await screen.findByText('A plain-language explanation.')).toBeInTheDocument();
  });
});

describe('ComingSoonCard (composes ComingSoonBox — inert, amber badge, action slot)', () => {
  it('renders the icon, title, body, the amber "coming soon" badge and the action slot', () => {
    renderUi(
      <ComingSoonCard
        testId="brokerage-block"
        icon={<LockIcon data-testid="cs-glyph" />}
        title="Connect a real brokerage"
        body="Connect your real brokerage positions."
        action={<button data-testid="cs-action" type="button">Notify me</button>}
      />,
    );
    const card = screen.getByTestId('brokerage-block');
    expect(card).toBeInTheDocument();
    expect(screen.getByTestId('cs-glyph')).toBeInTheDocument();
    expect(screen.getByText('Connect a real brokerage')).toBeInTheDocument();
    expect(screen.getByText('Connect your real brokerage positions.')).toBeInTheDocument();
    expect(screen.getByText('coming soon')).toBeInTheDocument();
    expect(screen.getByTestId('cs-action')).toBeInTheDocument();
    // The card maps testId onto the underlying inert ComingSoonBox.
    expect(card).toHaveStyle({ borderStyle: 'dashed' });
  });

  it('adds NO navigation of its own — only the caller-supplied action can navigate (no-real-order-path)', () => {
    renderUi(
      <ComingSoonCard
        testId="scanner-block"
        icon={<LockIcon />}
        title="Scanner"
        body="Coming soon."
      />,
    );
    const card = screen.getByTestId('scanner-block');
    // With no action supplied the card has zero links/buttons of its own.
    expect(card.querySelector('a')).toBeNull();
    expect(card.querySelector('button')).toBeNull();
  });

  it('a non-navigating action (button) fires its handler in place and never links', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderUi(
      <ComingSoonCard
        testId="brokerage-block"
        icon={<LockIcon />}
        title="Connect a real brokerage"
        body="x"
        action={<Button data-testid="waitlist-button" onClick={onClick}>Notify me</Button>}
      />,
    );
    const btn = screen.getByTestId('waitlist-button');
    expect(btn.tagName.toLowerCase()).toBe('button');
    expect(btn).not.toHaveAttribute('href');
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('a link action routes where the caller points it (honest placeholder, not a built capability)', () => {
    renderUi(
      <ComingSoonCard
        testId="scanner-block"
        icon={<LockIcon />}
        title="Scanner"
        body="x"
        action={<Link to="/scanner" data-testid="scanner-cta">Preview the scanner →</Link>}
      />,
    );
    expect(screen.getByTestId('scanner-cta')).toHaveAttribute('href', '/scanner');
  });
});

describe('ConvexityMotif (F2 — the shared hero SVG)', () => {
  it('renders the two bezier paths', () => {
    const { container } = renderUi(<ConvexityMotif />);
    expect(screen.getByTestId('convexity-motif-svg')).toBeInTheDocument();
    const paths = container.querySelectorAll('[data-testid="convexity-motif-svg"] path');
    expect(paths.length).toBe(2);
    expect(paths[0].getAttribute('d')).toContain('M0 380 C 300 360, 600 240, 1200 30');
    expect(paths[1].getAttribute('d')).toContain('M0 400 C 360 390, 700 300, 1200 90');
  });
});
