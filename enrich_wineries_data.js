// Cross-reference and enrich wineries/wine_shops data from multiple sources
// This script reads from Supabase, matches OSM and Google data by name/location,
// and fills in missing fields (phone, website, etc.) from the best available source.
//
// Usage (from project root):
//   1) Ensure you ran: npm install axios dotenv @supabase/supabase-js
//   2) In .env have: SUPABASE_SERVICE_ROLE=your_key
//   3) Run: node enrich_wineries_data.js

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { detectRegion } = require('./detect_region');

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: calculate distance between two lat/lng points (Haversine formula)
function distance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Normalize name for matching
function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

async function enrichTable(tableName) {
  console.log(`\nEnriching ${tableName}...`);

  // Load all rows
  const { data: rows, error } = await supabase.from(tableName).select('*');

  if (error) {
    console.error(`Error loading ${tableName}:`, error.message);
    return;
  }

  console.log(`Loaded ${rows.length} rows from ${tableName}.`);

  let updated = 0;

  for (const row of rows) {
    const updates = {};

    // If missing phone, try to find a match in other rows by name/location
    if (!row.phone) {
      const normalizedName = normalizeName(row.name);
      for (const other of rows) {
        if (
          other.id !== row.id &&
          other.phone &&
          normalizeName(other.name) === normalizedName &&
          row.lat &&
          row.lng &&
          other.lat &&
          other.lng &&
          distance(row.lat, row.lng, other.lat, other.lng) < 0.1 // within 100m
        ) {
          updates.phone = other.phone;
          break;
        }
      }
    }

    // If missing website, try to find a match
    if (!row.website) {
      const normalizedName = normalizeName(row.name);
      for (const other of rows) {
        if (
          other.id !== row.id &&
          other.website &&
          normalizeName(other.name) === normalizedName &&
          row.lat &&
          row.lng &&
          other.lat &&
          other.lng &&
          distance(row.lat, row.lng, other.lat, other.lng) < 0.1
        ) {
          updates.website = other.website;
          break;
        }
      }
    }

    // If missing address, try to find a match
    if (!row.address) {
      const normalizedName = normalizeName(row.name);
      for (const other of rows) {
        if (
          other.id !== row.id &&
          other.address &&
          normalizeName(other.name) === normalizedName &&
          row.lat &&
          row.lng &&
          other.lat &&
          other.lng &&
          distance(row.lat, row.lng, other.lat, other.lng) < 0.1
        ) {
          updates.address = other.address;
          break;
        }
      }
    }

    // Always re-detect region from coordinates/address (to fix incorrect ones)
    // Coordinates are more reliable, so we prioritize them
    if (row.lat && row.lng) {
      const detectedRegion = detectRegion(row.lat, row.lng, row.address);
      if (detectedRegion) {
        // Always update region if detected (fixes incorrect ones)
        if (detectedRegion !== row.region) {
          updates.region = detectedRegion;
          if (row.region) {
            console.log(`Fixing region for "${row.name}" (${row.lat}, ${row.lng}): "${row.region}" -> "${detectedRegion}"`);
          } else {
            console.log(`Adding region for "${row.name}": "${detectedRegion}"`);
          }
        }
      }
    }

    // Update if we found any missing fields
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', row.id);

      if (updateError) {
        console.error(`Error updating ${row.name}:`, updateError.message);
      } else {
        updated += 1;
        console.log(`  Enriched: ${row.name} (added: ${Object.keys(updates).join(', ')})`);
      }
    }
  }

  console.log(`Enriched ${updated} rows in ${tableName}.`);
}

async function run() {
  try {
    await enrichTable('wineries');
    await enrichTable('wine_shops');
    console.log('\nDone enriching data.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

run();

