// Helper function to detect Israeli wine regions from coordinates
// This can be used by all import scripts

function detectRegionFromCoordinates(lat, lng) {
  if (!lat || !lng) return null;

  // Convert to numbers if they're strings
  lat = typeof lat === 'string' ? parseFloat(lat) : lat;
  lng = typeof lng === 'string' ? parseFloat(lng) : lng;
  
  if (isNaN(lat) || isNaN(lng)) return null;

  // Check regions in order of specificity (most specific first)

  // Golan Heights (רמת הגולן) - very specific area
  if (lat >= 32.6 && lat <= 33.0 && lng >= 35.6 && lng <= 35.9) {
    return 'רמת הגולן';
  }

  // Upper Galilee (גליל עליון) - includes Safed, Kiryat Shmona
  if (lat >= 32.9 && lat <= 33.3 && lng >= 35.3 && lng <= 35.6) {
    return 'גליל';
  }

  // Lower Galilee (גליל תחתון) - includes Tiberias, Kfar Tavor
  // BUT exclude Haifa area (Haifa is ~32.8, 35.0)
  if (lat >= 32.5 && lat < 32.9 && lng >= 35.2 && lng <= 35.5) {
    // Exclude Haifa specifically (Haifa is around 32.8, 35.0)
    if (lat >= 32.75 && lat <= 32.85 && lng >= 34.95 && lng <= 35.05) {
      return 'שרון'; // Haifa is in Sharon region
    }
    return 'גליל';
  }

  // Haifa area specifically (32.75-32.85, 34.95-35.05) - North
  if (lat >= 32.75 && lat <= 32.85 && lng >= 34.95 && lng <= 35.05) {
    return 'צפון';
  }
  
  // Beit Shean area (32.5-32.6, 35.5-35.6) - North
  if (lat >= 32.5 && lat <= 32.6 && lng >= 35.5 && lng <= 35.6) {
    return 'צפון';
  }
  
  // Eilat area (29.5-29.6, 34.9-35.0) - South
  if (lat >= 29.5 && lat <= 29.6 && lng >= 34.9 && lng <= 35.0) {
    return 'דרום';
  }
  
  // Ashkelon area (31.65-31.7, 34.55-34.6) - South
  if (lat >= 31.65 && lat <= 31.7 && lng >= 34.55 && lng <= 34.6) {
    return 'דרום';
  }

  // Shomron/Samaria (שומרון)
  if (lat >= 32.0 && lat < 32.5 && lng >= 35.0 && lng <= 35.4) {
    return 'שומרון';
  }

  // Jerusalem area (ירושלים) - very specific
  if (lat >= 31.7 && lat <= 31.8 && lng >= 35.1 && lng <= 35.3) {
    return 'ירושלים';
  }

  // Judean Hills (הרי יהודה) - south of Jerusalem
  if (lat >= 31.5 && lat < 32.0 && lng >= 34.9 && lng <= 35.3) {
    return 'הרי יהודה';
  }

  // Sharon (שרון) - coastal plain north of Tel Aviv (but not Haifa)
  if (lat >= 32.2 && lat < 32.75 && lng >= 34.7 && lng <= 35.0) {
    return 'שרון';
  }
  
  // North (צפון) - includes Haifa, Beit Shean, and northern areas
  if (lat >= 32.5 && lat <= 33.0 && lng >= 35.0 && lng <= 35.6) {
    // Exclude Golan Heights (already handled above)
    if (!(lat >= 32.6 && lat <= 33.0 && lng >= 35.6 && lng <= 35.9)) {
      return 'צפון';
    }
  }

  // Central (מרכז) - Tel Aviv area and surroundings
  if (lat >= 31.9 && lat <= 32.2 && lng >= 34.6 && lng <= 35.0) {
    return 'מרכז';
  }

  // Negev (נגב) - STRICT: must be south of 31.5 latitude
  // Beer Sheva: ~31.25, Arad: ~31.26
  // Eilat is in South (דרום), not Negev
  // Haifa is 32.8, so it CANNOT match this
  if (lat >= 30.5 && lat < 31.5 && lng >= 34.5 && lng <= 35.5) {
    return 'נגב';
  }
  
  // South (דרום) - includes Eilat, Ashkelon, and southern coastal areas
  // Eilat: ~29.55, Ashkelon: ~31.67
  if (lat >= 29.0 && lat < 31.7 && lng >= 34.5 && lng <= 35.0) {
    // Exclude Negev cities (Beer Sheva, Arad, Dimona)
    if (!(lat >= 30.5 && lat < 31.5 && lng >= 34.5 && lng <= 35.5)) {
      return 'דרום';
    }
  }

  // Default fallback based on latitude (only if nothing else matched)
  if (lat >= 32.5) return 'צפון';
  if (lat >= 31.5) return 'מרכז';
  if (lat >= 30.0) return 'נגב';
  return 'דרום';
}

