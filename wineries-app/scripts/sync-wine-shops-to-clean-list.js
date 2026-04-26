/**
 * Keeps only wine shops that appear in wine-shops-clean-list.txt.
 * Removes others from Supabase wine_shops table and updates local wine_shops.geojson.
 * Run from wineries-app: node scripts/sync-wine-shops-to-clean-list.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU';

const APP_ROOT = path.join(__dirname, '..');
const LIST_PATH = path.join(APP_ROOT, 'wine-shops-clean-list.txt');
const GEOJSON_PATH = path.join(APP_ROOT, 'public', 'assets', 'data', 'wine_shops.geojson');
const GEOJSON_SRC_PATH = path.join(APP_ROOT, 'src', 'assets', 'data', 'wine_shops.geojson');

function normalize(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/\s+/g, ' ').trim();
}

function isAllowed(shopName, allowedNamesSet, allowedNormalized) {
  const n = normalize(shopName);
  if (!n) return false;
  // Exact match (normalized)
  if (allowedNamesSet.has(n)) return true;
  // Allowed name is prefix of shop name (e.g. list "מנו וינו" matches "מנו וינו דיזנגוף")
  for (const allowed of allowedNormalized) {
    if (!allowed) continue;
    if (n === allowed || n.startsWith(allowed + ' ') || n.startsWith(allowed + '-') || (allowed.length >= 4 && n.includes(allowed))) return true;
  }
  // Shop name is prefix of allowed (e.g. shop "דרך היין" matches list "דרך היין Wine Route")
  for (const allowed of allowedNormalized) {
    if (!allowed) continue;
    if (allowed.startsWith(n) || allowed.includes(n)) return true;
  }
  return false;
}

function loadCleanList() {
  const raw = fs.readFileSync(LIST_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const set = new Set(lines.map(normalize));
  const normalized = lines.map(normalize).filter(Boolean);
  return { set, normalized };
}

async function syncDatabase() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { set: allowedSet, normalized: allowedNormalized } = loadCleanList();
  console.log('Clean list entries:', allowedNormalized.length);

  const { data: shops, error: fetchErr } = await supabase.from('wine_shops').select('id, name');
  if (fetchErr) {
    console.error('Failed to fetch wine_shops:', fetchErr);
    throw fetchErr;
  }
  console.log('Fetched wine_shops from DB:', shops.length);

  const toDelete = shops.filter((s) => !isAllowed(s.name, allowedSet, allowedNormalized));
  const toKeep = shops.filter((s) => isAllowed(s.name, allowedSet, allowedNormalized));
  console.log('To keep:', toKeep.length, 'To delete:', toDelete.length);

  if (toDelete.length === 0) {
    console.log('No shops to delete from database.');
    return;
  }

  // Delete in batches (Supabase limit)
  const ids = toDelete.map((s) => s.id);
  const BATCH = 50;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error: delErr } = await supabase.from('wine_shops').delete().in('id', batch);
    if (delErr) {
      console.error('Delete batch failed (RLS or permissions?):', delErr);
      console.log('You may need to run deletes in Supabase Dashboard or use a service role key.');
      throw delErr;
    }
    console.log('Deleted batch', Math.floor(i / BATCH) + 1, batch.length, 'rows');
  }
  console.log('Database sync done. Remaining shops:', toKeep.length);
}

function syncGeojson() {
  const { set: allowedSet, normalized: allowedNormalized } = loadCleanList();
  const geojsonPath = fs.existsSync(GEOJSON_PATH) ? GEOJSON_PATH : GEOJSON_SRC_PATH;
  const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  const original = data.features.length;
  data.features = data.features.filter((f) => isAllowed(f.properties?.name, allowedSet, allowedNormalized));
  console.log('GeoJSON: kept', data.features.length, 'of', original, 'shops');

  fs.writeFileSync(geojsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Written:', geojsonPath);

  const otherPath = geojsonPath === GEOJSON_PATH ? GEOJSON_SRC_PATH : GEOJSON_PATH;
  if (fs.existsSync(otherPath)) {
    fs.writeFileSync(otherPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Written:', otherPath);
  }
}

async function main() {
  console.log('Syncing wine shops to clean list...');
  loadCleanList();
  await syncDatabase();
  syncGeojson();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
