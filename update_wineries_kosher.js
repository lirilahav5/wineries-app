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
function checkManualKosher(wineryName) {
  const manualKosher = loadManualKosher();
  if (manualKosher.wineries && manualKosher.wineries.hasOwnProperty(wineryName)) {
    return manualKosher.wineries[wineryName] === true;
  }
  return null; // Unknown - not in manual database
}

/**
 * Method 2: Web scraping - Check winery website for kosher certification
 */
async function checkWebsiteKosher(winery) {
  if (!winery.website) return null;
  
  try {
    // Normalize website URL
    let url = winery.website;
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
async function checkGooglePlacesKosher(winery) {
  if (!winery.place_id || !googlePlacesKey) return null;
  
  try {
    // Get place details
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: winery.place_id,
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
    console.error(`Error checking Google Places for ${winery.name}:`, error.message);
    return null;
  }
}

/**
 * Main function to check kosher status using all methods
 * Returns: true (kosher), false (not kosher), or null (unknown)
 */
async function checkWineryKosher(winery) {
  // Method 1: Check manual database first (highest priority)
  const manualKosher = checkManualKosher(winery.name);
  if (manualKosher !== null) {
    return manualKosher;
  }
  
  // Method 2: Check Google Places API
  const googleKosher = await checkGooglePlacesKosher(winery);
  if (googleKosher !== null) {
    return googleKosher;
  }
  
  // Method 3: Check website
  const websiteKosher = await checkWebsiteKosher(winery);
  if (websiteKosher !== null) {
    return websiteKosher;
  }
  
  // Unknown - return null (don't update)
  return null;
}

/**
 * Update kosher status for all wineries in the database
 */
async function updateWineriesKosher() {
  console.log('Starting wineries kosher status update...');
  console.log('Using methods: Manual Database → Google Places → Website Scraping\n');
  
  try {
    // Fetch all wineries
    const { data: wineries, error: fetchError } = await supabase
      .from('wineries')
      .select('*');
    
    if (fetchError) {
      throw new Error(`Failed to fetch wineries: ${fetchError.message}`);
    }
    
    if (!wineries || wineries.length === 0) {
      console.log('No wineries found in database');
      return;
    }
    
    console.log(`Found ${wineries.length} wineries to check\n`);
    
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    
    // Process each winery
    for (let i = 0; i < wineries.length; i++) {
      const winery = wineries[i];
      try {
        process.stdout.write(`[${i + 1}/${wineries.length}] Checking ${winery.name}... `);
        
        const kosherStatus = await checkWineryKosher(winery);
        
        // Only update if we got a definitive answer (true or false)
        if (kosherStatus !== null) {
          const updateData = {
            kosher: kosherStatus
          };
          
          const { error: updateError } = await supabase
            .from('wineries')
            .update(updateData)
            .eq('id', winery.id);
          
          if (updateError) {
            console.log(`✗ Error: ${updateError.message}`);
            errors++;
            continue;
          }
          
          if (kosherStatus !== winery.kosher) {
            console.log(`✓ Updated: ${kosherStatus ? 'כשר' : 'לא כשר'}`);
            updated++;
          } else {
            console.log(`- No change (${kosherStatus ? 'כשר' : 'לא כשר'})`);
            unchanged++;
          }
        } else {
          console.log(`- Unknown (keeping current: ${winery.kosher ? 'כשר' : winery.kosher === false ? 'לא כשר' : 'לא ידוע'})`);
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
    console.log(`Total wineries: ${wineries.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Unchanged: ${unchanged}`);
    console.log(`Errors: ${errors}`);
    console.log('\nWineries kosher status update completed!');
    
  } catch (error) {
    console.error('Error updating wineries kosher status:', error);
    process.exit(1);
  }
}

// Run the update
updateWineriesKosher();
