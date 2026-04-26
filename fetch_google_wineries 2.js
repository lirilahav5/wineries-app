// Fetch wineries and wine shops from Google Places API
// and insert them into your Supabase `wineries` and `wine_shops` tables.
//
// Usage (from project root):
//   1) Ensure you ran:
//        npm install axios dotenv @supabase/supabase-js
//   2) In .env (at project root) add:
//        SUPABASE_SERVICE_ROLE=your_service_role_key_here
//        GOOGLE_PLACES_KEY=your_google_places_api_key_here
//   3) Run:
//        node fetch_google_wineries.js
//
// NOTE: This script does a simple text search for "winery in Israel"
//       and "wine shop in Israel". You can refine the queries, add
//       pagination, or change the region as needed.

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { detectRegion } = require('./detect_region');

// ---------- Supabase setup ----------

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE; // service_role key from .env

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------- Google Places setup ----------

const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;

if (!GOOGLE_PLACES_KEY) {
  console.error('GOOGLE_PLACES_KEY is missing from .env');
  process.exit(1);
}

const PLACES_TEXT_SEARCH_URL =
  'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACES_DETAILS_URL =
  'https://maps.googleapis.com/maps/api/place/details/json';

// ---------- Duplicate helper (reuse logic: name + lat + lng) ----------

function makeKey(name, lat, lng) {
  // Normalize: lowercase name, round coordinates to 4 decimal places (~11 meters precision)
  // This prevents duplicates from slight coordinate differences
  const normalizedName = (name || '').trim().toLowerCase();
  const normalizedLat = lat != null ? parseFloat(lat).toFixed(4) : '';
  const normalizedLng = lng != null ? parseFloat(lng).toFixed(4) : '';
  return `${normalizedName}|${normalizedLat}|${normalizedLng}`;
}

async function loadExistingKeys() {
  const existingKeys = {
    wineries: new Set(),
    wine_shops: new Set()
  };

  {
    const { data, error } = await supabase
      .from('wineries')
      .select('name, lat, lng');

    if (error) {
      console.error('Error loading existing wineries:', error.message);
    } else if (data) {
      for (const row of data) {
        existingKeys.wineries.add(makeKey(row.name, row.lat, row.lng));
      }
      console.log(`Loaded ${data.length} existing wineries.`);
    }
  }

  {
    const { data, error } = await supabase
      .from('wine_shops')
      .select('name, lat, lng');

    if (error) {
      console.error('Error loading existing wine_shops:', error.message);
    } else if (data) {
      for (const row of data) {
        existingKeys.wine_shops.add(makeKey(row.name, row.lat, row.lng));
      }
      console.log(`Loaded ${data.length} existing wine_shops.`);
    }
  }

  return existingKeys;
}

// ---------- Google Places helpers ----------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function textSearchAllPages(query) {
  console.log(`Google Places text search (all pages): "${query}"`);

  const results = [];
  let pageToken = undefined;
  let page = 1;

  while (true) {
    // Respect Google’s 2s delay when using next_page_token
    if (pageToken) {
      await sleep(2000);
    }

    const { data } = await axios.get(PLACES_TEXT_SEARCH_URL, {
      params: {
        query,
        key: GOOGLE_PLACES_KEY,
        language: 'he', // or 'en' – adjust as needed
        pagetoken: pageToken
      }
    });

    if (data.status === 'OK') {
      results.push(...(data.results || []));
      console.log(`  Page ${page}: got ${data.results?.length || 0} results`);
      page += 1;
      if (data.next_page_token) {
        pageToken = data.next_page_token;
        continue;
      }
    } else if (data.status === 'ZERO_RESULTS') {
      // nothing more
    } else {
      console.error('Google Places error:', data.status, data.error_message);
    }

    break;
  }

  return results;
}

async function fetchPlaceDetails(placeId) {
  const { data } = await axios.get(PLACES_DETAILS_URL, {
    params: {
      place_id: placeId,
      key: GOOGLE_PLACES_KEY,
      language: 'he',
      fields: 'formatted_phone_number,website,opening_hours'
    }
  });

  if (data.status !== 'OK') {
    return {};
  }

  const result = data.result || {};

  return {
    phone: result.formatted_phone_number || null,
    website: result.website || null,
    opening_hours: result.opening_hours
      ? JSON.stringify(result.opening_hours.weekday_text || [])
      : null
  };
}

// Map Google Places result into DB row
async function mapPlaceToRow(place, type, existingKeys) {
  const location = place.geometry?.location;
  const lat = location?.lat ?? null;
  const lng = location?.lng ?? null;
  const name = place.name || null;

  if (!name || lat == null || lng == null) return null;

  const key = makeKey(name, lat, lng);

  if (type === 'winery' && existingKeys.wineries.has(key)) return null;
  if (type === 'wine_shop' && existingKeys.wine_shops.has(key)) return null;

  // Basic address is in formatted_address
  const address = place.formatted_address || null;

  // Optional: call Place Details for richer info
  let phone = null;
  let website = null;
  let opening_hours = null;

  try {
    const details = await fetchPlaceDetails(place.place_id);
    phone = details.phone;
    website = details.website;
    opening_hours = details.opening_hours;
  } catch (e) {
    console.error('Error fetching details for', name, e.message);
  }

  const geometry =
    lat != null && lng != null
      ? `SRID=4326;POINT(${lng} ${lat})`
      : null;

  const row = {
    name,
    address,
    place_id: place.place_id || null,
    region: detectRegion(lat, lng, address),
    kosher: null,
    phone,
    website,
    opening_hours,
    is_open: place.opening_hours?.open_now ?? null,
    offers: null,
    lat,
    lng,
    geometry
  };

  if (type === 'winery') {
    existingKeys.wineries.add(key);
  } else {
    existingKeys.wine_shops.add(key);
  }

  return row;
}

