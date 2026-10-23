// Deterministische frame-render via de ?render=1 seek-API van de pagina.
// Eén Chrome-instantie; per frame: seek(t) + screenshot.
// Gebruik: node render-social.cjs [url] [seconds] [fps] [outDir]
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:61052/fix50-social.html?render=1';
  const seconds = parseFloat(process.argv[3] || '19.4');
  const fps = parseInt(process.argv[4] || '30', 10);
  const outDir = process.argv[5] || 'out/social-frames';

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const total = Math.ceil(seconds * fps);
  console.log(`render ${total} frames @ ${fps} fps …`);
  const t0 = Date.now();

  for (let i = 0; i < total; i++) {
    const t = i / fps;
    await page.evaluate((tt) => window.seek(tt), t);
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(outDir, `${String(i).padStart(5, '0')}.png`), Buffer.from(buf, 'base64'));
    if (i % 90 === 0) {
      const dt = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  frame ${i}/${total} (${dt}s)`);
    }
  }

  await browser.close();
  console.log(`done: ${total} frames in ${outDir}`);
})().catch((e) => { console.error(e); process.exit(1); });
