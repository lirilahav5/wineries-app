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

// IDs to remove
const idsToRemove = [
  102, 108, 110, 113, 115, 116, 120, 129, 137, 144, 146, 147, 148, 178, 179, 181,
  233, 234, 239, 240, 241, 272, 274, 278, 281, 282, 283, 284, 285, 286, 287, 289,
  290, 292, 390, 391, 392, 407, 408, 428, 429, 430, 432, 434, 435, 439, 440, 442,
  444, 447, 449, 452, 456, 459, 464, 466, 482, 534, 536, 549, 554, 556, 601, 605,
  646, 660, 670, 704, 706, 707, 708, 709, 710, 711, 718, 719, 720, 721, 723, 724,
  734, 741, 742, 762, 777, 789, 791, 793, 794, 807, 818, 829, 833, 838, 842, 870,
  871, 874, 875, 878, 884, 898, 901, 903, 929, 941, 942, 946, 949, 950, 951, 952,
  954, 955, 956, 964, 965, 966, 985, 986, 990, 991, 992, 994, 996, 997, 998, 1000
];

console.log(`Total IDs to remove: ${idsToRemove.length}`);
console.log('IDs:', idsToRemove.join(', '));

// Parse cleaned file
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

// Write cleaned file back
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
  lines.push('  c. Invalid discounts removed');
  lines.push('  d. Restaurants removed');
  lines.push('  e. Supermarkets and minimarkets removed');
  lines.push('  f. Wrong category entries removed');
  lines.push('  g. Specific entries removed as requested');
  lines.push('');
  lines.push('================================================================================');
  
  rows.forEach((row, index) => {
    lines.push(`ROW #${index + 1} (ID: ${row.id || 'N/A'})`);
    lines.push('================================================================================');
    
    const fieldOrder = [
      'id', 'name', 'address', 'place_id', 'region', 'kosher', 'phone', 
      'website', 'opening_hours', 'is_open', 'lat', 'lng', 'geometry', 'offers'
    ];
    
    const writtenFields = new Set();
    fieldOrder.forEach(field => {
      if (row.hasOwnProperty(field)) {
        const value = row[field];
        const displayValue = value === null || value === undefined ? '[NULL]' : value;
        lines.push(`${field.padEnd(20)} : ${displayValue}`);
        writtenFields.add(field);
      }
    });
    
    Object.keys(row).forEach(field => {
      if (!writtenFields.has(field)) {
        const value = row[field];
        const displayValue = value === null || value === undefined ? '[NULL]' : value;
        lines.push(`${field.padEnd(20)} : ${displayValue}`);
      }
    });
    
    lines.push('');
  });
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`✓ Updated ${filePath} with ${rows.length} entries`);
}

async function removeAndUpdate() {
  console.log('='.repeat(80));
  console.log('REMOVING WINE SHOPS AND UPDATING DATABASE');
  console.log('='.repeat(80));
  
  // Parse current file
  console.log('\nReading wine_shops_data_cleaned.txt...');
  const rows = parseCleanedFile('wine_shops_data_cleaned.txt');
  console.log(`✓ Found ${rows.length} entries`);
  
  // Filter out IDs to remove
  const filtered = rows.filter(row => !idsToRemove.includes(row.id));
  const removed = rows.filter(row => idsToRemove.includes(row.id));
  
  console.log(`\nRemoved ${removed.length} entries from file`);
  console.log(`Remaining: ${filtered.length} entries`);
  
  // Write updated file
  writeCleanedFile('wine_shops_data_cleaned.txt', filtered, 'wine_shops');
  
  // Delete from database
  console.log(`\n${'='.repeat(80)}`);
  console.log('UPDATING DATABASE');
  console.log('='.repeat(80));
  
  console.log(`\nDeleting ${idsToRemove.length} entries from database...`);
  
  // Delete in batches
  const batchSize = 50;
  let deletedCount = 0;
  
  for (let i = 0; i < idsToRemove.length; i += batchSize) {
    const batch = idsToRemove.slice(i, i + batchSize);
    const { error } = await supabase
      .from('wine_shops')
      .delete()
      .in('id', batch);
    
    if (error) {
      console.error(`Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
    } else {
      deletedCount += batch.length;
      console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} entries (${deletedCount}/${idsToRemove.length})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✓ Deleted ${deletedCount} entries from database`);
  
  // Verify final count
  const { count, error: finalError } = await supabase
    .from('wine_shops')
    .select('*', { count: 'exact', head: true });
  
  if (finalError) {
    console.error('Error verifying final count:', finalError);
  } else {
    const finalCount = count || 0;
    console.log(`\n✓ Final count in database: ${finalCount} entries`);
    console.log(`✓ Expected count: ${filtered.length} entries`);
    
    if (finalCount === filtered.length) {
      console.log('✅ Counts match!');
    } else {
      console.log(`⚠ Count mismatch: ${Math.abs(finalCount - filtered.length)} difference`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ COMPLETE!');
  console.log('='.repeat(80));
}

removeAndUpdate().catch(console.error);
