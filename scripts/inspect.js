// inspect-volz.js — dump tout le HTML pour analyser
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://volz.app', { waitUntil: 'networkidle' });

  const html = await page.content();
  fs.writeFileSync('volz-page.html', html);
  console.log('HTML sauvegardé dans volz-page.html');

  await browser.close();
})();
