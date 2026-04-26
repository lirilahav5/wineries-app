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

// Path to manual offers JSON file
const MANUAL_OFFERS_FILE = path.join(__dirname, 'manual_offers.json');

/**
 * Load manual offers from JSON file
 */
function loadManualOffers() {
  try {
    if (fs.existsSync(MANUAL_OFFERS_FILE)) {
      const data = fs.readFileSync(MANUAL_OFFERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading manual offers:', error.message);
  }
  return { wineries: {}, shops: {} };
}

/**
 * Method 1: Check manual offers database (JSON file)
 */
function checkManualOffers(shopName) {
  const manualOffers = loadManualOffers();
  if (manualOffers.shops && manualOffers.shops[shopName]) {
    const offer = manualOffers.shops[shopName];
    return typeof offer === 'string' ? offer : JSON.stringify(offer);
  }
  return null;
}

/**
 * Method 2: Web scraping - Check shop website for offers
 */
async function checkWebsiteOffers(shop) {
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
    
    // Hebrew keywords for offers
    const offerKeywords = [
      'מבצע', 'הצעות', 'הנחה', 'הנחות', 'sale', 'discount', 'promotion', 
      'special', 'offer', 'offers', 'deal', 'deals', '%', 'percent'
    ];
    
    // Check if page contains offer keywords
    const hasOfferKeywords = offerKeywords.some(keyword => pageText.includes(keyword));
    
    if (hasOfferKeywords) {
      // Try to extract offer text
      let offerText = '';
      
      // Look for common offer containers
      const offerSelectors = [
        '.offer', '.promotion', '.sale', '.discount', '.deal',
        '[class*="offer"]', '[class*="promotion"]', '[class*="sale"]',
        '[id*="offer"]', '[id*="promotion"]', '[id*="sale"]'
      ];
      
      for (const selector of offerSelectors) {
        const element = $(selector).first();
        if (element.length) {
          offerText = element.text().trim();
          if (offerText.length > 10 && offerText.length < 500) {
            break;
          }
        }
      }
      
      // If no specific container found, look for text near keywords
      if (!offerText) {
        $('p, div, span, h1, h2, h3, h4').each(function() {
          const text = $(this).text().toLowerCase();
          if (offerKeywords.some(kw => text.includes(kw))) {
            const fullText = $(this).text().trim();
            if (fullText.length > 10 && fullText.length < 500) {
              offerText = fullText;
              return false; // break
            }
          }
        });
      }
      
      if (offerText) {
        return JSON.stringify({
          name: 'מבצע מיוחד!',
          description: offerText.substring(0, 300)
        });
      }
    }
    
    return null;
  } catch (error) {
    // Silently fail - website might be down or inaccessible
    return null;
  }
}

/**
 * Method 3: Google Places API - Check for current promotions
 */
async function checkGooglePlacesOffers(shop) {
  if (!shop.place_id || !googlePlacesKey) return null;
  
  try {
    // Get place details
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: shop.place_id,
        fields: 'name,current_opening_hours,editorial_summary,reviews',
        key: googlePlacesKey,
        language: 'he'
      }
    });
    
    if (response.data.result) {
      const place = response.data.result;
      
      // Check reviews for mentions of offers/promotions
      if (place.reviews) {
        for (const review of place.reviews) {
          const reviewText = review.text.toLowerCase();
          const offerKeywords = ['מבצע', 'הנחה', 'sale', 'discount', 'promotion', 'offer'];
          
          if (offerKeywords.some(keyword => reviewText.includes(keyword))) {
            // Extract relevant part of review
            const sentences = review.text.split(/[.!?]/);
            const offerSentence = sentences.find(s => 
              offerKeywords.some(kw => s.toLowerCase().includes(kw))
            );
            
            if (offerSentence) {
              return JSON.stringify({
                name: 'מבצע מיוחד!',
                description: offerSentence.trim()
              });
            }
          }
        }
      }
      
      // Check editorial summary
      if (place.editorial_summary && place.editorial_summary.overview) {
        const summary = place.editorial_summary.overview.toLowerCase();
        const offerKeywords = ['מבצע', 'הנחה', 'sale', 'discount', 'promotion'];
        
        if (offerKeywords.some(keyword => summary.includes(keyword))) {
          return JSON.stringify({
            name: 'מבצע מיוחד!',
            description: place.editorial_summary.overview.substring(0, 300)
          });
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
 * Method 4: External API integration (example - you can add your own APIs)
 */
async function checkExternalAPIOffers(shop) {
  // Example: Check a wine deals API (replace with actual API)
  // const apiUrl = 'https://api.example.com/wine-deals';
  // try {
  //   const response = await axios.get(apiUrl, {
  //     params: { shop_name: shop.name }
  //   });
  //   if (response.data.offers && response.data.offers.length > 0) {
  //     return JSON.stringify(response.data.offers[0]);
  //   }
  // } catch (error) {
  //   console.error('External API error:', error.message);
  // }
  
  return null;
}

/**
 * Main function to check for offers using all methods
 * Tries methods in order of priority
 */
async function checkWineShopOffers(shop) {
  // Method 1: Check manual offers first (highest priority)
  const manualOffer = checkManualOffers(shop.name);
  if (manualOffer) {
    return manualOffer;
  }
  
  // Method 2: Check Google Places API
  const googleOffer = await checkGooglePlacesOffers(shop);
  if (googleOffer) {
    return googleOffer;
  }
  
  // Method 3: Check website
  const websiteOffer = await checkWebsiteOffers(shop);
  if (websiteOffer) {
    return websiteOffer;
  }
  
  // Method 4: Check external APIs
  const apiOffer = await checkExternalAPIOffers(shop);
  if (apiOffer) {
    return apiOffer;
  }
  
  // No offer found
  return null;
}

/**
 * Update offers for all wine shops in the database
 */
async function updateWineShopsOffers() {
  console.log('Starting wine shops offers update...');
  console.log('Using methods: Manual Offers → Google Places → Website Scraping → External APIs\n');
  
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
    let removed = 0;
    let unchanged = 0;
    let errors = 0;
    
    // Process each shop
    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i];
      try {
        process.stdout.write(`[${i + 1}/${shops.length}] Checking ${shop.name}... `);
        
        const offer = await checkWineShopOffers(shop);
        
        // Update the shop's offers field
        const updateData = {
          offers: offer
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
        
        if (offer && !shop.offers) {
          console.log(`✓ Added offer`);
          updated++;
        } else if (offer && shop.offers !== offer) {
          console.log(`✓ Updated offer`);
          updated++;
        } else if (!offer && shop.offers) {
          console.log(`✗ Removed offer`);
          removed++;
        } else {
          console.log(`- No change`);
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
    console.log(`Updated/Added offers: ${updated}`);
    console.log(`Removed offers: ${removed}`);
    console.log(`Unchanged: ${unchanged}`);
    console.log(`Errors: ${errors}`);
    console.log('\nWine shops offers update completed!');
    
  } catch (error) {
    console.error('Error updating wine shops offers:', error);
    process.exit(1);
  }
}

// Run the update
updateWineShopsOffers();
