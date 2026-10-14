/**
 * `/terms` — the long form of the footer's disclaimer: an analysis tool, not investment advice, no buy
 * or sell calls, simulated trades only, a read-only brokerage connection, data that can be late or
 * wrong, and the third-party terms the data comes with. Static: no request. The demo build adds an
 * "On this demo" box above the terms.
 *
 * The closing line is the shared DISCLAIMER_TEXT, imported, never retyped (design acceptance).
 *
 * Design: design/src/screens/final/trust.mjs (terms row), trust-pages.mjs (termsArticle). Copy is a
 * draft for the owner to review; not legal advice.
 */
import { DISCLAIMER_TEXT } from '@/shared/copy/disclaimer';
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { isDemoBuild } from '@/shared/lib/demoSite';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import { DocBox, DocPage, H2, Lead, linkSx, Para } from './DocPage';

const TOC = [
  ['what', 'What Convexa is'],
  ['advice', 'Not investment advice'],
  ['simulated', 'Simulated trades only'],
  ['broker', 'A connected brokerage'],
  ['data', 'Data can be late or wrong'],
  ['third', 'Third-party terms'],
  ['account', 'Your account'],
  ['liability', 'No warranty'],
  ['changes', 'Changes'],
] as const;

export const TERMS_UPDATED = 'Last updated Oct 14, 2026';

const internal = (to: string, text: string) => (
  <Link component={RouterLink} to={to} underline="always" sx={linkSx}>
    {text}
  </Link>
);

export function TermsPage() {
  const demo = isDemoBuild();
  return (
    <DocPage
      path="/terms"
      eyebrow="Terms"
      title="Terms and disclaimer"
      docTitle="Terms and disclaimer — Convexa"
      updated={TERMS_UPDATED}
      toc={TOC}
      testId="terms-page"
      lead={
        <Lead>
          Convexa is an analysis tool. It shows dealer positioning and public market data and
          explains how it reads them. It doesn’t tell you what to trade.
        </Lead>
      }
    >
      {demo && (
        <DocBox demo>
          <Box
            component="h3"
            sx={{
              m: 0,
              fontSize: 15,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <DataStateTag state="demo" />
            On this demo
          </Box>
          <Para sx={{ fontSize: 14 }}>
            Every figure here is sample data from an authored scenario dated October 7, 2026. None
            of it describes a real market, a real company or a real account. The terms below are the
            live site’s, and apply here too.
          </Para>
        </DocBox>
      )}

      <H2 id="what">What Convexa is</H2>
      <Para>
        Convexa reads options dealer positioning and public records — Treasury yields, futures
        positioning, short interest, SEC filings — and lays them out with their sources and dates.
        It publishes research notes, each with its price date and the date it should be reviewed by.
        Using the site means accepting these terms.
      </Para>

      <H2 id="advice">Not investment advice</H2>
      <Para>
        <strong>Nothing on Convexa is investment advice</strong>, and nothing on it is a
        recommendation to buy, sell or hold anything. Convexa makes no buy or sell calls. Structure
        is context for a plan, not a forecast of where a price will go.
      </Para>
      <Para>
        An AI read is written by a model you choose, with your own key, framed by your persona and
        the risk inputs you type. It can be wrong. It is advisory, and nothing happens with it
        unless you accept it into the simulated book. You make your own decisions, and you are
        responsible for them.
      </Para>

      <H2 id="simulated">Simulated trades only</H2>
      <Para>
        <strong>Positions and orders in the sim book are simulated (paper).</strong> No money moves.
        Fills are modelled at the option’s mid or a price you enter, with no slippage and no partial
        fills, so simulated profit and loss is hypothetical and will differ from what a real order
        would have done.
      </Para>

      <H2 id="broker">A connected brokerage is read-only</H2>
      <Para>
        If you save Webull keys in Settings, Convexa stores them encrypted; it doesn’t contact
        Webull yet.{' '}
        <strong>
          A connected brokerage is read-only — Convexa never places, changes, or cancels an order.
        </strong>{' '}
        It has no way to: the broker connection has no write path. Removing your keys deletes them
        from Convexa and changes nothing at Webull.
      </Para>

      <H2 id="data">Data can be late or wrong</H2>
      <Para>
        Every source publishes on its own schedule, some of them weeks late, and any of them can be
        down, revised or mistaken. Each card names its source and its date, and says so when data is
        late, stale or missing — never a made-up value. Figures Convexa computes are only as good as
        their inputs.{' '}
        {demo
          ? 'On this demo, every figure is sample data.'
          : 'On this site, nothing built from the options chain is live.'}{' '}
        {internal('/credits', 'Sources and credits')} lists every source and how late it is.
      </Para>

      <H2 id="third">Third-party terms</H2>
      <Para>Data and services from others come with their terms:</Para>
      <Box
        component="ul"
        sx={{
          m: 0,
          pl: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          fontSize: 15,
          lineHeight: 1.6,
          color: 'text.secondary',
          '& strong': { color: 'text.primary', fontWeight: 600 },
        }}
      >
        <li>
          <strong>FINRA</strong> owns and is the source of the short-interest and short-sale-volume
          data, including what Convexa calculates from it. Shown free for non-commercial personal
          use; please don’t redistribute it.
        </li>
        <li>
          <strong>TradingView</strong>’s chart is shown under TradingView’s terms, display only,
          with its attribution as published.
        </li>
        <li>
          <strong>Your AI provider</strong>’s terms apply to the key you bring and to what it
          writes.
        </li>
        <li>
          <strong>Webull</strong>’s terms apply to the keys you create there.
        </li>
        <li>
          <strong>The SEC, the Treasury and the CFTC</strong> publish public records; Convexa shows
          them as published, with their dates.
        </li>
      </Box>

      <H2 id="account">Your account</H2>
      <Para>
        Accounts are by invitation while Convexa is in private testing; sign-ups are closed. Keep
        your password to yourself. Access can end, and features can change or stop, during testing.
        What the account keeps is on the {internal('/privacy', 'Privacy page')}.
      </Para>

      <H2 id="liability">No warranty</H2>
      <Para>
        Convexa is provided as is, without warranty of any kind. To the extent the law allows,
        Convexa isn’t liable for any loss that comes from using it or from relying on anything it
        shows.
      </Para>

      <H2 id="changes">Changes</H2>
      <Para>When these terms change, the date above changes with them.</Para>

      <Para sx={{ fontSize: 13, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <span data-testid="terms-disclaimer">{DISCLAIMER_TEXT}</span>
      </Para>
    </DocPage>
  );
}

export default TermsPage;
