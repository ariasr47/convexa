/**
 * `/privacy` — what the site stores and where, what leaves the visitor's browser and to whom, what
 * Convexa doesn't do, and how to clear it. Static: no request.
 *
 * Every claim is read from the code (checked 2026-10-14), not from a template:
 * - storage keys: the shipped stores (localPrefs, firstPaintTheme, positions/store, orders/store,
 *   alerts/store, personas/store, recentTickers/store); `positions.v2` and `ghost-trade.v1` are only
 *   read, as migration sources, so they aren't listed. The demo adds four keys of its own
 *   (libs/api/src/lib/demo/transport.ts writeStored).
 * - the account: apps/api/src/services/auth/store.rs; sessions 7 days idle, 30 at most (service.rs,
 *   no override set on production). Google sign-in isn't configured on this site, so it isn't named.
 * - third parties: CSP connect-src 'self' plus TradingView's script and frames (public/_headers);
 *   AI providers are the four in llm_catalog.rs, reached only signed in with the user's own key.
 * - Webull: keys can be saved (encrypted), but no Webull client exists yet (broker/mod.rs), so
 *   nothing is sent to Webull.
 *
 * Design: design/src/screens/final/trust.mjs (privacy row), trust-pages.mjs (privacyArticle). Copy is
 * a draft for the owner to review; not legal advice.
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { isDemoBuild } from '@/shared/lib/demoSite';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { Link as RouterLink } from 'react-router-dom';
import { DocBox, DocPage, DocTable, H2, Lead, linkSx, Para } from './DocPage';

/** Who to ask about your data or to delete an account. The owner supplies it before /privacy is
 *  linked anywhere it matters (design acceptance: "Owner adds a contact address before it ships").
 *  null: the page says to ask the site's owner. */
export const PRIVACY_CONTACT: string | null = null;

export const PRIVACY_UPDATED = 'Last updated Oct 14, 2026';

const TOC = [
  ['short', 'The short version'],
  ['browser', 'In this browser'],
  ['account', 'If you have an account'],
  ['leaves', 'What leaves your browser'],
  ['never', 'What Convexa doesn’t do'],
  ['clear', 'How to clear it'],
  ['changes', 'Changes'],
] as const;

const KEYS: [string, string, string][] = [
  [
    'convexa.uiprefs.v1',
    'Your theme and default ticker, while you’re signed out.',
    'When you change either',
  ],
  [
    'convexa.theme-paint',
    'The theme to paint before the page loads, so it doesn’t flash.',
    'When the theme changes',
  ],
  [
    'convexa.positions.v3',
    'Your simulated (paper) positions and their history.',
    'When you add, change or close one',
  ],
  [
    'convexa.positions.touch_at',
    'When the simulated book last changed.',
    'With every change to the book',
  ],
  ['convexa.orders.v1', 'Your simulated orders.', 'When you place, change or cancel one'],
  ['convexa.alerts.v1', 'Your alerts.', 'When you add or remove one'],
  [
    'convexa.personas.v1',
    'The AI personas you made, and which one is active.',
    'When you edit a persona',
  ],
  [
    'convexa.recent-tickers.v1',
    'The last tickers you opened, for the ⌘K jump box.',
    'When you open a ticker',
  ],
];

const DEMO_KEYS: [string, string][] = [
  ['convexa.demo.auth.settings.v1', 'The demo account’s settings and risk inputs.'],
  ['convexa.demo.scan.view.v1', 'The demo scanner’s saved view.'],
  ['convexa.demo.book.v1', 'The demo book’s fills and marks.'],
  ['convexa.demo.workspace.initialized.v1', 'That the sample book has been set up.'],
];

