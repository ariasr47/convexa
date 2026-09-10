// Deterministic cold-load capture: hold the ticker bundle + stream so the desk stays on its
// cold skeleton, then screenshot at 1280 dark. Design side: the desk-states page's first frame.
import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark', deviceScaleFactor: 1, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.route(/\/api\/(ticker|stream|recommendation)\//, () => { /* never fulfil: stay cold */ });
await p.goto('http://localhost:4200/ticker/SPY', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('[data-testid="cold-load"]', { timeout: 60000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/app/desk-cold-load-1280-dark.png`, fullPage: true });
const h = await p.evaluate(() => ({ cold: !!document.querySelector('[data-testid="cold-load"]'), tiles: document.querySelectorAll('[data-testid="cold-load"] .MuiSkeleton-root').length, height: document.documentElement.scrollHeight }));
console.log('app cold-load:', JSON.stringify(h));
const d = await ctx.newPage();
await d.goto('http://localhost:4310/desk-states.html');
await d.addStyleTag({ content: '.site-bar{display:none !important}' });
await d.waitForTimeout(800);
await d.screenshot({ path: `${OUT}/design/desk-states-1280-dark.png`, fullPage: true });
console.log('design desk-states height:', await d.evaluate(() => document.documentElement.scrollHeight));
await b.close();
