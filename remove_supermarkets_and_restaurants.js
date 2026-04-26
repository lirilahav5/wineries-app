require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Keywords that indicate supermarkets/minimarkets
const SUPERMARKET_KEYWORDS = [
  'סופרמרקט', 'supermarket', 'супермаркет', 'סופר', 'super', 'מרכול', 'מרכולת',
  'מינימרקט', 'minimarket', 'минимаркет', 'מיני מרקט', 'mini market',
  'רשת', 'chain', 'רשת שיווק', 'grocery', 'מכולת', 'grocery store'
];

// Additional restaurant keywords (more comprehensive)
const RESTAURANT_KEYWORDS = [
  'מסעדה', 'restaurant', 'restoran', 'ресторан', 'cafe', 'קפה', 'ביסטרו', 'bistro',
  'bar', 'בר', 'pub', 'פאב', 'tavern', 'טברנה', 'dining', 'אוכל', 'food',
  'pizzeria', 'פיצרייה', 'пиццерия', 'steakhouse', 'סטייק', 'steak house',
  'grill', 'גריל', 'bbq', 'barbecue', 'מנגל', 'fast food', 'מזון מהיר'
];

// Check if entry is a supermarket/minimarket
function isSupermarket(name, address) {
  const text = `${name} ${address || ''}`.toLowerCase();
  return SUPERMARKET_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// Check if entry is a restaurant
function isRestaurant(name, address) {
  const text = `${name} ${address || ''}`.toLowerCase();
  return RESTAURANT_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// Parse cleaned file to get rows
function parseCleanedFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const rows = [];
  let currentRow = null;
  let inRow = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('ROW #') && line.includes('ID:')) {
      if (currentRow && currentRow.id) {
        rows.push(currentRow);
      }
      currentRow = {};
      inRow = true;
      const match = line.match(/ID:\s*(\d+)/);
      if (match) {
        currentRow.id = parseInt(match[1], 10);
      }
    } else if (line.includes('===') && inRow && currentRow && Object.keys(currentRow).length > 1) {
      if (currentRow.id) {
        rows.push(currentRow);
      }
      currentRow = null;
      inRow = false;
    } else if (inRow && line.trim() && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const fieldName = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      if (value === '[NULL]' || value === '') {
        value = null;
      }
      
      currentRow[fieldName] = value;
    }
  }
  
  if (currentRow && currentRow.id) {
    rows.push(currentRow);
  }
  
  return rows;
}

// Write cleaned rows back to file
function writeCleanedFile(filePath, rows, type) {
  const lines = [];
  lines.push('================================================================================');
  lines.push(`${type.toUpperCase()} TABLE - CLEANED ROWS`);
  lines.push(`Total Rows: ${rows.length}`);
  lines.push(`Cleaned: ${new Date().toISOString()}`);
  lines.push('================================================================================');
  lines.push('');
  lines.push('INSTRUCTIONS:');
  lines.push('- This file has been cleaned according to the following criteria:');
  lines.push('  a. Duplicates removed');
  lines.push('  b. Non-verified entries removed');
  lines.push('  c. Invalid discounts removed');
  lines.push('  d. Restaurants removed');
  lines.push('  e. Supermarkets and minimarkets removed');
  lines.push('  f. Wrong category entries removed');
  lines.push('');
  lines.push('================================================================================');
  
  rows.forEach((row, index) => {
    lines.push(`ROW #${index + 1} (ID: ${row.id || 'N/A'})`);
    lines.push('================================================================================');
    Object.entries(row).forEach(([key, value]) => {
      const displayValue = value === null ? '[NULL]' : value;
      lines.push(`${key.padEnd(20)} : ${displayValue}`);
    });
    lines.push('');
  });
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`✓ Updated file: ${filePath}`);
}

// Clean and update database
async function cleanAndUpdate(tableName, filePath) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`CLEANING ${tableName.toUpperCase()}`);
  console.log('='.repeat(80));
  
  // Parse current cleaned file
  console.log(`\nReading ${filePath}...`);
  const rows = parseCleanedFile(filePath);
  console.log(`✓ Found ${rows.length} entries`);
  
  // Filter out supermarkets, minimarkets, and restaurants
  const cleaned = [];
  const removed = {
    supermarkets: [],
    restaurants: []
  };
  
  for (const row of rows) {
    const name = row.name || '';
    const address = row.address || '';
    
    if (isSupermarket(name, address)) {
      removed.supermarkets.push(row);
      continue;
    }
    
    if (isRestaurant(name, address)) {
      removed.restaurants.push(row);
      continue;
    }
    
    cleaned.push(row);
  }
  
  console.log(`\nRemoved:`);
  console.log(`  - Supermarkets/Minimarkets: ${removed.supermarkets.length}`);
  console.log(`  - Restaurants: ${removed.restaurants.length}`);
  console.log(`\nFinal count: ${cleaned.length} entries`);
  
  // Write cleaned file back
  writeCleanedFile(filePath, cleaned, tableName);
  
  // Update database
  console.log(`\n${'='.repeat(80)}`);
  console.log(`UPDATING DATABASE: ${tableName.toUpperCase()}`);
  console.log('='.repeat(80));
  
  // Get IDs to delete
  const idsToDelete = [
    ...removed.supermarkets.map(r => r.id),
    ...removed.restaurants.map(r => r.id)
  ].filter(id => id);
  
  if (idsToDelete.length > 0) {
    console.log(`\nDeleting ${idsToDelete.length} entries from database...`);
    
    // Delete in batches
    const batchSize = 50;
    let deletedCount = 0;
    
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      const { error } = await supabase
        .from(tableName)
        .delete()
        .in('id', batch);
      
      if (error) {
        console.error(`Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      } else {
        deletedCount += batch.length;
        console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} entries (${deletedCount}/${idsToDelete.length})`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✓ Deleted ${deletedCount} entries from database`);
  } else {
    console.log('\n✓ No entries to delete');
  }
  
  // Verify final count
  const { data: finalData, error: finalError } = await supabase
    .from(tableName)
    .select('id');
  
  if (finalError) {
    console.error('Error verifying final count:', finalError);
  } else {
    console.log(`\n✓ Final count in database: ${finalData.length} entries`);
    console.log(`✓ Expected count: ${cleaned.length} entries`);
    
    if (finalData.length === cleaned.length) {
      console.log('✅ Counts match!');
    } else {
      console.log(`⚠ Count mismatch: ${Math.abs(finalData.length - cleaned.length)} difference`);
    }
  }
}

// Main execution
async function main() {
  console.log('='.repeat(80));
  console.log('REMOVING SUPERMARKETS, MINIMARKETS, AND RESTAURANTS');
  console.log('='.repeat(80));
  console.log('\nThis will:');
  console.log('1. Remove supermarkets and minimarkets from cleaned files');
  console.log('2. Remove additional restaurants from cleaned files');
  console.log('3. Update the database');
  console.log('\nStarting in 3 seconds...');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Clean wineries
    await cleanAndUpdate('wineries', 'wineries_data_cleaned.txt');
    
    // Clean wine shops
    await cleanAndUpdate('wine_shops', 'wine_shops_data_cleaned.txt');
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANING AND UPDATE COMPLETE!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
