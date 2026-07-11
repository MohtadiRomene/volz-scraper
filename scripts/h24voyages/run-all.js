const { searchH24 } = require('./search-flight');
const fs = require('fs');

const destinations = [
  { iata: 'CDG', name: 'Paris - Tous les aéroports', shortName: 'Paris' },
  { iata: 'IST', name: 'Istanbul - Tous les aéroports', shortName: 'Istanbul' },
  { iata: 'AYT', name: 'Antalya - Tous les aéroports', shortName: 'Antalya' },
  { iata: 'CAI', name: 'Le Caire', shortName: 'Le Caire' },
  { iata: 'SSH', name: 'Sharm El Sheikh', shortName: 'Sharm El Sheikh' },
  { iata: 'DXB', name: 'Dubai', shortName: 'Dubai' },
  { iata: 'BCN', name: 'Barcelone', shortName: 'Barcelone' },
  { iata: 'MAD', name: 'Madrid - Tous les aéroports', shortName: 'Madrid' },
  { iata: 'TUN', name: 'Tunis', shortName: 'Tunis' },
];

const CABIN_CLASSES = [
  { code: 'economy',         canonical: 'ECONOMY' },
  { code: 'premium_economy', canonical: 'PREMIUM_ECONOMY' },
  { code: 'business',        canonical: 'BUSINESS' },
  { code: 'first_class',     canonical: 'FIRST' },
];

const PASSENGER_COMBOS = [
  { adults: 1, children: 0, infants: 0, label: '1 adulte' },
  { adults: 2, children: 0, infants: 0, label: '2 adultes' },
  { adults: 1, children: 1, infants: 0, label: '1 adulte + 1 enfant' },
  { adults: 1, children: 0, infants: 1, label: '1 adulte + 1 bébé' },
];

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

(async () => {
  const today = addDays(new Date(), 0);
  const returnDate = addDays(new Date(), 10);
  const results = [];
  let count = 0;
  const total = destinations.length * CABIN_CLASSES.length * PASSENGER_COMBOS.length;

  for (const dest of destinations) {
    for (const cabin of CABIN_CLASSES) {
      for (const pax of PASSENGER_COMBOS) {
        count++;
        console.log(`🔍 [${count}/${total}] ALG → ${dest.shortName} | ${cabin.canonical} | ${pax.label}...`);
        try {
          const data = await searchH24('ALG', 'Aéroport Houari Boumediene Alger', dest.iata, dest.name, today, returnDate, cabin.code, pax);
          if (data?.data?.offers?.length) {
            const cheapest = data.data.offers.reduce((min, o) =>
              o.fare.totalFare < min.fare.totalFare ? o : min
            );
            results.push({
              site: 'h24voyages',
              origin: 'ALG',
              originName: 'Alger',
              destination: dest.iata,
              destinationName: dest.shortName,
              tripType: 'RT',
              cabinClass: cabin.canonical,
              passengers: { adults: pax.adults, children: pax.children, infants: pax.infants },
              departDate: today,
              returnDate: returnDate,
              price: cheapest.fare.totalFare,
              currency: cheapest.fare.currencyCode,
              airline: cheapest.fare.platingAirlineDetails.Name,
              scraped_at: new Date().toISOString()
            });
            console.log(`  ✅ ${cheapest.fare.totalFare} ${cheapest.fare.currencyCode}`);
          } else {
            console.log(`  ⚠️ Aucune offre trouvée`);
          }
        } catch (e) {
          console.log(`  ❌ Erreur:`, e.message);
        }
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  fs.mkdirSync('output/h24voyages', { recursive: true });
  fs.writeFileSync('output/h24voyages/flights.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ ${results.length}/${total} résultats sauvegardés dans output/h24voyages/flights.json`);
})();
