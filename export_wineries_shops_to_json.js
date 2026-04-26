// Export wineries and wine shops data from BOTH sources:
// - OpenStreetMap (Overpass API)
// - Google Places API
// into separate JSON files, without touching the database.
//
// Usage (from project root):
//   1) Ensure you ran:
//        npm install axios dotenv
//   2) In .env (at project root) have:
//        GOOGLE_PLACES_KEY=your_google_places_api_key_here
//   3) Run:
//        node export_wineries_shops_to_json.js
//
// Output files (in project root):
//   - osm_wineries.json
//   - osm_wine_shops.json
//   - google_wineries.json
//   - google_wine_shops.json
//
// Note: These contain raw-ish API data; structure does NOT have to match DB tables.

require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

// ---------- Overpass (OpenStreetMap) ----------
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const overpassQuery = `
[out:json][timeout:60];
(
  area["name:en"="Israel"]->.israel;
  area["name:en"="West Bank"]->.westbank;
);
(
  // Wineries - multiple tags
  node["amenity"="winery"](area.israel);
  way["amenity"="winery"](area.israel);
  relation["amenity"="winery"](area.israel);
  node["craft"="winery"](area.israel);
  way["craft"="winery"](area.israel);
  relation["craft"="winery"](area.israel);
  node["tourism"="winery"](area.israel);
  way["tourism"="winery"](area.israel);
  relation["tourism"="winery"](area.israel);
  
  // West Bank wineries
  node["amenity"="winery"](area.westbank);
  way["amenity"="winery"](area.westbank);
  relation["amenity"="winery"](area.westbank);
  node["craft"="winery"](area.westbank);
  way["craft"="winery"](area.westbank);
  relation["craft"="winery"](area.westbank);

  // Wine shops
  node["shop"="wine"](area.israel);
  way["shop"="wine"](area.israel);
  relation["shop"="wine"](area.israel);
  node["shop"="wine"](area.westbank);
  way["shop"="wine"](area.westbank);
  relation["shop"="wine"](area.westbank);

  // Wine bars / wine-focused restaurants
  node["amenity"="restaurant"]["cuisine"="wine_bar"](area.israel);
  way["amenity"="restaurant"]["cuisine"="wine_bar"](area.israel);
  relation["amenity"="restaurant"]["cuisine"="wine_bar"](area.israel);
  node["amenity"="bar"]["cuisine"="wine_bar"](area.israel);
  way["amenity"="bar"]["cuisine"="wine_bar"](area.israel);
  relation["amenity"="bar"]["cuisine"="wine_bar"](area.israel);
);
out center;
`;

async function fetchFromOverpass() {
  console.log('Requesting data from Overpass API...');

  const response = await axios.post(OVERPASS_URL, overpassQuery, {
    headers: { 'Content-Type': 'text/plain' }
  });

  const elements = response.data.elements || [];
  console.log(`Fetched ${elements.length} OSM elements.`);

  const wineries = [];
  const wineShops = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || '';
    const nameLower = name.toLowerCase();
    
    const isWinery =
      tags.amenity === 'winery' ||
      tags.craft === 'winery' ||
      tags.tourism === 'winery' ||
      tags.craft === 'distillery' ||
      (tags.tourism === 'attraction' &&
        (nameLower.includes('winery') ||
          nameLower.includes('יקב') ||
          nameLower.includes('vineyard')));
    const isWineShop = tags.shop === 'wine';
    const isWineBar =
      (tags.amenity === 'restaurant' || tags.amenity === 'bar') &&
      tags.cuisine === 'wine_bar';

    const lat = el.lat ?? el.center?.lat ?? null;
    const lng = el.lon ?? el.center?.lon ?? null;

    const base = {
      id: el.id,
      type: el.type,
      tags,
      lat,
      lng
    };

    if (isWinery) wineries.push(base);
    if (isWineShop || isWineBar) wineShops.push(base);
  }

  console.log(
    `OSM split into ${wineries.length} wineries and ${wineShops.length} wine shops.`
  );

  return { wineries, wineShops };
}

// ---------- Google Places ----------

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;

if (!GOOGLE_PLACES_KEY) {
  console.error('GOOGLE_PLACES_KEY is missing from .env');
  process.exit(1);
}

