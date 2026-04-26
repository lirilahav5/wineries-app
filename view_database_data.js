const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function viewAllData() {
  console.log('='.repeat(80));
  console.log('VIEWING ALL DATABASE DATA');
  console.log('='.repeat(80));
  console.log('\n');

  // View Wineries Table
  console.log('📊 WINERIES TABLE');
  console.log('-'.repeat(80));
  const { data: wineries, error: wineriesError } = await supabase
    .from('wineries')
    .select('*')
    .order('id', { ascending: true });

  if (wineriesError) {
    console.error('Error fetching wineries:', wineriesError);
  } else {
    console.log(`Total wineries: ${wineries.length}`);
    console.log('\nFirst 5 wineries:');
    wineries.slice(0, 5).forEach((winery, index) => {
      console.log(`\n${index + 1}. ${winery.name || 'N/A'}`);
      console.log(`   ID: ${winery.id}`);
      console.log(`   Address: ${winery.address || 'N/A'}`);
      console.log(`   Region: ${winery.region || 'N/A'}`);
      console.log(`   Phone: ${winery.phone || 'N/A'}`);
      console.log(`   Kosher: ${winery.kosher}`);
      console.log(`   Lat/Lng: ${winery.lat}, ${winery.lng}`);
    });
    if (wineries.length > 5) {
      console.log(`\n... and ${wineries.length - 5} more wineries`);
    }
  }

  console.log('\n\n');

  // View Wine Shops Table
  console.log('🏪 WINE SHOPS TABLE');
  console.log('-'.repeat(80));
  const { data: wineShops, error: wineShopsError } = await supabase
    .from('wine_shops')
    .select('*')
    .order('id', { ascending: true });

  if (wineShopsError) {
    console.error('Error fetching wine shops:', wineShopsError);
  } else {
    console.log(`Total wine shops: ${wineShops.length}`);
    console.log('\nFirst 5 wine shops:');
    wineShops.slice(0, 5).forEach((shop, index) => {
      console.log(`\n${index + 1}. ${shop.name || 'N/A'}`);
      console.log(`   ID: ${shop.id}`);
      console.log(`   Address: ${shop.address || 'N/A'}`);
      console.log(`   Region: ${shop.region || 'N/A'}`);
      console.log(`   Phone: ${shop.phone || 'N/A'}`);
      console.log(`   Kosher: ${shop.kosher}`);
      console.log(`   Lat/Lng: ${shop.lat}, ${shop.lng}`);
    });
    if (wineShops.length > 5) {
      console.log(`\n... and ${wineShops.length - 5} more wine shops`);
    }
  }

  console.log('\n\n');

  // Summary Statistics
  console.log('📈 SUMMARY STATISTICS');
  console.log('-'.repeat(80));
  
  if (wineries && !wineriesError) {
    const regions = {};
    wineries.forEach(w => {
      if (w.region) {
        regions[w.region] = (regions[w.region] || 0) + 1;
      }
    });
    console.log('\nWineries by Region:');
    Object.entries(regions).forEach(([region, count]) => {
      console.log(`  ${region}: ${count}`);
    });
    
    const kosherCount = wineries.filter(w => w.kosher === true || w.kosher === 'true').length;
    console.log(`\nKosher wineries: ${kosherCount} out of ${wineries.length}`);
  }

  if (wineShops && !wineShopsError) {
    const shopRegions = {};
    wineShops.forEach(s => {
      if (s.region) {
        shopRegions[s.region] = (shopRegions[s.region] || 0) + 1;
      }
    });
    console.log('\nWine Shops by Region:');
    Object.entries(shopRegions).forEach(([region, count]) => {
      console.log(`  ${region}: ${count}`);
    });
    
    const kosherShops = wineShops.filter(s => s.kosher === true || s.kosher === 'true').length;
    console.log(`\nKosher wine shops: ${kosherShops} out of ${wineShops.length}`);
  }

  console.log('\n');
  console.log('='.repeat(80));
  console.log('To export all data to JSON files, run: node export_database_data.js');
  console.log('='.repeat(80));
}

// Run the function
viewAllData().catch(console.error);
