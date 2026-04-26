// Find and remove duplicate wineries and wine shops
// Duplicates are identified by: name + lat + lng (same name at same location)
//
// Usage (from project root):
//   1) Ensure you ran: npm install dotenv @supabase/supabase-js
//   2) In .env have: SUPABASE_SERVICE_ROLE=your_key
//   3) Run: node find_and_remove_duplicates.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function makeKey(name, lat, lng) {
  // Normalize: lowercase name, round coordinates to 4 decimal places (~11 meters precision)
  const normalizedName = (name || '').trim().toLowerCase();
  const normalizedLat = lat ? parseFloat(lat).toFixed(4) : '';
  const normalizedLng = lng ? parseFloat(lng).toFixed(4) : '';
  return `${normalizedName}|${normalizedLat}|${normalizedLng}`;
}

async function findAndRemoveDuplicates(tableName) {
  console.log(`\n=== Checking ${tableName} for duplicates ===`);
  
  // Get all rows
  const { data: rows, error } = await supabase
    .from(tableName)
    .select('id, name, lat, lng, created_at')
    .order('created_at', { ascending: true }); // Keep older records

  if (error) {
    console.error(`Error fetching ${tableName}:`, error);
    return { found: 0, removed: 0 };
  }

  if (!rows || rows.length === 0) {
    console.log(`No rows found in ${tableName}`);
    return { found: 0, removed: 0 };
  }

  console.log(`Found ${rows.length} total rows`);

  // Group by key (name + lat + lng)
  const keyMap = new Map();
  const duplicates = [];

  for (const row of rows) {
    const key = makeKey(row.name, row.lat, row.lng);
    
    if (!keyMap.has(key)) {
      keyMap.set(key, [row]);
    } else {
      keyMap.get(key).push(row);
    }
  }

  // Find groups with more than one row (duplicates)
  for (const [key, group] of keyMap.entries()) {
    if (group.length > 1) {
      duplicates.push(group);
      console.log(`\nFound ${group.length} duplicates for: "${group[0].name}" (${group[0].lat}, ${group[0].lng})`);
      group.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ID: ${row.id}, Created: ${row.created_at}`);
      });
    }
  }

  if (duplicates.length === 0) {
    console.log(`\n✓ No duplicates found in ${tableName}`);
    return { found: 0, removed: 0 };
  }

  console.log(`\nTotal duplicate groups: ${duplicates.length}`);
  
  // Remove duplicates (keep the first/oldest one, remove the rest)
  let removed = 0;
  for (const group of duplicates) {
    // Sort by created_at to keep the oldest
    group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // Keep the first one, remove the rest
    const toRemove = group.slice(1);
    
    for (const row of toRemove) {
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', row.id);

      if (deleteError) {
        console.error(`Error deleting ID ${row.id}:`, deleteError.message);
      } else {
        console.log(`  ✓ Removed duplicate ID: ${row.id}`);
        removed++;
      }
    }
  }

  console.log(`\n✓ Removed ${removed} duplicate rows from ${tableName}`);
  return { found: duplicates.length, removed };
}

async function run() {
  try {
    console.log('Starting duplicate check and removal...\n');

    const wineriesResult = await findAndRemoveDuplicates('wineries');
    const shopsResult = await findAndRemoveDuplicates('wine_shops');

    console.log('\n=== Summary ===');
    console.log(`Wineries: Found ${wineriesResult.found} duplicate groups, removed ${wineriesResult.removed} rows`);
    console.log(`Wine Shops: Found ${shopsResult.found} duplicate groups, removed ${shopsResult.removed} rows`);
    console.log(`\nTotal removed: ${wineriesResult.removed + shopsResult.removed} duplicate rows`);
    console.log('\nDone!');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

run();

