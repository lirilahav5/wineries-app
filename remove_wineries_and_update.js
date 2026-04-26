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
  340, 341, 342, 343, 361, 365, 367, 374, 377, 380, 381, 385, 388, 390, 
  393, 394, 395, 396, 397, 398, 399, 400, 401, 402
];

// Add range 402-530
for (let i = 403; i <= 530; i++) {
  idsToRemove.push(i);
}

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
  console.log('REMOVING WINERIES AND UPDATING DATABASE');
  console.log('='.repeat(80));
  
  // Parse current file
  console.log('\nReading wineries_data_cleaned.txt...');
  const rows = parseCleanedFile('wineries_data_cleaned.txt');
  console.log(`✓ Found ${rows.length} entries`);
  
  // Filter out IDs to remove
  const filtered = rows.filter(row => !idsToRemove.includes(row.id));
  const removed = rows.filter(row => idsToRemove.includes(row.id));
  
  console.log(`\nRemoved ${removed.length} entries`);
  console.log(`Remaining: ${filtered.length} entries`);
  
  // Write updated file
  writeCleanedFile('wineries_data_cleaned.txt', filtered, 'wineries');
  
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
      .from('wineries')
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
    .from('wineries')
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