async function insertRows(tableName, rows) {
  if (!rows.length) return;

  console.log(`Inserting ${rows.length} rows into ${tableName}...`);

  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).insert(batch);

    if (error) {
      console.error(`Error inserting into ${tableName}:`, error.message);
    } else {
      console.log(`Inserted ${batch.length} rows into ${tableName}.`);
    }
  }
}

// ---------- Main ----------

async function run() {
  try {
    const existingKeys = await loadExistingKeys();

    // Multiple queries to broaden coverage (English + Hebrew, cities, regions, variations)
    const wineryQueries = [
      // General
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
      // Regions
      'יקב בגליל',
      'יקב בגולן',
      'יקב בשרון',
      'יקב בשפלה',
      'יקב בנגב',
      'יקב ביהודה ושומרון',
      // More cities
      'יקב ברמת הגולן',
      'יקב בצפת',
      'יקב בטבריה',
      'יקב בנתניה',
      'יקב בהרצליה',
      'יקב בזכרון יעקב',
      'יקב בראשון לציון',
      'יקב במודיעין',
      // English variations
      'wine cellar in israel',
      'wine producer in israel',
      // More cities and towns
      'יקב בכפר תבור',
      'יקב במושבה',
      'יקב במושב',
      'יקב בקיבוץ',
      'יקב במושבה יקנעם',
      'יקב במושבה חדרה',
      'יקב במושבה רחובות',
      'יקב במושבה רעננה',
      'יקב במושבה פתח תקווה',
      'יקב במושבה רחובות',
      'יקב במושבה רמלה',
      'יקב במושבה לוד',
      // More specific searches
      'יקב אורגני בישראל',
      'יקב בוטיק בישראל',
      'יקב משפחתי בישראל',
      'יקב כשר בישראל',
      'יקב יקב בישראל',
      // English specific
      'kosher winery in israel',
      'boutique winery in israel',
      'organic winery in israel',
      'family winery in israel'
    ];
    const wineShopQueries = [
      // General
      'wine shop in israel',
      'חנות יין בישראל',
      'חנות יין בירושלים',
      'חנות יין בתל אביב',
      'חנות יין בחיפה',
      'חנות יין בבאר שבע',
      'חנות יין באילת',
      // More variations
      'מרכז יין בישראל',
      'חנות יין ברמת גן',
      'חנות יין בהרצליה',
      'חנות יין בנתניה',
      'חנות יין במודיעין',
      // English variations
      'wine store in israel',
      'wine merchant in israel',
      'wine retailer in israel',
      // More cities
      'חנות יין בכפר סבא',
      'חנות יין ברעננה',
      'חנות יין בפתח תקווה',
      'חנות יין בראשון לציון',
      'חנות יין ברחובות',
      'חנות יין בבת ים',
      'חנות יין בחולון',
      'חנות יין באשדוד',
      'חנות יין באשקלון',
      // More variations
      'מרכז יין בירושלים',
      'מרכז יין בתל אביב',
      'חנות יין כשר בישראל',
      'חנות יין אורגני בישראל',
      // English specific
      'wine bar in israel',
      'wine tasting room in israel',
      'kosher wine shop in israel'
    ];

    // Deduplicate by place_id across all queries
    const seenPlaceIds = new Set();

    // 1) Wineries
    const wineryRows = [];
    for (const q of wineryQueries) {
      const results = await textSearchAllPages(q);
      for (const place of results) {
        if (place.place_id && seenPlaceIds.has(place.place_id)) continue;
        if (place.place_id) seenPlaceIds.add(place.place_id);
        const row = await mapPlaceToRow(place, 'winery', existingKeys);
        if (row) wineryRows.push(row);
      }
    }
    console.log(`Prepared ${wineryRows.length} winery rows from Google.`);

    // 2) Wine shops
    const wineShopRows = [];
    for (const q of wineShopQueries) {
      const results = await textSearchAllPages(q);
      for (const place of results) {
        if (place.place_id && seenPlaceIds.has(place.place_id)) continue;
        if (place.place_id) seenPlaceIds.add(place.place_id);
        const row = await mapPlaceToRow(place, 'wine_shop', existingKeys);
        if (row) wineShopRows.push(row);
      }
    }
    console.log(`Prepared ${wineShopRows.length} wine shop rows from Google.`);

    await insertRows('wineries', wineryRows);
    await insertRows('wine_shops', wineShopRows);

    console.log('Done importing data from Google Places.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

run();


