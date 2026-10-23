/** Render feature-graphic.html naar een exacte 1024×500 PNG via Playwright. */
const path = require('path');
const { chromium } = require('playwright-core');

(async () => {
  const src = 'file://' + path.resolve(__dirname, 'feature-graphic.html').replace(/\\/g, '/');
  const out = path.resolve(__dirname, 'out', 'feature-graphic.png');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await page.goto(src, { waitUntil: 'networkidle' });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1024, height: 500 } });
  await browser.close();
  console.log('OK:', out);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
