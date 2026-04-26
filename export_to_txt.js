const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase connection
const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU';
const supabase = createClient(supabaseUrl, supabaseKey);

function formatRow(row, index) {
  let output = `\n${'='.repeat(80)}\n`;
  output += `ROW #${index + 1} (ID: ${row.id})\n`;
  output += `${'='.repeat(80)}\n`;
  
  // Format each field
  Object.keys(row).forEach(key => {
    const value = row[key];
    let displayValue = value;
    
    // Handle null/undefined
    if (value === null || value === undefined) {
      displayValue = '[NULL]';
    }
    // Handle objects/arrays
    else if (typeof value === 'object') {
      displayValue = JSON.stringify(value, null, 2);
    }
    // Handle long strings
    else if (typeof value === 'string' && value.length > 100) {
      displayValue = value.substring(0, 100) + '... [truncated]';
    }
    
    output += `${key.padEnd(20)}: ${displayValue}\n`;
  });
  
  return output;
}

async function exportToTxt() {
  console.log('Exporting database data to text files...\n');

  // Export Wineries
  console.log('📊 Exporting wineries...');
  const { data: wineries, error: wineriesError } = await supabase
    .from('wineries')
    .select('*')
    .order('id', { ascending: true });

  if (wineriesError) {
    console.error('Error fetching wineries:', wineriesError);
  } else {
    let wineriesContent = '';
    wineriesContent += '='.repeat(80) + '\n';
    wineriesContent += 'WINERIES TABLE - ALL ROWS\n';
    wineriesContent += `Total Rows: ${wineries.length}\n`;
    wineriesContent += `Exported: ${new Date().toISOString()}\n`;
    wineriesContent += '='.repeat(80) + '\n';
    wineriesContent += '\n';
    wineriesContent += 'INSTRUCTIONS:\n';
    wineriesContent += '- To remove a row, tell me: "Remove winery ID: [ID]"\n';
    wineriesContent += '- To update a row, tell me: "Update winery ID: [ID], field: [field_name], value: [new_value]"\n';
    wineriesContent += '- You can also reference rows by their row number (ROW #1, ROW #2, etc.)\n';
    wineriesContent += '\n';
    
    wineries.forEach((winery, index) => {
      wineriesContent += formatRow(winery, index);
    });
    
    fs.writeFileSync('wineries_data.txt', wineriesContent, 'utf8');
    console.log(`✅ Exported ${wineries.length} wineries to wineries_data.txt`);
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
    let wineShopsContent = '';
    wineShopsContent += '='.repeat(80) + '\n';
    wineShopsContent += 'WINE SHOPS TABLE - ALL ROWS\n';
    wineShopsContent += `Total Rows: ${wineShops.length}\n`;
    wineShopsContent += `Exported: ${new Date().toISOString()}\n`;
    wineShopsContent += '='.repeat(80) + '\n';
    wineShopsContent += '\n';
    wineShopsContent += 'INSTRUCTIONS:\n';
    wineShopsContent += '- To remove a row, tell me: "Remove wine shop ID: [ID]"\n';
    wineShopsContent += '- To update a row, tell me: "Update wine shop ID: [ID], field: [field_name], value: [new_value]"\n';
    wineShopsContent += '- You can also reference rows by their row number (ROW #1, ROW #2, etc.)\n';
    wineShopsContent += '\n';
    
    wineShops.forEach((shop, index) => {
      wineShopsContent += formatRow(shop, index);
    });
    
    fs.writeFileSync('wine_shops_data.txt', wineShopsContent, 'utf8');
    console.log(`✅ Exported ${wineShops.length} wine shops to wine_shops_data.txt`);
  }

  console.log('\n✅ Export complete!');
  console.log('\nFiles created:');
  console.log('  - wineries_data.txt');
  console.log('  - wine_shops_data.txt');
  console.log('\nYou can now open these files and tell me which rows to remove or update.');
}

exportToTxt().catch(console.error);
