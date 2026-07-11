// scripts/scrape-all.js
const { chromium } = require('playwright');
const { execSync }  = require('child_process');
const fs            = require('fs');

const delay = ms => new Promise(r => setTimeout(r, ms));
const AUJOURD_HUI = new Date().toISOString().split('T')[0];

const CONFIG = {
  origines: [
    { code: 'ALG', nom: 'Alger' },
  ],
  destinations: [
    { code: 'CDG', nom: 'Paris'           },
    { code: 'IST', nom: 'Istanbul'        },
    { code: 'AYT', nom: 'Antalya'         },
    { code: 'CAI', nom: 'Le Caire'        },
    { code: 'SSH', nom: 'Sharm El Sheikh' },
    { code: 'DXB', nom: 'Dubai'           },
    { code: 'BCN', nom: 'Barcelone'       },
    { code: 'MAD', nom: 'Madrid'          },
    { code: 'TUN', nom: 'Tunis'           },
  ],
  dates: [AUJOURD_HUI],
  types: ['RT'],
  // Classes : code volz + libellé canonique partagé avec h24voyages
  cabines: [
    { code: 0, canonical: 'ECONOMY' },
    { code: 1, canonical: 'PREMIUM_ECONOMY' },
    { code: 2, canonical: 'BUSINESS' },
    { code: 3, canonical: 'FIRST' },
  ],
  // Combinaisons de passagers (mêmes que h24voyages)
  passagers: [
    { adults: 1, children: 0, infants: 0, label: '1 adulte' },
    { adults: 2, children: 0, infants: 0, label: '2 adultes' },
    { adults: 1, children: 1, infants: 0, label: '1 adulte + 1 enfant' },
    { adults: 1, children: 0, infants: 1, label: '1 adulte + 1 bébé' },
  ],
  delaiEntreRequetes: 2500,
};

const buildUrl = ({ origine, destination, dateAller, dateRetour, pax, type, cabine }) =>
  'https://volz.app/en/flights' +
  `?trip_type=${type}&max_connections=2&luggage_included=0&refundable=0&cabin=${cabine.code}` +
  `&adults=${pax.adults}&children=${pax.children}&held_infants=${pax.infants}&seated_infants=0` +
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
    type: combo.type,
    cabinClass: combo.cabine.canonical,
    passengers: { adults: combo.pax.adults, children: combo.pax.children, infants: combo.pax.infants },
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

  const tousLesVols = [];
  let numRecherche = 0;
  const totalRecherches = CONFIG.origines.length * CONFIG.destinations.length * CONFIG.dates.length
    * CONFIG.types.length * CONFIG.cabines.length * CONFIG.passagers.length;
  let erreurs = 0;

  console.log(`🚀 ${totalRecherches} recherches | ${dateAujourd}`);

  for (const origine of CONFIG.origines) {
    for (const destination of CONFIG.destinations) {
      if (origine.code === destination.code) continue;
      for (const dateAller of CONFIG.dates) {
        for (const type of CONFIG.types) {
          for (const cabine of CONFIG.cabines) {
            for (const pax of CONFIG.passagers) {
              numRecherche++;
              const dateRetour = type === 'RT'
                ? new Date(new Date(dateAller).getTime() + 10*86400000).toISOString().split('T')[0] : '';
              const combo = { origine, destination, dateAller, dateRetour, pax, type, cabine };
              process.stdout.write(`[${numRecherche}/${totalRecherches}] ${origine.code}→${destination.code} ${cabine.canonical} ${pax.label} ... `);
              try {
                await page.goto(buildUrl(combo), { waitUntil: 'networkidle', timeout: 30000 });
                await delay(3500);
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
  }
  await browser.close();

  const duree = Math.round((Date.now() - startTime) / 1000);
  fs.writeFileSync('output/rapport.json', JSON.stringify({ date: dateAujourd, duree_secondes: duree, nb_recherches: numRecherche, nb_vols: tousLesVols.length, nb_erreurs: erreurs }, null, 2));
  fs.appendFileSync('logs/cron.log', `[${new Date().toISOString()}] ${tousLesVols.length} vols | ${erreurs} erreurs | ${duree}s\n`);

  console.log(`\n✅ ${tousLesVols.length} vols | ⏱ ${duree}s | ❌ ${erreurs} erreurs`);

  try {
    console.log('\n📤 Push GitHub...');
    execSync(`git add output/ && git commit -m "scraping ${dateAujourd} - ${tousLesVols.length} vols" && git push`, { stdio: 'inherit' });
    console.log('✅ Push réussi');
  } catch (e) {
    console.log('⚠️ Push échoué :', e.message);
  }
  console.log('\n🏁 Terminé !');
})();
