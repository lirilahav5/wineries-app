const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase connection
const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU';
const supabase = createClient(supabaseUrl, supabaseKey);

function formatValue(value) {
  if (value === null || value === undefined) {
    return '[NULL]';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '... [truncated]';
  }
  return value;
}

function writeCleanedFile(filePath, rows, type) {
  const lines = [];
  lines.push('================================================================================');
  lines.push(`${type.toUpperCase()} TABLE - CLEANED ROWS`);
  lines.push(`Total Rows: ${rows.length}`);
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push('================================================================================');
  lines.push('');
  lines.push('INSTRUCTIONS:');
  lines.push('- This file has been cleaned according to the following criteria:');
  lines.push('  a. Duplicates removed');
  lines.push('  b. Non-verified entries removed');
  lines.push('  c. Invalid discounts removed (no explicit percentage or clear specification)');
  lines.push('  d. Information verified and updated');
  lines.push('  e. Wrong category entries removed (wineries in shops, shops in wineries)');
  lines.push('  f. Restaurants removed');
  lines.push('  g. Supermarkets and minimarkets removed');
  lines.push('');
  lines.push('================================================================================');
  
  rows.forEach((row, index) => {
    lines.push(`ROW #${index + 1} (ID: ${row.id || 'N/A'})`);
    lines.push('================================================================================');
    
    // Define field order for consistent output
    const fieldOrder = [
      'id', 'name', 'address', 'place_id', 'region', 'kosher', 'phone', 
      'website', 'opening_hours', 'is_open', 'lat', 'lng', 'geometry', 'offers'
    ];
    
    // Write fields in order, then any additional fields
    const writtenFields = new Set();
    fieldOrder.forEach(field => {
      if (row.hasOwnProperty(field)) {
        const value = formatValue(row[field]);
        lines.push(`${field.padEnd(20)} : ${value}`);
        writtenFields.add(field);
      }
    });
    
    // Write any remaining fields not in the standard order
    Object.keys(row).forEach(field => {
      if (!writtenFields.has(field)) {
        const value = formatValue(row[field]);
        lines.push(`${field.padEnd(20)} : ${value}`);
      }
    });
    
    lines.push('');
  });
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`✓ Updated ${filePath} with ${rows.length} entries`);
}

async function updateTxtFiles() {
  console.log('='.repeat(80));
  console.log('UPDATING TXT FILES FROM DATABASE');
  console.log('='.repeat(80));
  console.log('\nExporting current database state to cleaned txt files...\n');
  
  // Export Wineries
  console.log('📊 Exporting wineries...');
  const { data: wineries, error: wineriesError } = await supabase
    .from('wineries')
    .select('*')
    .order('id', { ascending: true });
  
  if (wineriesError) {
    console.error('Error fetching wineries:', wineriesError);
  } else {
    console.log(`✓ Fetched ${wineries.length} wineries from database`);
    writeCleanedFile('wineries_data_cleaned.txt', wineries, 'wineries');
  }
  
  console.log('\n');
  
  // Export Wine Shops
  console.log('🏪 Exporting wine shops...');
  const { data: wineShops, error: wineShopsError } = await supabase
    .from('wine_shops')
    .select('*')
    .order('id', { ascending: true });
  
  if (wineShopsError) {
    console.error('Error fetching wine shops:', wineShopsError);
  } else {
    console.log(`✓ Fetched ${wineShops.length} wine shops from database`);
    writeCleanedFile('wine_shops_data_cleaned.txt', wineShops, 'wine_shops');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ TXT FILES UPDATED!');
  console.log('='.repeat(80));
  console.log(`\nUpdated files:`);
  console.log(`  - wineries_data_cleaned.txt (${wineries?.length || 0} entries)`);
  console.log(`  - wine_shops_data_cleaned.txt (${wineShops?.length || 0} entries)`);
}

updateTxtFiles().catch(console.error);