// City to region mapping (more accurate than street name matching)
const CITY_TO_REGION = {
  // Golan Heights
  'רמת הגולן': 'רמת הגולן',
  'רמת גולן': 'רמת הגולן',
  'golan heights': 'רמת הגולן',
  'golan': 'רמת הגולן',
  'קצרין': 'רמת הגולן',
  'qatzrin': 'רמת הגולן',
  
  // Galilee
  'צפת': 'גליל',
  'safed': 'גליל',
  'safat': 'גליל',
  'טבריה': 'גליל',
  'tiberias': 'גליל',
  'כפר תבור': 'גליל',
  'kfar tavor': 'גליל',
  'קרית שמונה': 'גליל',
  'kiryat shmona': 'גליל',
  'נהריה': 'גליל',
  'nahariya': 'גליל',
  'עכו': 'גליל',
  'akko': 'גליל',
  'עכו': 'גליל',
  'acre': 'גליל',
  
  // Shomron
  'אלון מורה': 'שומרון',
  'alon moreh': 'שומרון',
  'יצהר': 'שומרון',
  'itzhar': 'שומרון',
  'קדומים': 'שומרון',
  'kedumim': 'שומרון',
  'אריאל': 'שומרון',
  'ariel': 'שומרון',
  
  // Judean Hills
  'גוש עציון': 'הרי יהודה',
  'gush etzion': 'הרי יהודה',
  'אפרת': 'הרי יהודה',
  'efrat': 'הרי יהודה',
  'בית שמש': 'הרי יהודה',
  'beit shemesh': 'הרי יהודה',
  'מודיעין': 'הרי יהודה',
  'modiin': 'הרי יהודה',
  
  // Jerusalem
  'ירושלים': 'ירושלים',
  'jerusalem': 'ירושלים',
  'yerushalayim': 'ירושלים',
  
  // Sharon
  'נתניה': 'שרון',
  'netanya': 'שרון',
  'הרצליה': 'שרון',
  'herzliya': 'שרון',
  'רעננה': 'שרון',
  'raanana': 'שרון',
  'כפר סבא': 'שרון',
  'kfar saba': 'שרון',
  
  // North (צפון)
  'חיפה': 'צפון',
  'haifa': 'צפון',
  'בית שאן': 'צפון',
  'beit shean': 'צפון',
  'beit she\'an': 'צפון',
  
  // Central
  'תל אביב': 'מרכז',
  'tel aviv': 'מרכז',
  'tel-aviv': 'מרכז',
  'רמת גן': 'מרכז',
  'ramat gan': 'מרכז',
  'חולון': 'מרכז',
  'holon': 'מרכז',
  'בת ים': 'מרכז',
  'bat yam': 'מרכז',
  'ראשון לציון': 'מרכז',
  'rishon lezion': 'מרכז',
  'רחובות': 'מרכז',
  'rehovot': 'מרכז',
  
  // Negev
  'באר שבע': 'נגב',
  'beer sheva': 'נגב',
  'beer-sheva': 'נגב',
  'beersheba': 'נגב',
  'ערד': 'נגב',
  'arad': 'נגב',
  'דימונה': 'נגב',
  'dimona': 'נגב',
  'מצפה רמון': 'נגב',
  'mitzpe ramon': 'נגב',
  
  // South (דרום)
  'אילת': 'דרום',
  'eilat': 'דרום',
  'אשקלון': 'דרום',
  'ashkelon': 'דרום',
  'ashqelon': 'דרום'
};

function detectRegionFromAddress(address) {
  if (!address) return null;

  const addrLower = address.toLowerCase();
  
  // Split address into parts - city is usually the last part
  const addressParts = addrLower.split(',').map(part => part.trim());
  const lastPart = addressParts[addressParts.length - 1] || '';
  const secondLastPart = addressParts[addressParts.length - 2] || '';
  
  // Check city names in the CITY_TO_REGION mapping
  // Only match if it appears in the city position (last or second-to-last part)
  for (const [cityName, region] of Object.entries(CITY_TO_REGION)) {
    const cityLower = cityName.toLowerCase();
    
    // Check if city name appears in the last part (city position)
    if (lastPart.includes(cityLower) || secondLastPart.includes(cityLower)) {
      return region;
    }
  }
  
  // If no city match, return null (don't guess from street names)
  return null;

}

// Main function: prioritize coordinates over address (coordinates are more reliable)
function detectRegion(lat, lng, address) {
  // Always try coordinates first (more reliable, avoids street name false matches)
  const regionFromCoords = detectRegionFromCoordinates(lat, lng);
  if (regionFromCoords) return regionFromCoords;

  // Fall back to address only if coordinates don't give a result
  const regionFromAddr = detectRegionFromAddress(address);
  if (regionFromAddr) return regionFromAddr;

  return null;
}

// Export for use in Node.js scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectRegion, detectRegionFromCoordinates, detectRegionFromAddress };
}

