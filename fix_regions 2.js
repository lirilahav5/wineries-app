// Force fix all regions based on coordinates only (ignore address to avoid false matches)
// This script will update ALL regions based strictly on coordinates
//
// Usage (from project root):
//   1) Ensure you ran: npm install dotenv @supabase/supabase-js
//   2) In .env have: SUPABASE_SERVICE_ROLE=your_key
//   3) Run: node fix_regions.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { detectRegionFromCoordinates } = require('./detect_region');

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRegions(tableName) {
  console.log(`\nFixing regions in ${tableName}...`);
  
  // Get all rows with coordinates
  const { data: rows, error } = await supabase
    .from(tableName)
    .select('id, name, lat, lng, region')
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return;
  }

  if (!rows || rows.length === 0) {
    console.log(`No rows found in ${tableName}`);
    return;
  }

  console.log(`Found ${rows.length} rows with coordinates`);

  let fixed = 0;
  let unchanged = 0;

  for (const row of rows) {
    const lat = typeof row.lat === 'string' ? parseFloat(row.lat) : row.lat;
    const lng = typeof row.lng === 'string' ? parseFloat(row.lng) : row.lng;

    if (isNaN(lat) || isNaN(lng)) {
      console.log(`Skipping ${row.name}: invalid coordinates`);
      continue;
    }

    // Use ONLY coordinates (ignore address to avoid false matches)
    const correctRegion = detectRegionFromCoordinates(lat, lng);

    if (correctRegion && correctRegion !== row.region) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ region: correctRegion })
        .eq('id', row.id);

      if (updateError) {
        console.error(`Error updating ${row.name}:`, updateError.message);
      } else {
        console.log(`✓ Fixed: "${row.name}" (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        console.log(`  "${row.region || 'null'}" → "${correctRegion}"`);
        fixed++;
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\n${tableName}: Fixed ${fixed} regions, ${unchanged} unchanged`);
  return { fixed, unchanged };
}

async function run() {
  try {
    console.log('Starting region fix...');
    console.log('Using coordinates ONLY (ignoring addresses to avoid false matches)\n');

    const wineriesResult = await fixRegions('wineries');
    const shopsResult = await fixRegions('wine_shops');

    console.log('\n=== Summary ===');
    console.log(`Total fixed: ${(wineriesResult?.fixed || 0) + (shopsResult?.fixed || 0)}`);
    console.log('\nDone! Refresh your app to see the changes.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

run();

