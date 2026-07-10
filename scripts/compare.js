// scripts/compare.js
const fs = require('fs');

const key = (v) => `${v.origin}-${v.destination}-${v.tripType}-${v.adults}-${v.departDate}`;

(async () => {
  const volz = fs.existsSync('output/volz/flights.json')
    ? JSON.parse(fs.readFileSync('output/volz/flights.json', 'utf8')) : [];
  const h24 = fs.existsSync('output/h24voyages/flights.json')
    ? JSON.parse(fs.readFileSync('output/h24voyages/flights.json', 'utf8')) : [];

  const tous = [...volz, ...h24];
  const groupes = {};

  tous.forEach(v => {
    const k = key(v);
    if (!groupes[k]) groupes[k] = [];
    groupes[k].push(v);
  });

  const comparaisons = Object.entries(groupes).map(([k, vols]) => {
    const parSite = {};
    vols.forEach(v => {
      if (!parSite[v.site] || v.price < parSite[v.site].price) {
        parSite[v.site] = v;
      }
    });

    const sites = Object.values(parSite);
    const moinsCher = sites.reduce((min, s) => s.price < min.price ? s : min, sites[0]);
    const plusCher  = sites.reduce((max, s) => s.price > max.price ? s : max, sites[0]);
    const economie  = sites.length > 1 ? plusCher.price - moinsCher.price : 0;

    return {
      route: `${vols[0].origin} → ${vols[0].destination}`,
      origin: vols[0].origin,
      originName: vols[0].originName,
      destination: vols[0].destination,
      destinationName: vols[0].destinationName,
      tripType: vols[0].tripType,
      adults: vols[0].adults,
      departDate: vols[0].departDate,
      prix: {
        volz: parSite.volz?.price || null,
        h24voyages: parSite.h24voyages?.price || null,
      },
      moinsCher: {
        site: moinsCher.site,
        prix: moinsCher.price,
        airline: moinsCher.airline,
        departDate: moinsCher.departDate,
      },
      economie,
      nbSitesDisponibles: sites.length,
    };
  }).sort((a, b) => (b.economie || 0) - (a.economie || 0));

  fs.writeFileSync('output/comparison.json', JSON.stringify(comparaisons, null, 2));
  console.log(`✅ ${comparaisons.length} routes comparées → output/comparison.json`);
  console.log(`   ${comparaisons.filter(c => c.nbSitesDisponibles > 1).length} routes disponibles sur les 2 sites`);
})();
