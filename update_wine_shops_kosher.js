require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googlePlacesKey = process.env.GOOGLE_PLACES_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Path to manual kosher database JSON file
const MANUAL_KOSHER_FILE = path.join(__dirname, 'manual_kosher.json');

/**
 * Load manual kosher status from JSON file
 */
function loadManualKosher() {
  try {
    if (fs.existsSync(MANUAL_KOSHER_FILE)) {
      const data = fs.readFileSync(MANUAL_KOSHER_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading manual kosher database:', error.message);
  }
  return { wineries: {}, shops: {} };
}

/**
 * Method 1: Check manual kosher database (JSON file)
 */
function checkManualKosher(shopName) {
  const manualKosher = loadManualKosher();
  if (manualKosher.shops && manualKosher.shops.hasOwnProperty(shopName)) {
    return manualKosher.shops[shopName] === true;
  }
  return null; // Unknown - not in manual database
}

/**
 * Method 2: Web scraping - Check shop website for kosher certification
 */
async function checkWebsiteKosher(shop) {
  if (!shop.website) return null;
  
  try {
    // Normalize website URL
    let url = shop.website;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const pageText = $('body').text().toLowerCase();
    
    // Hebrew and English keywords for kosher
    const kosherKeywords = [
      'כשר', 'כשרות', 'kosher', 'kashrut', 'badatz', 'רבנות', 
      'רבני', 'אושר', 'הכשר', 'mehadrin', 'מהדרין'
    ];
    
    // Check if page contains kosher keywords
    const hasKosherKeywords = kosherKeywords.some(keyword => pageText.includes(keyword));
    
    if (hasKosherKeywords) {
      // Look for kosher certification images/logos
      const kosherImages = $('img[src*="kosher"], img[src*="כשר"], img[alt*="kosher"], img[alt*="כשר"]');
      if (kosherImages.length > 0) {
        return true;
      }
      
      // Check for kosher certification text in specific sections
      const kosherSelectors = [
        '.kosher', '.kashrut', '.כשר', '.כשרות',
        '[class*="kosher"]', '[class*="kashrut"]',
        '[id*="kosher"]', '[id*="kashrut"]'
      ];
      
      for (const selector of kosherSelectors) {
        const element = $(selector);
        if (element.length) {
          return true;
        }
      }
      
      // If keywords found but no specific certification, return true (likely kosher)
      return true;
    }
    
    // Check for explicit non-kosher indicators
    const nonKosherKeywords = ['לא כשר', 'non-kosher', 'not kosher'];
    if (nonKosherKeywords.some(keyword => pageText.includes(keyword))) {
      return false;
    }
    
    return null; // Unknown
  } catch (error) {
    // Silently fail - website might be down or inaccessible
    return null;
  }
}

/**
 * Method 3: Google Places API - Check for kosher information
 */
async function checkGooglePlacesKosher(shop) {
  if (!shop.place_id || !googlePlacesKey) return null;
  
  try {
    // Get place details
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: shop.place_id,
        fields: 'name,editorial_summary,reviews',
        key: googlePlacesKey,
        language: 'he'
      }
    });
    
    if (response.data.result) {
      const place = response.data.result;
      
      // Check reviews for kosher mentions
      if (place.reviews) {
        for (const review of place.reviews) {
          const reviewText = review.text.toLowerCase();
          const kosherKeywords = ['כשר', 'kosher', 'kashrut'];
          const nonKosherKeywords = ['לא כשר', 'non-kosher'];
          
          if (nonKosherKeywords.some(keyword => reviewText.includes(keyword))) {
            return false;
          }
          
          if (kosherKeywords.some(keyword => reviewText.includes(keyword))) {
            return true;
          }
        }
      }
      
      // Check editorial summary
      if (place.editorial_summary && place.editorial_summary.overview) {
        const summary = place.editorial_summary.overview.toLowerCase();
        const kosherKeywords = ['כשר', 'kosher'];
        const nonKosherKeywords = ['לא כשר', 'non-kosher'];
        
        if (nonKosherKeywords.some(keyword => summary.includes(keyword))) {
          return false;
        }
        
        if (kosherKeywords.some(keyword => summary.includes(keyword))) {
          return true;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error checking Google Places for ${shop.name}:`, error.message);
    return null;
  }
}

/**
 * Main function to check kosher status using all methods
 * Returns: true (kosher), false (not kosher), or null (unknown)
 */
async function checkWineShopKosher(shop) {
  // Method 1: Check manual database first (highest priority)
  const manualKosher = checkManualKosher(shop.name);
  if (manualKosher !== null) {
    return manualKosher;
  }
  
  // Method 2: Check Google Places API
  const googleKosher = await checkGooglePlacesKosher(shop);
  if (googleKosher !== null) {
    return googleKosher;
  }
  
  // Method 3: Check website
  const websiteKosher = await checkWebsiteKosher(shop);
  if (websiteKosher !== null) {
    return websiteKosher;
  }
  
  // Unknown - return null (don't update)
  return null;
}

/**
 * Update kosher status for all wine shops in the database
 */
async function updateWineShopsKosher() {
  console.log('Starting wine shops kosher status update...');
  console.log('Using methods: Manual Database → Google Places → Website Scraping\n');
  
  try {
    // Fetch all wine shops
    const { data: shops, error: fetchError } = await supabase
      .from('wine_shops')
      .select('*');
    
    if (fetchError) {
      throw new Error(`Failed to fetch wine shops: ${fetchError.message}`);
    }
    
    if (!shops || shops.length === 0) {
      console.log('No wine shops found in database');
      return;
    }
    
    console.log(`Found ${shops.length} wine shops to check\n`);
    
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    
    // Process each shop
    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i];
      try {
        process.stdout.write(`[${i + 1}/${shops.length}] Checking ${shop.name}... `);
        
        const kosherStatus = await checkWineShopKosher(shop);
        
        // Only update if we got a definitive answer (true or false)
        if (kosherStatus !== null) {
          const updateData = {
            kosher: kosherStatus
          };
          
          const { error: updateError } = await supabase
            .from('wine_shops')
            .update(updateData)
            .eq('id', shop.id);
          
          if (updateError) {
            console.log(`✗ Error: ${updateError.message}`);
            errors++;
            continue;
          }
          
          if (kosherStatus !== shop.kosher) {
            console.log(`✓ Updated: ${kosherStatus ? 'כשר' : 'לא כשר'}`);
            updated++;
          } else {
            console.log(`- No change (${kosherStatus ? 'כשר' : 'לא כשר'})`);
            unchanged++;
          }
        } else {
          console.log(`- Unknown (keeping current: ${shop.kosher ? 'כשר' : shop.kosher === false ? 'לא כשר' : 'לא ידוע'})`);
          unchanged++;
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`✗ Error: ${error.message}`);
        errors++;
        continue;
      }
    }
    
    console.log('\n=== Update Summary ===');
    console.log(`Total wine shops: ${shops.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Unchanged: ${unchanged}`);
    console.log(`Errors: ${errors}`);
    console.log('\nWine shops kosher status update completed!');
    
  } catch (error) {
    console.error('Error updating wine shops kosher status:', error);
    process.exit(1);
  }
}

// Run the update
updateWineShopsKosher();
