const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase connection
const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function exportAllData() {
  console.log('Exporting all database data to JSON files...\n');

  // Export Wineries
  console.log('📊 Exporting wineries...');
  const { data: wineries, error: wineriesError } = await supabase
    .from('wineries')
    .select('*')
    .order('id', { ascending: true });

  if (wineriesError) {
    console.error('Error fetching wineries:', wineriesError);
  } else {
    fs.writeFileSync('wineries_export.json', JSON.stringify(wineries, null, 2));
    console.log(`✅ Exported ${wineries.length} wineries to wineries_export.json`);
  }

  // Export Wine Shops
  console.log('🏪 Exporting wine shops...');
  const { data: wineShops, error: wineShopsError } = await supabase
    .from('wine_shops')
    .select('*')
    .order('id', { ascending: true });

  if (wineShopsError) {
    console.error('Error fetching wine shops:', wineShopsError);
  } else {
    fs.writeFileSync('wine_shops_export.json', JSON.stringify(wineShops, null, 2));
    console.log(`✅ Exported ${wineShops.length} wine shops to wine_shops_export.json`);
  }

  console.log('\n✅ Export complete!');
}

exportAllData().catch(console.error);