const SERVER_ROWS: [string, string][] = [
  [
    'Your sign-in',
    'Your email address and display name. Your password as an argon2 hash — never the password itself. When the account was made and when you last signed in.',
  ],
  [
    'Your session',
    'A record of each signed-in session; the browser holds one session cookie, gf_session. A session ends after 7 days unused, and after 30 days at most.',
  ],
  [
    'Your settings',
    'Theme, default ticker, scanner view, active persona, and the AI provider and model you chose.',
  ],
  [
    'Your risk inputs',
    'The account size and per-trade cap you type. Stored with your account, never in this browser; sent to your AI provider with each read you ask for.',
  ],
  [
    'Your simulated book',
    'A copy of your paper positions, orders and decision notes, so they follow you between devices. The copy with the newest timestamp wins, and this browser keeps its own copy too.',
  ],
  [
    'Your AI key',
    'Encrypted (AES-256-GCM). Only its last four characters are ever shown back; the key itself never returns to the browser.',
  ],
  [
    'Your Webull keys',
    'Only if you save them. Encrypted the same way; only the app key’s last four characters are shown back. Convexa doesn’t contact Webull yet, so they aren’t sent anywhere.',
  ],
];

const NEVER = [
  'No analytics, ads or tracking pixels',
  'No third-party cookies set by Convexa',
  'No font or script services beyond TradingView’s chart',
  'Doesn’t sell what it keeps, or share it beyond what this page lists',
  'Never places, changes or cancels a broker order',
  'Never sends your AI key back to your browser',
];

const internal = (to: string, text: string) => (
  <Link component={RouterLink} to={to} underline="always" sx={linkSx}>
    {text}
  </Link>
);

