// Fetch wineries and wine shops from OpenStreetMap (Overpass API)
// and insert them into your Supabase `wineries` and/or `wine_shops` tables.
//
// Usage (from project root):
//   1) npm install axios dotenv @supabase/supabase-js
//   2) Create a .env file with:
//        SUPABASE_SERVICE_ROLE=your_service_role_key_here
//   3) Run:
//        node fetch_osm_wineries.js
//
// NOTE: This script is a starting point. You can refine the Overpass query,
//       mapping logic, and deduplication rules as you go.

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { detectRegion } = require('./detect_region');

// ---------- Supabase setup ----------

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE; // DO NOT put this key in frontend

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------- Overpass API query ----------

// Example: all objects in Israel with tags related to wineries / wine shops.
// You can tweak the area and filters later.
//
// amenity=winery            – classic winery POI
// craft=winery              – some OSM mappers use this instead
// shop=wine                 – wine shops
//
// We query nodes + ways + relations, then turn ways/relations into center points.

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
  
  // Distilleries (related to wine production)
  node["craft"="distillery"](area.israel);
  way["craft"="distillery"](area.israel);
  relation["craft"="distillery"](area.israel);
  
  // Tourism attractions that might be wineries (by name matching)
  node["tourism"="attraction"](area.israel);
  way["tourism"="attraction"](area.israel);
  relation["tourism"="attraction"](area.israel);
);
out center;
`;

// ---------- Helper: map OSM element to our DB shape ----------

function mapOsmToRow(element) {
  const tags = element.tags || {};

  // Determine category based on tags (multiple winery tags, wine shops, wine bars)
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

  // Derive coordinates: node has lat/lon directly, ways/relations use center
  const lat = element.lat ?? element.center?.lat ?? null;
  const lng = element.lon ?? element.center?.lon ?? null;

  // Basic address pieces from OSM tags
  const addressParts = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:city'],
    tags['addr:postcode'],
    tags['addr:country']
  ].filter(Boolean);
  const address = addressParts.length ? addressParts.join(', ') : null;

  const website = tags.website || tags['contact:website'] || null;
  const phone = tags.phone || tags['contact:phone'] || null;

  // We don't get opening hours / kosher / region from OSM reliably, so leave null

  const geometry =
    lat != null && lng != null
      ? `SRID=4326;POINT(${lng} ${lat})`
      : null;

  return {
    isWinery,
    isWineShop,
    row: {
      name,
      address,
      place_id: null, // Overpass does not give Google place_id
      region: detectRegion(lat, lng, address),
      kosher: null,
      phone,
      website,
      opening_hours: null,
      is_open: null,
      offers: null,
      lat,
      lng,
      geometry
    }
  };
}

// ---------- Main logic ----------

async function fetchFromOverpass() {
  console.log('Requesting data from Overpass API...');

  const response = await axios.post(
    OVERPASS_URL,
    overpassQuery,
    {
      headers: { 'Content-Type': 'text/plain' }
    }
  );

  const elements = response.data.elements || [];
  console.log(`Fetched ${elements.length} OSM elements.`);

  return elements;
}

// Load existing rows to avoid duplicates (by name + lat + lng)
async function loadExistingKeys() {
  const existingKeys = {
    wineries: new Set(),
    wine_shops: new Set()
  };

  // Helper to build a stable key
  const makeKey = (name, lat, lng) => {
    // Normalize: lowercase name, round coordinates to 4 decimal places (~11 meters precision)
    // This prevents duplicates from slight coordinate differences
    const normalizedName = (name || '').trim().toLowerCase();
    const normalizedLat = lat != null ? parseFloat(lat).toFixed(4) : '';
    const normalizedLng = lng != null ? parseFloat(lng).toFixed(4) : '';
    return `${normalizedName}|${normalizedLat}|${normalizedLng}`;
  };

  // Load existing wineries
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

  // Load existing wine shops
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

  return { existingKeys, makeKey };
}

async function insertRows(tableName, rows) {
  if (!rows.length) return;

  console.log(`Inserting ${rows.length} rows into ${tableName}...`);

  // Insert in small batches to avoid hitting limits
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
    const elements = await fetchFromOverpass();
    const { existingKeys, makeKey } = await loadExistingKeys();

    const wineryRows = [];
    const wineShopRows = [];

    for (const el of elements) {
      const { isWinery, isWineShop, row } = mapOsmToRow(el);

      // Skip if we don't have a name or coordinates – often low‑quality data
      if (!row.name || row.lat == null || row.lng == null) continue;

      if (isWinery) {
        const key = makeKey(row.name, row.lat, row.lng);
        if (!existingKeys.wineries.has(key)) {
          existingKeys.wineries.add(key); // avoid duplicates within this run too
          wineryRows.push(row);
        }
      }

      if (isWineShop) {
        const key = makeKey(row.name, row.lat, row.lng);
        if (!existingKeys.wine_shops.has(key)) {
          existingKeys.wine_shops.add(key);
          wineShopRows.push(row);
        }
      }

      // Wine bars go into wine_shops table (they sell wine)
      if (isWineBar) {
        const key = makeKey(row.name, row.lat, row.lng);
        if (!existingKeys.wine_shops.has(key)) {
          existingKeys.wine_shops.add(key);
          wineShopRows.push(row);
        }
      }
    }

    console.log(
      `Prepared ${wineryRows.length} winery rows and ${wineShopRows.length} wine shop rows.`
    );

    await insertRows('wineries', wineryRows);
    await insertRows('wine_shops', wineShopRows);

    console.log('Done importing OSM data.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

run();


