const fs = require('fs');

const NOMS_VILLES = {
  ALG: 'Alger', ORN: 'Oran', CZL: 'Constantine', TUN: 'Tunis', CMN: 'Casablanca',
  CDG: 'Paris', IST: 'Istanbul', DXB: 'Dubai', BCN: 'Barcelone', LHR: 'Londres',
  AYT: 'Antalya', CAI: 'Le Caire', SSH: 'Sharm El Sheikh', MAD: 'Madrid',
};

(async () => {
  const raw = JSON.parse(fs.readFileSync('output/tous-les-vols.json', 'utf8'));

  const unifie = raw.map(v => ({
    site: 'volz',
    origin: v.origine,
    originName: NOMS_VILLES[v.origine] || v.origine,
    destination: v.destination,
    destinationName: NOMS_VILLES[v.destination] || v.destination,
    tripType: v.type,
    cabinClass: v.cabinClass || 'ECONOMY',
    passengers: v.passengers || { adults: 1, children: 0, infants: 0 },
    departDate: v.date_aller,
    returnDate: v.date_retour,
    price: v.prix_num,
    currency: 'DZD',
    airline: null,
    scraped_at: v.scraped_at,
  }));

  fs.mkdirSync('output/volz', { recursive: true });
  fs.writeFileSync('output/volz/flights.json', JSON.stringify(unifie, null, 2));
  console.log(`✅ ${unifie.length} vols convertis vers output/volz/flights.json`);
})();
