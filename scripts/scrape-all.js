// scripts/scrape-all.js
const { chromium } = require('playwright');
const { execSync }  = require('child_process');
const fs            = require('fs');

const delay = ms => new Promise(r => setTimeout(r, ms));

const CONFIG = {
  origines: [
    { code: 'ALG', nom: 'Alger'       },
    { code: 'ORN', nom: 'Oran'        },
    { code: 'CZL', nom: 'Constantine' },
    { code: 'TUN', nom: 'Tunis'       },
    { code: 'CMN', nom: 'Casablanca'  },
  ],
  destinations: [
    { code: 'CDG', nom: 'Paris'     },
    { code: 'IST', nom: 'Istanbul'  },
    { code: 'DXB', nom: 'Dubai'     },
    { code: 'BCN', nom: 'Barcelone' },
    { code: 'LHR', nom: 'Londres'   },
  ],
  dates: ['2026-08-01','2026-08-15','2026-09-01','2026-09-15'],
  types:   ['OW', 'RT'],
  adultes: [1, 2],
  delaiEntreRequetes: 3000,
};

const buildUrl = ({ origine, destination, dateAller, dateRetour, adultes, type }) =>
  'https://volz.app/en/flights' +
  `?trip_type=${type}&max_connections=2&luggage_included=0&refundable=0&cabin=0` +
  `&adults=${adultes}&children=0&held_infants=0&seated_infants=0` +
  `&origin%5B0%5D=${origine.code}&destination%5B0%5D=${destination.code}` +
  `&departure_date%5B0%5D=${dateAller}&return_date%5B0%5D=${type === 'RT' ? dateRetour : ''}` +
  `&originMeta%5B0%5D=${origine.nom}+%28${origine.code}%29` +
  `&destinationMeta%5B0%5D=${destination.nom}+%28${destination.code}%29&length=1`;

const parseVol = (raw, combo) => {
  const lines     = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const prixLine  = lines.find(l => l.includes('DZD') && !l.includes('Book'));
  const seatsLine = lines.find(l => l.includes('Seats left'));
  const outIdx    = lines.indexOf('Outbound');
  const inIdx     = lines.indexOf('Inbound');
  const allerLines  = outIdx !== -1 ? lines.slice(outIdx + 1, inIdx !== -1 ? inIdx : undefined) : [];
  const retourLines = inIdx  !== -1 ? lines.slice(inIdx + 1) : [];
  const seg = (l) => ({ heure_dep: l[1]||'?', nb_stops: l[4]||'?', duree: l[5]||'?', heure_arr: l[6]||'?' });
  const prixStr = prixLine ? prixLine.replace('DZD','').trim() : '0';
  const prixNum = parseFloat(prixStr.replace(/\s/g,'').replace(',','.')) || 0;
  return {
    origine: combo.origine.code, destination: combo.destination.code,
    type: combo.type, adultes: combo.adultes,
    date_aller: combo.dateAller, date_retour: combo.dateRetour || null,
    prix_dzd: prixStr, prix_num: prixNum,
    places: seatsLine ? parseInt(seatsLine) || 0 : 0,
    aller: seg(allerLines),
    retour: combo.type === 'RT' ? seg(retourLines) : null,
    scraped_at: new Date().toISOString(),
  };
};