const PLACES_TEXT_SEARCH_URL =
  'https://maps.googleapis.com/maps/api/place/textsearch/json';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function textSearchAllPages(query) {
  console.log(`Google Places text search (all pages): "${query}"`);

  const results = [];
  let pageToken = undefined;
  let page = 1;

  while (true) {
    if (pageToken) {
      await sleep(2000);
    }

    const { data } = await axios.get(PLACES_TEXT_SEARCH_URL, {
      params: {
        query,
        key: GOOGLE_PLACES_KEY,
        language: 'he',
        pagetoken: pageToken
      }
    });

    if (data.status === 'OK') {
      const pageResults = data.results || [];
      results.push(...pageResults);
      console.log(`  Page ${page}: got ${pageResults.length} results`);
      page += 1;
      if (data.next_page_token) {
        pageToken = data.next_page_token;
        continue;
      }
    } else if (data.status === 'ZERO_RESULTS') {
      // No results, stop
    } else {
      console.error('Google Places error:', data.status, data.error_message);
    }

    break;
  }

  return results;
}

async function fetchFromGoogle() {
  // Multiple queries (English + Hebrew, cities, regions, variations) and dedupe by place_id
  const wineryQueries = [
    'winery in israel',
    'יקב בישראל',
    'יקבים בישראל',
    'vineyard in israel',
    'wine tasting in israel',
    'יקב ליד ירושלים',
    'יקב ליד תל אביב',
    'יקב ליד חיפה',
    'יקב ליד באר שבע',
    'יקב ליד אילת',
    'יקב בגליל',
    'יקב בגולן',
    'יקב בשרון',
    'יקב בשפלה',
    'יקב בנגב',
    'יקב ביהודה ושומרון',
    'יקב ברמת הגולן',
    'יקב בצפת',
    'יקב בטבריה',
    'יקב בנתניה',
    'יקב בהרצליה',
    'יקב בזכרון יעקב',
    'יקב בראשון לציון',
    'יקב במודיעין',
    'wine cellar in israel',
    'wine producer in israel'
  ];
  const wineShopQueries = [
    'wine shop in israel',
    'חנות יין בישראל',
    'חנות יין בירושלים',
    'חנות יין בתל אביב',
    'חנות יין בחיפה',
    'חנות יין בבאר שבע',
    'חנות יין באילת',
    'מרכז יין בישראל',
    'חנות יין ברמת גן',
    'חנות יין בהרצליה',
    'חנות יין בנתניה',
    'חנות יין במודיעין',
    'wine store in israel',
    'wine merchant in israel',
    'wine retailer in israel'
  ];

  const seenPlaceIds = new Set();

  const wineries = [];
  for (const q of wineryQueries) {
    const results = await textSearchAllPages(q);
    for (const place of results) {
      if (place.place_id && seenPlaceIds.has(place.place_id)) continue;
      if (place.place_id) seenPlaceIds.add(place.place_id);
      wineries.push(place);
    }
  }

  const wineShops = [];
  for (const q of wineShopQueries) {
    const results = await textSearchAllPages(q);
    for (const place of results) {
      if (place.place_id && seenPlaceIds.has(place.place_id)) continue;
      if (place.place_id) seenPlaceIds.add(place.place_id);
      wineShops.push(place);
    }
  }

  console.log(
    `Google split into ${wineries.length} wineries and ${wineShops.length} wine shops.`
  );

  return { wineries, wineShops };
}

// ---------- Main ----------

async function run() {
  try {
    const osm = await fetchFromOverpass();
    const google = await fetchFromGoogle();

    fs.writeFileSync(
      'osm_wineries.json',
      JSON.stringify(osm.wineries, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      'osm_wine_shops.json',
      JSON.stringify(osm.wineShops, null, 2),
      'utf8'
    );

    fs.writeFileSync(
      'google_wineries.json',
      JSON.stringify(google.wineries, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      'google_wine_shops.json',
      JSON.stringify(google.wineShops, null, 2),
      'utf8'
    );

    console.log('Exported JSON files:');
    console.log('  osm_wineries.json');
    console.log('  osm_wine_shops.json');
    console.log('  google_wineries.json');
    console.log('  google_wine_shops.json');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

run();


