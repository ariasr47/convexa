// Deterministic cold-start-failure capture: mock a 502 on the ticker bundle so the desk shows the
// failure alert (N7), screenshot at 1280 and 390 dark. Modeled on the review's own coldload.mjs.
import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const b = await chromium.launch();
for (const width of [1280, 390]) {
  const ctx = await b.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark', deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.route(/\/api\/ticker\//, (route) =>
    route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: 'down for maintenance' }) }),
  );
  await p.route(/\/api\/(stream|recommendation)\//, (route) => route.abort());
  await p.goto('http://localhost:4200/ticker/SPY', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[role="alert"]', { timeout: 60000 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/app/desk-cold-failure-${width}-dark.png`, fullPage: true });
  const h = await p.evaluate(() => {
    const alert = document.querySelector('[role="alert"]');
    const toolbar = document.querySelector('[data-testid="ticker-toolbar"]');
    return {
      alertText: alert?.textContent,
      toolbarPresent: !!toolbar,
      height: document.documentElement.scrollHeight,
    };
  });
  console.log(`app cold-failure ${width}:`, JSON.stringify(h));
  await ctx.close();
}
await b.close();
