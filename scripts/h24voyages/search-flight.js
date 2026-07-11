const { chromium } = require('playwright');

async function searchH24(origin, originName, destIata, destName, departDate, returnDate, classeCode, passengers, attempt = 1) {
  const query = {
    tripType: "Round Trip",
    passengerDrop: {
      adults: passengers.adults,
      young: 0,
      seniors: 0,
      child: passengers.children,
      infants: passengers.infants
    },
    classe: classeCode, // 'economy' | 'premium_economy' | 'business' | 'first_class'
    depart1: originName,
    depart1iata: {
      airport_name: originName,
      country: "Algérie",
      city_name: "Alger",
      iata_code: origin,
      country_code: "Algérie"
    },
    destination1: destName,
    destination1iata: {
      airport_name: destName,
      country: "",
      city_name: destName,
      iata_code: destIata,
      country_code: ""
    },
    stops: false,
    baggage: false,
    refundable: false,
    datePickerRange1: [`${departDate}T10:00:00.000Z`, `${returnDate}T10:00:00.000Z`]
  };

  const url = `https://vols.h24voyages.com/flights/results?${encodeURIComponent(JSON.stringify(query))}=`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const responsePromise = page.waitForResponse(
      res => res.url().includes('/flights/flights/search') && res.status() === 201,
      { timeout: 20000 }
    );

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const response = await responsePromise;
    const apiResult = await response.json();

    await browser.close();
    return apiResult;

  } catch (e) {
    await browser.close();
    if (attempt < 2) {
      console.log(`    ↻ Retry (tentative ${attempt + 1})...`);
      return searchH24(origin, originName, destIata, destName, departDate, returnDate, classeCode, passengers, attempt + 1);
    }
    throw e;
  }
}

module.exports = { searchH24 };
