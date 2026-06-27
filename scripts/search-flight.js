// scripts/search-flight.js
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ─── PARAMÈTRES ──────────────────────────────────────
  const config = {
    origine:     'ALG',
    destination: 'CDG',
    dateAller:   '2026-08-15',
    dateRetour:  '2026-08-22',
    origineLabel:     'Alger+(ALG)',
    destinationLabel: 'Paris+(CDG)',
  };

  const url = `https://volz.app/en/flights` +
    `?trip_type=RT&max_connections=2&luggage_included=0&refundable=0&cabin=0` +
    `&adults=1&children=0&held_infants=0&seated_infants=0` +
    `&origin%5B0%5D=${config.origine}` +
    `&destination%5B0%5D=${config.destination}` +
    `&departure_date%5B0%5D=${config.dateAller}` +
    `&return_date%5B0%5D=${config.dateRetour}` +
    `&originMeta%5B0%5D=${config.origineLabel}` +
    `&destinationMeta%5B0%5D=${config.destinationLabel}` +
    `&length=1`;

  console.log(`⏳ Recherche ${config.origine} → ${config.destination}`);
  console.log(`📅 ${config.dateAller} → ${config.dateRetour}\n`);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);

  // ─── EXTRAIRE LES VOLS BRUTS ─────────────────────────
  const rawVols = await page.$$eval('*', els =>
    [...new Set(
      els
        .map(el => el.innerText?.trim())
        .filter(t =>
          t &&
          t.includes('DZD') &&
          t.includes('Book Now') &&
          t.includes('Outbound') &&
          t.length < 500
        )
    )]
  );

  // ─── PARSER CHAQUE VOL ───────────────────────────────
  const parseSegment = (lines) => {
    // lines: [date, heure_dep, ville, (IATA), nb_stops, duree, heure_arr, (+1d?), ville_arr, (IATA)]
    return {
      date:      lines[0] || '?',
      heure_dep: lines[1] || '?',
      origine:   lines[2] || '?',
      nb_stops:  lines[4] || '?',
      duree:     lines[5] || '?',
      heure_arr: lines[6] || '?',
    };
  };

  const vols = rawVols.map((raw, i) => {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    const prixLine  = lines.find(l => l.includes('DZD') && !l.includes('Book'));
    const seatsLine = lines.find(l => l.includes('Seats left'));
    const prix      = prixLine  ? prixLine.replace('DZD', '').trim() : '?';
    const places    = seatsLine ? seatsLine.replace('Seats left', '').trim() : '?';

    const outIdx = lines.indexOf('Outbound');
    const inIdx  = lines.indexOf('Inbound');

    const allerLines  = outIdx !== -1 && inIdx  !== -1 ? lines.slice(outIdx + 1, inIdx) : [];
    const retourLines = inIdx  !== -1               ? lines.slice(inIdx + 1)            : [];

    return {
      id:               i + 1,
      prix_dzd:         prix,
      places_restantes: parseInt(places) || 0,
      aller:            parseSegment(allerLines),
      retour:           parseSegment(retourLines),
    };
  });

  // ─── AFFICHAGE ───────────────────────────────────────
  console.log(`✅ ${vols.length} vols trouvés :\n`);
  console.log('─'.repeat(70));
  vols.forEach(v => {
    console.log(`Vol ${String(v.id).padStart(2)} │ ${v.prix_dzd.padStart(12)} DZD │ ${v.places_restantes} place(s)`);
    console.log(`         ALLER  : ${v.aller.date}  ${v.aller.heure_dep} → ${v.aller.heure_arr}  │ ${v.aller.nb_stops}  │ ${v.aller.duree}`);
    console.log(`         RETOUR : ${v.retour.date}  ${v.retour.heure_dep} → ${v.retour.heure_arr}  │ ${v.retour.nb_stops}  │ ${v.retour.duree}`);
    console.log('─'.repeat(70));
  });

  // ─── SAUVEGARDER JSON ────────────────────────────────
  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync('output/resultats.json', JSON.stringify(vols, null, 2));
  console.log('\n✅ JSON  → output/resultats.json');

  // ─── SAUVEGARDER CSV ─────────────────────────────────
  const header = 'id,prix_dzd,places,aller_date,aller_dep,aller_arr,aller_stops,aller_duree,retour_date,retour_dep,retour_arr,retour_stops,retour_duree';
  const rows = vols.map(v =>
    [
      v.id,
      `"${v.prix_dzd}"`,
      v.places_restantes,
      `"${v.aller.date}"`,
      v.aller.heure_dep,
      v.aller.heure_arr,
      `"${v.aller.nb_stops}"`,
      v.aller.duree,
      `"${v.retour.date}"`,
      v.retour.heure_dep,
      v.retour.heure_arr,
      `"${v.retour.nb_stops}"`,
      v.retour.duree,
    ].join(',')
  );
  fs.writeFileSync('output/resultats.csv', [header, ...rows].join('\n'));
  console.log('✅ CSV   → output/resultats.csv');

  await browser.close();
  console.log('\n🏁 Terminé !');
})();