(async () => {
  const startTime   = Date.now();
  const dateAujourd = new Date().toISOString().split('T')[0];
  const browser     = await chromium.launch({ headless: true });
  const page        = await browser.newPage();

  fs.mkdirSync('output', { recursive: true });
  fs.mkdirSync('logs',   { recursive: true });

  const tousLesVols    = [];
  const historiqueFile = 'output/historique.json';
  let historique       = [];
  if (fs.existsSync(historiqueFile)) {
    try { historique = JSON.parse(fs.readFileSync(historiqueFile,'utf8')); } catch { historique = []; }
  }

  let numRecherche = 0, totalRecherches = 0, erreurs = 0;
  for (const o of CONFIG.origines)
    for (const d of CONFIG.destinations)
      if (o.code !== d.code)
        for (const dt of CONFIG.dates)
          for (const type of CONFIG.types)
            for (const adultes of CONFIG.adultes)
              totalRecherches++;

  console.log(`🚀 ${totalRecherches} recherches | ${dateAujourd}`);

  for (const origine of CONFIG.origines) {
    for (const destination of CONFIG.destinations) {
      if (origine.code === destination.code) continue;
      for (const dateAller of CONFIG.dates) {
        for (const type of CONFIG.types) {
          for (const adultes of CONFIG.adultes) {
            numRecherche++;
            const dateRetour = type === 'RT'
              ? new Date(new Date(dateAller).getTime() + 7*86400000).toISOString().split('T')[0] : '';
            const combo = { origine, destination, dateAller, dateRetour, adultes, type };
            process.stdout.write(`[${numRecherche}/${totalRecherches}] ${origine.code}→${destination.code} ${dateAller} ${type} ${adultes}pax ... `);
            try {
              await page.goto(buildUrl(combo), { waitUntil: 'networkidle', timeout: 30000 });
              await delay(4000);
              const rawVols = await page.$$eval('*', els =>
                [...new Set(els.map(el=>el.innerText?.trim())
                  .filter(t=>t&&t.includes('DZD')&&t.includes('Book Now')&&t.includes('Outbound')&&t.length<500))]
              );
              const vols = rawVols.map(raw => parseVol(raw, combo));
              tousLesVols.push(...vols);
              process.stdout.write(`✅ ${vols.length} vols\n`);
              fs.writeFileSync('output/tous-les-vols.json', JSON.stringify(tousLesVols, null, 2));
            } catch (err) {
              erreurs++;
              process.stdout.write(`❌ ${err.message.split('\n')[0]}\n`);
            }
            await delay(CONFIG.delaiEntreRequetes);
          }
        }
      }
    }
  }
  await browser.close();

  // Détecter les changements de prix
  const changements = [];
  if (historique.length > 0) {
    const ancienVols = historique[historique.length-1].vols || [];
    tousLesVols.forEach(volActuel => {
      const key = `${volActuel.origine}-${volActuel.destination}-${volActuel.date_aller}-${volActuel.type}-${volActuel.adultes}`;
      const ancienVol = ancienVols.find(v =>
        `${v.origine}-${v.destination}-${v.date_aller}-${v.type}-${v.adultes}` === key &&
        v.aller?.heure_dep === volActuel.aller?.heure_dep
      );
      if (ancienVol && ancienVol.prix_num !== volActuel.prix_num) {
        changements.push({
          route: `${volActuel.origine} → ${volActuel.destination}`,
          date: volActuel.date_aller,
          ancien_prix: ancienVol.prix_num,
          nouveau_prix: volActuel.prix_num,
          difference: volActuel.prix_num - ancienVol.prix_num,
          direction: volActuel.prix_num > ancienVol.prix_num ? '📈 hausse' : '📉 baisse',
        });
      }
    });
  }

  historique.push({ date: dateAujourd, scraped_at: new Date().toISOString(), nb_vols: tousLesVols.length, nb_erreurs: erreurs, vols: tousLesVols, changements });
  fs.writeFileSync(historiqueFile, JSON.stringify(historique, null, 2));

  const duree = Math.round((Date.now() - startTime) / 1000);
  fs.writeFileSync('output/rapport.json', JSON.stringify({ date: dateAujourd, duree_secondes: duree, nb_recherches: numRecherche, nb_vols: tousLesVols.length, nb_erreurs: erreurs, changements_prix: changements }, null, 2));
  fs.appendFileSync('logs/cron.log', `[${new Date().toISOString()}] ${tousLesVols.length} vols | ${erreurs} erreurs | ${duree}s\n`);

  console.log(`\n✅ ${tousLesVols.length} vols | ⏱ ${duree}s | ❌ ${erreurs} erreurs`);
  if (changements.length > 0) {
    console.log(`\n💰 ${changements.length} changements de prix :`);
    changements.forEach(c => console.log(`  ${c.direction} ${c.route} ${c.date} : ${c.ancien_prix} → ${c.nouveau_prix} DZD`));
  }

  // Auto push GitHub
  try {
    console.log('\n📤 Push GitHub...');
    execSync(`git add output/ && git commit -m "scraping ${dateAujourd} - ${tousLesVols.length} vols" && git push`, { stdio: 'inherit' });
    console.log('✅ Push réussi');
  } catch (e) {
    console.log('⚠️ Push échoué :', e.message);
  }
  console.log('\n🏁 Terminé !');
})();