export function PrivacyPage() {
  const demo = isDemoBuild();
  const toc = demo
    ? TOC.map(([id, t]) => [id, id === 'account' ? 'The demo account' : t] as const)
    : TOC;
  const ask = PRIVACY_CONTACT ? (
    <>
      write to{' '}
      <Box component="span" sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '0.92em' }}>
        {PRIVACY_CONTACT}
      </Box>
    </>
  ) : (
    'ask the site’s owner'
  );

  return (
    <DocPage
      path="/privacy"
      eyebrow="Privacy"
      title="Privacy"
      docTitle="Privacy — Convexa"
      updated={PRIVACY_UPDATED}
      toc={toc}
      testId="privacy-page"
    >
      <H2 id="short">The short version</H2>
      {demo ? (
        <Lead>
          <strong>This is the demo. Nothing you do here leaves this browser.</strong> The demo has
          no server account, calls no server and loads no third party. What you change is kept in
          this browser under the convexa.demo.v1. prefix until you reset it.
        </Lead>
      ) : (
        <Lead>
          Convexa runs no ads, no analytics and no tracking scripts. If you don’t sign in, what you
          do here stays in this browser. A few things do leave it, and this page names each one.
        </Lead>
      )}

      <H2 id="browser">In this browser</H2>
      {demo ? (
        <>
          <Para>
            The demo keeps the same things the live site keeps, each under the{' '}
            <strong>convexa.demo.v1.</strong> prefix, so it never touches a live site’s data in the
            same browser. It adds four of its own: the demo account’s settings, its scanner view,
            its book’s fills, and a marker that says the sample book has been set up.
          </Para>
          <DocTable
            monoFirst
            head={['Key (after the prefix)', 'What it holds']}
            rows={[
              ...KEYS.map(([k, w]) => [
                k,
                k === 'convexa.uiprefs.v1' ? 'The demo account’s theme and default ticker.' : w,
              ]),
              ...DEMO_KEYS,
            ]}
          />
        </>
      ) : (
        <>
          <Para>
            These live in your browser’s local storage for this site. Nothing reads them but this
            site’s own pages, and none of them is sent anywhere unless you sign in (see below).
            Signed in, your settings come from your account instead.
          </Para>
          <DocTable monoFirst head={['Key', 'What it holds', 'Written']} rows={KEYS} />
          <Para>
            Exporting your positions saves a file, convexa-archive-<em>date</em>.json, to your own
            device. Convexa keeps no copy of it.
          </Para>
        </>
      )}

      <H2 id="account">{demo ? 'The demo account' : 'If you have an account'}</H2>
      {demo ? (
        <Para>
          The demo is always signed in to one shared demo account, and that account lives in this
          browser, not on a server. There’s no sign-out; <strong>Reset demo data</strong> in the bar
          puts it back as it started.
        </Para>
      ) : (
        <>
          <Para>
            Accounts are by invitation while Convexa is in private testing; sign-ups are closed. If
            you have one, Convexa’s server keeps the following, and nothing else about you:
          </Para>
          <DocTable head={['What', 'What’s kept']} rows={SERVER_ROWS} />
        </>
      )}

      <H2 id="leaves">What leaves your browser</H2>
      {demo ? (
        <Para>
          Nothing. The demo makes no request to Convexa’s API or to any third party: its prices,
          filings and AI reads are all sample data built into the page. The Technical tab draws
          sample bars instead of loading TradingView.
        </Para>
      ) : (
        <>
          <Para>
            Your browser talks to two places: this site and, on two views, TradingView. Everything
            else is fetched by Convexa’s server, which never passes on who you are.
          </Para>
          <DocTable
            head={['Who', 'When', 'What they get']}
            rows={[
              [
                'Convexa’s hosts',
                'Every visit',
                'The site is served by Cloudflare Pages and its API runs on Railway. Like any host, they see your IP address with each request.',
              ],
              [
                'TradingView',
                'When you open the Technical tab or the desk’s price panel',
                'Its chart loads a script and a frame from TradingView, which receives your IP address and the page’s address.',
              ],
              [
                'Your AI provider',
                'Only signed in, with your own key saved, when you ask for a read',
                'Convexa’s server sends the ticker’s computed market state and signals, the candidate contracts, your risk inputs, a summary of your open positions in that ticker with your book’s count and capital at risk, and the persona’s name. “View what’s sent” on any ticker shows the export. The provider is the one you chose — Anthropic, OpenAI, xAI or Google Gemini — and its own privacy terms apply.',
              ],
              [
                'Treasury, CFTC, FINRA, SEC',
                'Never from your browser',
                'Convexa’s server fetches public data once for every reader. These sources learn nothing about you.',
              ],
            ]}
          />
        </>
      )}

      <H2 id="never">What Convexa doesn’t do</H2>
      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: '10px 20px',
        }}
      >
        {NEVER.map((t) => (
          <Box
            component="li"
            key={t}
            sx={{
              display: 'grid',
              gridTemplateColumns: '18px minmax(0, 1fr)',
              gap: 1,
              fontSize: 14.5,
              lineHeight: 1.5,
            }}
          >
            <CheckOutlined aria-hidden sx={{ fontSize: 16, mt: '3px', color: 'text.secondary' }} />
            <span>{t}</span>
          </Box>
        ))}
      </Box>

      <H2 id="clear">How to clear it</H2>
      {demo ? (
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
            Reset demo data
          </Box>
          <Para sx={{ fontSize: 14 }}>
            The button in the demo bar removes every key under convexa.demo.v1. and sets the sample
            book up again. Nothing else in your browser is touched.
          </Para>
        </DocBox>
      ) : (
        <>
          <DocBox>
            <Box component="h3" sx={{ m: 0, fontSize: 15 }}>
              Signed out
            </Box>
            <Para sx={{ fontSize: 14 }}>
              Clear this site’s data in your browser (site settings → clear data). That removes
              every key above. Export your positions first if you want to keep them.
            </Para>
          </DocBox>
          <DocBox>
            <Box component="h3" sx={{ m: 0, fontSize: 15 }}>
              Signed in
            </Box>
            <Para sx={{ fontSize: 14 }}>
              Signing out ends the session. In Settings you can remove your AI key and your Webull
              keys, which deletes them from the server. To delete the account itself, {ask}; there
              is no delete button yet.
            </Para>
          </DocBox>
        </>
      )}

      <H2 id="changes">Changes</H2>
      <Para>
        When this page changes, its date above changes with it. Where your data goes and who can see
        it are listed per source on {internal('/credits', 'Sources and credits')}.
      </Para>
    </DocPage>
  );
}

export default PrivacyPage;
