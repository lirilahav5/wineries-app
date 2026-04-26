require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Supabase connection - using service_role key for full permissions
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Parse cleaned file to get IDs that should remain
function parseCleanedFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const ids = new Set();
  let currentId = null;
  
  for (const line of lines) {
    if (line.includes('ROW #') && line.includes('ID:')) {
      const match = line.match(/ID:\s*(\d+)/);
      if (match) {
        currentId = parseInt(match[1], 10);
      }
    } else if (line.trim().startsWith('id') && line.includes(':')) {
      const match = line.match(/id\s*:\s*(\d+)/);
      if (match) {
        currentId = parseInt(match[1], 10);
        ids.add(currentId);
      }
    }
  }
  
  return ids;
}

// Parse removal report to get IDs that should be deleted
function parseRemovalReport(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const ids = new Set();
  
  for (const line of lines) {
    // Look for "ID: X, Name: ..." pattern
    const match = line.match(/ID:\s*(\d+)/);
    if (match) {
      ids.add(parseInt(match[1], 10));
    }
  }
  
  return ids;
}

// Parse cleaned file to get the actual row data
function parseCleanedRows(filePath) {
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
      // End of row
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
      
      // Convert types
      if (fieldName === 'id' && value) {
        currentRow[fieldName] = parseInt(value, 10);
      } else if ((fieldName === 'lat' || fieldName === 'lng') && value) {
        currentRow[fieldName] = parseFloat(value);
      } else if (fieldName === 'kosher' && value !== null) {
        currentRow[fieldName] = value === 'true';
      } else if (fieldName === 'is_open' && value !== null) {
        currentRow[fieldName] = value === 'true';
      } else {
        currentRow[fieldName] = value;
      }
    }
  }
  
  // Add last row if exists
  if (currentRow && currentRow.id) {
    rows.push(currentRow);
  }
  
  return rows;
}

// Update database
async function updateDatabase(tableName, cleanedFile, removalReport) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`UPDATING ${tableName.toUpperCase()} TABLE`);
  console.log('='.repeat(80));
  
  // Get IDs that should remain
  const keptIds = parseCleanedFile(cleanedFile);
  console.log(`\n✓ Found ${keptIds.size} entries to keep in cleaned file`);
  
  // Get IDs that should be deleted (optional - from removal report if it exists)
  let removedIds = new Set();
  if (removalReport && fs.existsSync(removalReport)) {
    removedIds = parseRemovalReport(removalReport);
    console.log(`✓ Found ${removedIds.size} entries to delete from removal report`);
  } else {
    console.log(`⚠ Removal report not found, will determine deletions from cleaned file only`);
  }
  
  // Get all current IDs from database
  console.log('\nFetching current data from database...');
  const { data: currentData, error: fetchError } = await supabase
    .from(tableName)
    .select('id');
  
  if (fetchError) {
    console.error('Error fetching current data:', fetchError);
    return;
  }
  
  const currentIds = new Set(currentData.map(row => row.id));
  console.log(`✓ Found ${currentIds.size} entries currently in database`);
  
  // Find IDs to delete (in database but not in kept list)
  const idsToDelete = Array.from(currentIds).filter(id => !keptIds.has(id));
  console.log(`\n📋 Will delete ${idsToDelete.length} entries`);
  
  // Delete entries
  if (idsToDelete.length > 0) {
    console.log('\nDeleting entries...');
    // Delete in batches to avoid overwhelming the database
    const batchSize = 50;
    let deletedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      const { error } = await supabase
        .from(tableName)
        .delete()
        .in('id', batch);
      
      if (error) {
        console.error(`Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error);
        errorCount += batch.length;
      } else {
        deletedCount += batch.length;
        console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} entries (${deletedCount}/${idsToDelete.length})`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✓ Deleted ${deletedCount} entries`);
    if (errorCount > 0) {
      console.log(`⚠ ${errorCount} entries had errors during deletion`);
    }
  } else {
    console.log('\n✓ No entries to delete');
  }
  
  // Update remaining entries (especially offers field)
  console.log('\n📋 Updating remaining entries...');
  const cleanedRows = parseCleanedRows(cleanedFile);
  console.log(`✓ Parsed ${cleanedRows.length} cleaned rows`);
  
  // Update in batches
  const batchSize = 20;
  let updatedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < cleanedRows.length; i += batchSize) {
    const batch = cleanedRows.slice(i, i + batchSize);
    
    for (const row of batch) {
      const updateData = {
        offers: row.offers || null
      };
      
      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', row.id);
      
      if (error) {
        console.error(`Error updating ID ${row.id}:`, error.message);
        errorCount++;
      } else {
        updatedCount++;
      }
    }
    
    console.log(`  Updated batch ${Math.floor(i / batchSize) + 1}: ${batch.length} entries (${updatedCount}/${cleanedRows.length})`);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n✓ Updated ${updatedCount} entries`);
  if (errorCount > 0) {
    console.log(`⚠ ${errorCount} entries had errors during update`);
  }
  
  // Verify final count
  const { data: finalData, error: finalError } = await supabase
    .from(tableName)
    .select('id');
  
  if (finalError) {
    console.error('Error verifying final count:', finalError);
  } else {
    console.log(`\n✓ Final count in database: ${finalData.length} entries`);
    console.log(`✓ Expected count: ${keptIds.size} entries`);
    
    if (finalData.length === keptIds.size) {
      console.log('✅ Counts match!');
    } else {
      console.log(`⚠ Count mismatch: ${Math.abs(finalData.length - keptIds.size)} difference`);
    }
  }
}

// Main execution
async function main() {
  console.log('='.repeat(80));
  console.log('DATABASE UPDATE WITH CLEANED DATA');
  console.log('='.repeat(80));
  console.log('\nThis script will:');
  console.log('1. Delete entries that were removed during cleaning');
  console.log('2. Update remaining entries (especially to remove invalid discounts)');
  console.log('\n⚠️  WARNING: This will permanently delete data from your database!');
  console.log('Make sure you have reviewed the cleaned files and removal reports.');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    // Update wineries
    await updateDatabase(
      'wineries',
      'wineries_data_cleaned.txt',
      'wineries_removal_report.txt'
    );
    
    // Update wine shops
    await updateDatabase(
      'wine_shops',
      'wine_shops_data_cleaned.txt',
      'wine_shops_removal_report.txt'
    );
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ DATABASE UPDATE COMPLETE!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n❌ Error during database update:', error);
    process.exit(1);
  }
}

main();
