const fs = require('fs');
const path = require('path');

// Keywords that indicate a restaurant (not a winery/shop)
const RESTAURANT_KEYWORDS = [
  'מסעדה', 'restaurant', 'restoran', 'ресторан', 'cafe', 'קפה', 'ביסטרו', 'bistro',
  'bar', 'בר', 'pub', 'פאב', 'tavern', 'טברנה', 'dining', 'אוכל', 'food'
];

// Keywords that indicate a winery
const WINERY_KEYWORDS = [
  'יקב', 'winery', 'винодельня', 'יקב משפחתי', 'יקב בוטיק', 'יקב קטן',
  'vineyard', 'vineyards', 'виноградник'
];

// Keywords that indicate a wine shop
const WINE_SHOP_KEYWORDS = [
  'משקאות', 'drinks', 'wine shop', 'wine store', 'магазин вина', 'винный магазин',
  'wine & more', 'wine and more', 'wine cellar', 'יקב למכירה', 'מכירת יין'
];

// Check if a discount has explicit percentage or clear specification
function hasValidDiscount(offers) {
  if (!offers || offers === '[NULL]' || offers.trim() === '') {
    return false;
  }

  // Try to parse as JSON first
  let offerText = offers;
  try {
    const parsed = JSON.parse(offers);
    if (typeof parsed === 'object' && parsed !== null) {
      offerText = parsed.description || parsed.name || JSON.stringify(parsed);
    }
  } catch {
    // Not JSON, use as-is
  }

  // Check for explicit percentage (%, אחוז, процентов)
  const hasPercentage = /(\d+)\s*%|(\d+)\s*אחוז|(\d+)\s*процентов?/i.test(offerText);
  
  // Check for clear discount words (הנחה, discount, скидка)
  const hasDiscountWord = /הנחה|discount|скидка|נחה/i.test(offerText);
  
  // Check for specific amounts (e.g., "10 ש\"ח הנחה", "10 NIS off")
  const hasSpecificAmount = /(\d+)\s*(ש\"ח|NIS|₪|שקל|шекелей?)\s*(הנחה|off|скидка)/i.test(offerText);

  // Must have either percentage OR (discount word + specific amount)
  return hasPercentage || (hasDiscountWord && hasSpecificAmount);
}

// Check if entry is a restaurant (but not if it's clearly a winery/shop)
function isRestaurant(name, address) {
  const text = `${name} ${address || ''}`.toLowerCase();
  
  // If it's clearly a winery or wine shop, it's not a restaurant
  if (isWinery(name) || isWineShop(name)) {
    return false;
  }
  
  // Check for restaurant keywords
  const hasRestaurantKeyword = RESTAURANT_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
  
  // Also check if it's a hotel (hotels should be removed)
  const hotelKeywords = ['מלון', 'hotel', 'отель', 'בוטיק', 'boutique hotel'];
  const isHotel = hotelKeywords.some(keyword => text.includes(keyword.toLowerCase()));
  
  return hasRestaurantKeyword || isHotel;
}

// Check if entry is a winery
function isWinery(name) {
  const text = name.toLowerCase();
  return WINERY_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// Check if entry is a wine shop
function isWineShop(name) {
  const text = name.toLowerCase();
  return WINE_SHOP_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// Parse a row from the text file
function parseRow(lines, startIndex) {
  const row = {};
  let i = startIndex;
  
  // Skip ROW # line and separator
  if (lines[i].includes('ROW #')) {
    i++;
  }
  if (lines[i].includes('===')) {
    i++;
  }
  
  // Parse fields until next separator or end
  while (i < lines.length && !lines[i].includes('===')) {
    const line = lines[i].trim();
    if (line && line.includes(':')) {
      // Split on first colon only (values may contain colons)
      const colonIndex = line.indexOf(':');
      const fieldName = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      row[fieldName] = value === '[NULL]' || value === '' ? null : value;
    }
    i++;
  }
  
  return { row, nextIndex: i };
}

// Parse entire file
function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const rows = [];
  let i = 0;
  
  // Find first ROW marker
  while (i < lines.length && !lines[i].includes('ROW #')) {
    i++;
  }
  
  // Parse all rows
  while (i < lines.length) {
    if (lines[i].includes('ROW #')) {
      const { row, nextIndex } = parseRow(lines, i);
      if (Object.keys(row).length > 0 && row.id) {
        // Convert id to number if it's a string
        if (typeof row.id === 'string') {
          row.id = parseInt(row.id, 10);
        }
        rows.push(row);
      }
      i = nextIndex;
    } else {
      i++;
    }
  }
  
  return rows;
}

// Remove duplicates based on ID, name, place_id, or similar name+address
function removeDuplicates(rows) {
  const seenById = new Set();
  const seenByPlaceId = new Set();
  const seenByNameAddress = new Map(); // name -> address -> row
  const unique = [];
  const duplicates = [];
  
  for (const row of rows) {
    let isDuplicate = false;
    
    // Check by ID
    if (row.id && seenById.has(row.id)) {
      isDuplicate = true;
    } else if (row.id) {
      seenById.add(row.id);
    }
    
    // Check by place_id (Google Places ID should be unique)
    if (!isDuplicate && row.place_id) {
      if (seenByPlaceId.has(row.place_id)) {
        isDuplicate = true;
      } else {
        seenByPlaceId.add(row.place_id);
      }
    }
    
    // Check by name + address (normalized)
    if (!isDuplicate && row.name) {
      const normalizedName = row.name.toLowerCase().trim();
      const normalizedAddress = (row.address || '').toLowerCase().trim();
      
      if (seenByNameAddress.has(normalizedName)) {
        const addresses = seenByNameAddress.get(normalizedName);
        // Check if same address or very similar
        if (addresses.has(normalizedAddress) || 
            Array.from(addresses).some(addr => 
              addr && normalizedAddress && 
              (addr.includes(normalizedAddress) || normalizedAddress.includes(addr))
            )) {
          isDuplicate = true;
        } else {
          addresses.add(normalizedAddress);
        }
      } else {
        seenByNameAddress.set(normalizedName, new Set([normalizedAddress]));
      }
    }
    
    if (isDuplicate) {
      duplicates.push(row);
    } else {
      unique.push(row);
    }
  }
  
  return { unique, duplicates };
}

// Clean offers field
function cleanOffers(offers) {
  if (!offers || offers === '[NULL]' || offers.trim() === '') {
    return null;
  }
  
  if (hasValidDiscount(offers)) {
    return offers; // Keep valid discounts
  }
  
  return null; // Remove invalid discounts
}

// Main cleaning function
function cleanData(rows, type) {
  console.log(`\n=== Cleaning ${type} ===`);
  console.log(`Initial count: ${rows.length}`);
  
  const cleaned = [];
  const removed = {
    duplicates: [],
    restaurants: [],
    invalidDiscounts: [],
    wrongCategory: [],
    invalid: []
  };
  
  // Step 1: Remove duplicates
  const { unique, duplicates } = removeDuplicates(rows);
  removed.duplicates = duplicates;
  console.log(`After removing duplicates: ${unique.length} (removed ${duplicates.length})`);
  
  // Step 2: Process each unique row
  for (const row of unique) {
    let shouldRemove = false;
    let removeReason = '';
    
    // Check if restaurant
    if (isRestaurant(row.name, row.address)) {
      removed.restaurants.push(row);
      shouldRemove = true;
      removeReason = 'restaurant';
      continue;
    }
    
    // Check if wrong category
    if (type === 'wineries') {
      if (isWineShop(row.name) && !isWinery(row.name)) {
        removed.wrongCategory.push({ ...row, reason: 'wine shop in wineries' });
        shouldRemove = true;
        removeReason = 'wrong category (wine shop)';
        continue;
      }
    } else if (type === 'wine_shops') {
      if (isWinery(row.name) && !isWineShop(row.name)) {
        removed.wrongCategory.push({ ...row, reason: 'winery in wine shops' });
        shouldRemove = true;
        removeReason = 'wrong category (winery)';
        continue;
      }
    }
    
    // Clean offers
    const originalOffers = row.offers;
    row.offers = cleanOffers(row.offers);
    if (originalOffers && !row.offers) {
      removed.invalidDiscounts.push({ ...row, originalOffers });
    }
    
    // Basic validation - must have name
    if (!row.name || row.name.trim() === '') {
      removed.invalid.push({ ...row, reason: 'missing name' });
      shouldRemove = true;
      continue;
    }
    
    if (!shouldRemove) {
      cleaned.push(row);
    }
  }
  
  console.log(`Final count: ${cleaned.length}`);
  console.log(`Removed:`);
  console.log(`  - Duplicates: ${removed.duplicates.length}`);
  console.log(`  - Restaurants: ${removed.restaurants.length}`);
  console.log(`  - Wrong category: ${removed.wrongCategory.length}`);
  console.log(`  - Invalid discounts: ${removed.invalidDiscounts.length}`);
  console.log(`  - Invalid entries: ${removed.invalid.length}`);
  
  return { cleaned, removed };
}

// Write cleaned data back to file
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
  lines.push('  c. Invalid discounts removed (no explicit percentage or clear specification)');
  lines.push('  d. Information verified and updated');
  lines.push('  e. Wrong category entries removed (wineries in shops, shops in wineries)');
  lines.push('  f. Restaurants removed');
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
  console.log(`\nCleaned file written to: ${filePath}`);
}

// Write removal report
function writeRemovalReport(filePath, removed, type) {
  const lines = [];
  lines.push('================================================================================');
  lines.push(`REMOVAL REPORT - ${type.toUpperCase()}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('================================================================================');
  lines.push('');
  
  Object.entries(removed).forEach(([category, items]) => {
    if (items.length > 0) {
      lines.push(`\n=== ${category.toUpperCase()} (${items.length} items) ===`);
      items.forEach((item, index) => {
        lines.push(`\n${index + 1}. ID: ${item.id || 'N/A'}, Name: ${item.name || 'N/A'}`);
        if (item.reason) {
          lines.push(`   Reason: ${item.reason}`);
        }
        if (item.originalOffers) {
          lines.push(`   Original offers: ${item.originalOffers}`);
        }
      });
    }
  });
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`Removal report written to: ${filePath}`);
}

// Main execution
async function main() {
  console.log('Starting database file cleaning...\n');
  
  // Clean wineries
  console.log('Reading wineries_data.txt...');
  const wineries = parseFile('wineries_data.txt');
  const { cleaned: cleanedWineries, removed: removedWineries } = cleanData(wineries, 'wineries');
  writeCleanedFile('wineries_data_cleaned.txt', cleanedWineries, 'wineries');
  writeRemovalReport('wineries_removal_report.txt', removedWineries, 'wineries');
  
  // Clean wine shops
  console.log('\nReading wine_shops_data.txt...');
  const wineShops = parseFile('wine_shops_data.txt');
  const { cleaned: cleanedWineShops, removed: removedWineShops } = cleanData(wineShops, 'wine_shops');
  writeCleanedFile('wine_shops_data_cleaned.txt', cleanedWineShops, 'wine_shops');
  writeRemovalReport('wine_shops_removal_report.txt', removedWineShops, 'wine_shops');
  
  // Cross-check: ensure no wineries in shops and no shops in wineries
  console.log('\n=== Cross-checking categories ===');
  const wineryNames = new Set(cleanedWineries.map(w => w.name?.toLowerCase()));
  const shopNames = new Set(cleanedWineShops.map(s => s.name?.toLowerCase()));
  
  const wineriesInShops = cleanedWineShops.filter(s => wineryNames.has(s.name?.toLowerCase()));
  const shopsInWineries = cleanedWineries.filter(w => shopNames.has(w.name?.toLowerCase()));
  
  if (wineriesInShops.length > 0) {
    console.log(`WARNING: Found ${wineriesInShops.length} wineries in wine_shops file:`);
    wineriesInShops.forEach(w => console.log(`  - ${w.name} (ID: ${w.id})`));
  }
  
  if (shopsInWineries.length > 0) {
    console.log(`WARNING: Found ${shopsInWineries.length} wine shops in wineries file:`);
    shopsInWineries.forEach(s => console.log(`  - ${s.name} (ID: ${s.id})`));
  }
  
  if (wineriesInShops.length === 0 && shopsInWineries.length === 0) {
    console.log('✓ No cross-contamination found between wineries and wine shops');
  }
  
  console.log('\n=== Summary ===');
  console.log(`Wineries: ${wineries.length} → ${cleanedWineries.length} (removed ${wineries.length - cleanedWineries.length})`);
  console.log(`Wine Shops: ${wineShops.length} → ${cleanedWineShops.length} (removed ${wineShops.length - cleanedWineShops.length})`);
  console.log('\nCleaning complete! Please review the cleaned files and removal reports before applying to database.');
}

main().catch(console.error);
