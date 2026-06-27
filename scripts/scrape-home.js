// scrape-volz.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // false = tu vois le navigateur
  const page = await browser.newPage();

  await page.goto('https://volz.app', { waitUntil: 'networkidle' });

  // Screenshot pour voir la structure
  await page.screenshot({ path: 'volz-home.png', fullPage: true });

  // Extraire le titre
  const title = await page.title();
  console.log('Titre :', title);

  // Extraire tous les textes visibles des liens
  const links = await page.$$eval('a', els =>
    els.map(el => ({ text: el.innerText.trim(), href: el.href })).filter(l => l.text)
  );
  console.log('Liens :', links);

  await browser.close();
})();
