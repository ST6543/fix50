// Record FIX50 walkthrough at real framerate via Playwright screencast.
const { chromium } = require('playwright-core');

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:61052/fix50-walkthrough.html';
  const secs = parseInt(process.argv[3] || '70', 10);
  const out = process.argv[4] || 'out/pw-capture.webm';

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 720, height: 1280 },
    recordVideo: { dir: 'out/_pwvid', size: { width: 720, height: 1280 } },
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  // Hoog Contrast: forceer actieve rendering
  await page.evaluate(() => { document.hidden && 0; });
  console.log('recording', secs, 's ...');
  await page.waitForTimeout(secs * 1000);
  await ctx.close(); // sluit -> video wordt geflushed
  await browser.close();
  console.log('done:', out);
})().catch((e) => { console.error(e); process.exit(1); });
