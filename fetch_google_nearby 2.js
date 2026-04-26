// Use Google Places Nearby Search API to find wineries/wine shops by coordinates
// This searches in a grid pattern across Israel to catch places that text search might miss
//
// Usage (from project root):
//   1) Ensure you ran: npm install axios dotenv @supabase/supabase-js
//   2) In .env have: SUPABASE_SERVICE_ROLE=your_key, GOOGLE_PLACES_KEY=your_key
//   3) Run: node fetch_google_nearby.js

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { detectRegion } = require('./detect_region');

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;

if (!supabaseKey || !GOOGLE_PLACES_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE or GOOGLE_PLACES_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PLACES_NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    const { data } = await supabase.from('wineries').select('name, lat, lng');
    if (data) {
      for (const row of data) {
        existingKeys.wineries.add(makeKey(row.name, row.lat, row.lng));
      }
      console.log(`Loaded ${data.length} existing wineries.`);
    }
  }

  {
    const { data } = await supabase.from('wine_shops').select('name, lat, lng');
    if (data) {
      for (const row of data) {
        existingKeys.wine_shops.add(makeKey(row.name, row.lat, row.lng));
      }
      console.log(`Loaded ${data.length} existing wine_shops.`);
    }
  }

  return existingKeys;
}

async function fetchPlaceDetails(placeId) {
  try {
    const { data } = await axios.get(PLACES_DETAILS_URL, {
      params: {
        place_id: placeId,
        key: GOOGLE_PLACES_KEY,
        language: 'he',
        fields: 'formatted_phone_number,website,opening_hours'
      }
    });

    if (data.status !== 'OK') return {};

    const result = data.result || {};
    return {
      phone: result.formatted_phone_number || null,
      website: result.website || null,
      opening_hours: result.opening_hours
        ? JSON.stringify(result.opening_hours.weekday_text || [])
        : null
    };
  } catch (e) {
    return {};
  }
}

async function nearbySearch(lat, lng, radius = 50000, type = '') {
  // Search for wineries and wine shops near a coordinate
  const types = type
    ? [type]
    : ['winery', 'liquor_store', 'store', 'restaurant', 'bar'];

  const allResults = [];
  const seenPlaceIds = new Set();

  for (const searchType of types) {
    await sleep(200); // Rate limiting

    try {
      const { data } = await axios.get(PLACES_NEARBY_URL, {
        params: {
          location: `${lat},${lng}`,
          radius,
          type: searchType,
          key: GOOGLE_PLACES_KEY,
          language: 'he'
        }
      });

      if (data.status === 'OK' && data.results) {
        for (const place of data.results) {
          if (place.place_id && seenPlaceIds.has(place.place_id)) continue;
          if (place.place_id) seenPlaceIds.add(place.place_id);

          // Filter: name must contain winery/wine-related terms
          const name = (place.name || '').toLowerCase();
          const isWineRelated =
            name.includes('winery') ||
            name.includes('יקב') ||
            name.includes('wine') ||
            name.includes('יין') ||
            name.includes('vineyard') ||
            name.includes('wine shop') ||
            name.includes('חנות יין') ||
            searchType === 'winery';

          if (isWineRelated) {
            allResults.push({ ...place, detectedType: searchType });
          }
        }
      }
    } catch (e) {
      console.error(`Error searching near ${lat},${lng} for ${searchType}:`, e.message);
    }
  }

  return allResults;
}

async function mapPlaceToRow(place, existingKeys) {
  const location = place.geometry?.location;
  const lat = location?.lat ?? null;
  const lng = location?.lng ?? null;
  const name = place.name || null;

  if (!name || lat == null || lng == null) return null;

  const key = makeKey(name, lat, lng);

  // Determine if winery or wine shop
  const nameLower = name.toLowerCase();
  const isWinery =
    nameLower.includes('winery') ||
    nameLower.includes('יקב') ||
    nameLower.includes('vineyard') ||
    place.detectedType === 'winery';
  const isWineShop =
    nameLower.includes('wine shop') ||
    nameLower.includes('חנות יין') ||
    nameLower.includes('wine store') ||
    nameLower.includes('wine merchant') ||
    place.detectedType === 'liquor_store';

  if (isWinery && existingKeys.wineries.has(key)) return null;
  if (isWineShop && existingKeys.wine_shops.has(key)) return null;
  if (!isWinery && !isWineShop) return null; // Skip if not wine-related

  const address = place.vicinity || place.formatted_address || null;

  let phone = null;
  let website = null;
  let opening_hours = null;

  if (place.place_id) {
    try {
      const details = await fetchPlaceDetails(place.place_id);
      phone = details.phone;
      website = details.website;
      opening_hours = details.opening_hours;
    } catch (e) {
      // Ignore details errors
    }
  }

  const geometry =
    lat != null && lng != null ? `SRID=4326;POINT(${lng} ${lat})` : null;

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

  if (isWinery) {
    existingKeys.wineries.add(key);
    return { type: 'winery', row };
  } else {
    existingKeys.wine_shops.add(key);
    return { type: 'wine_shop', row };
  }
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

async function run() {
  try {
    const existingKeys = await loadExistingKeys();

    // Grid search across Israel (major regions)
    const searchPoints = [
      // North
      { lat: 32.7944, lng: 35.5333, name: 'Galilee' },
      { lat: 33.0044, lng: 35.6919, name: 'Golan Heights' },
      { lat: 32.7018, lng: 35.1168, name: 'Kfar Tavor' },
      // Center
      { lat: 31.7683, lng: 35.2137, name: 'Jerusalem' },
      { lat: 32.0853, lng: 34.7818, name: 'Tel Aviv' },
      { lat: 32.7944, lng: 34.9892, name: 'Haifa' },
      { lat: 32.0853, lng: 34.7818, name: 'Sharon' },
      // South
      { lat: 31.2529, lng: 34.7915, name: 'Beer Sheva' },
      { lat: 29.5577, lng: 34.9519, name: 'Eilat' },
      { lat: 31.2615, lng: 35.1341, name: 'Yatir' }
    ];

    const wineryRows = [];
    const wineShopRows = [];

    for (const point of searchPoints) {
      console.log(`\nSearching near ${point.name} (${point.lat}, ${point.lng})...`);
      const results = await nearbySearch(point.lat, point.lng, 50000);

      for (const place of results) {
        const mapped = await mapPlaceToRow(place, existingKeys);
        if (mapped) {
          if (mapped.type === 'winery') {
            wineryRows.push(mapped.row);
          } else {
            wineShopRows.push(mapped.row);
          }
        }
        await sleep(100); // Rate limiting between places
      }
    }

    console.log(`\nPrepared ${wineryRows.length} winery rows and ${wineShopRows.length} wine shop rows from Nearby Search.`);

    await insertRows('wineries', wineryRows);
    await insertRows('wine_shops', wineShopRows);

    console.log('\nDone importing data from Google Nearby Search.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

run();

