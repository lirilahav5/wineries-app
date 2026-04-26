import { Language } from '../contexts/LanguageContext';
import nameTranslationsData from '../data/nameTranslations.json';

// Combine wineries and shops translations into a single map
const nameTranslations: Record<string, { en?: string; ru?: string }> = {
  ...nameTranslationsData.wineries,
  ...nameTranslationsData.shops
};

/**
 * Check if a string contains Hebrew characters
 */
function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Translate a name based on the selected language
 * @param name - The original name (usually in Hebrew)
 * @param language - The target language
 * @returns The translated name, or the original name if no translation exists
 */
export function translateName(name: string, language: Language): string {
  // Handle empty or null names
  if (!name || name.trim() === '') {
    // Return default based on context - we'll need to pass type, but for now use generic
    return language === 'he' ? 'יקב' : language === 'ru' ? 'Винодельня' : 'Winery';
  }
  
  // Normalize the name - trim and clean up
  const normalizedName = name.trim();
  
  // If Hebrew, keep the name exactly as provided (do not translate English names)
  if (language === 'he') {
    return normalizedName || 'יקב';
  }
  
  // Try multiple variations of the name to find a translation
  // 1. Exact match
  let translation = nameTranslations[normalizedName];
  if (translation && translation[language]) {
    return translation[language]!;
  }
  
  // 2. Try trimmed lowercase version (case-insensitive)
  const lowerName = normalizedName.toLowerCase();
  translation = nameTranslations[lowerName];
  if (translation && translation[language]) {
    return translation[language]!;
  }
  
  // 3. Try with trimmed spaces
  const trimmedName = normalizedName.replace(/\s+/g, ' ').trim();
  if (trimmedName !== normalizedName) {
    translation = nameTranslations[trimmedName];
    if (translation && translation[language]) {
      return translation[language]!;
    }
  }
  
  // 4. Try without common prefixes/suffixes
  let nameWithoutPrefix = normalizedName;
  if (normalizedName.startsWith('יקב ')) {
    nameWithoutPrefix = normalizedName.replace(/^יקב\s+/, '').trim();
  } else if (normalizedName.startsWith('חנות יין ')) {
    nameWithoutPrefix = normalizedName.replace(/^חנות יין\s+/, '').trim();
  } else if (normalizedName.startsWith('חנות ')) {
    nameWithoutPrefix = normalizedName.replace(/^חנות\s+/, '').trim();
  }
  
  if (nameWithoutPrefix !== normalizedName && nameWithoutPrefix.length > 0) {
    translation = nameTranslations[nameWithoutPrefix];
    if (translation && translation[language]) {
      return translation[language]!;
    }
  }
  
  // 5. Try without suffixes
  let nameWithoutSuffix = normalizedName;
  if (normalizedName.endsWith(' יקב')) {
    nameWithoutSuffix = normalizedName.replace(/\s+יקב$/, '').trim();
  } else if (normalizedName.endsWith(' חנות יין')) {
    nameWithoutSuffix = normalizedName.replace(/\s+חנות יין$/, '').trim();
  } else if (normalizedName.endsWith(' חנות')) {
    nameWithoutSuffix = normalizedName.replace(/\s+חנות$/, '').trim();
  }
  
  if (nameWithoutSuffix !== normalizedName && nameWithoutSuffix.length > 0) {
    translation = nameTranslations[nameWithoutSuffix];
    if (translation && translation[language]) {
      return translation[language]!;
    }
  }
  
  // Detect what languages are in the name
  const hasHebrew = containsHebrew(name);
  const hasEnglish = /[a-zA-Z]/.test(name);
  const hasRussian = /[а-яА-ЯёЁ]/.test(name);
  
  // If Russian is selected, we need to ensure everything is translated to Russian
  if (language === 'ru') {
    // If name is already in Russian, return it
    if (hasRussian && !hasEnglish && !hasHebrew) {
      return name;
    }
    
    // If name contains both English/Russian and Hebrew, extract only the English/Russian part
    if ((hasEnglish || hasRussian) && hasHebrew) {
      // Name contains both - extract only the English/Russian part
      // Remove Hebrew characters and clean up
      let languagePart = name.replace(/[\u0590-\u05FF]/g, '').trim();
      // Clean up extra spaces and separators
      languagePart = languagePart.replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();
      
      // If we got a meaningful language part, translate it to Russian if it's English
      if (languagePart.length > 0 && languagePart !== '/') {
        // If the extracted part is in English, translate it to Russian
        if (/[a-zA-Z]/.test(languagePart) && !/[а-яА-ЯёЁ]/.test(languagePart)) {
          // Check if the English part has a translation
          const englishTranslation = nameTranslations[languagePart];
          if (englishTranslation && englishTranslation.ru) {
            return englishTranslation.ru;
          }
          // Try to translate common English patterns to Russian
          let translatedPart = languagePart;
          translatedPart = translatedPart.replace(/\bWinery\b/gi, 'Винодельня');
          translatedPart = translatedPart.replace(/\bVineyards\b/gi, 'Виноградники');
          translatedPart = translatedPart.replace(/\bWine Shop\b/gi, 'Винный магазин');
          translatedPart = translatedPart.replace(/\bWine Store\b/gi, 'Винный магазин');
          translatedPart = translatedPart.replace(/\bShop\b/gi, 'Магазин');
          if (translatedPart !== languagePart) {
            return translatedPart;
          }
          // If no translation found, return the English part anyway (better than showing nothing)
          return languagePart;
        }
        // If it's already in Russian, return it
        return languagePart;
      }
    }
    
    // If name contains Hebrew, try to translate Hebrew patterns to Russian
    if (hasHebrew && !hasEnglish && !hasRussian) {
      // Check if the original name has a translation first
      const originalTranslation = nameTranslations[name];
      if (originalTranslation && originalTranslation.ru) {
        return originalTranslation.ru;
      }
      
      // Try to translate common Hebrew patterns and extract the name part
      let cleanName = name.trim();
      let prefix = '';
      let suffix = '';
      
      // Check for common prefixes
      if (cleanName.startsWith('יקב ')) {
        prefix = 'Винодельня ';
        cleanName = cleanName.replace(/^יקב\s+/, '');
      } else if (cleanName.startsWith('חנות יין ')) {
        prefix = 'Винный магазин ';
        cleanName = cleanName.replace(/^חנות יין\s+/, '');
      } else if (cleanName.startsWith('חנות ')) {
        prefix = 'Магазин ';
        cleanName = cleanName.replace(/^חנות\s+/, '');
      }
      
      // Check for common suffixes
      if (cleanName.endsWith(' יקב')) {
        suffix = ' Винодельня';
        cleanName = cleanName.replace(/\s+יקב$/, '');
      } else if (cleanName.endsWith(' חנות יין')) {
        suffix = ' Винный магазин';
        cleanName = cleanName.replace(/\s+חנות יין$/, '');
      } else if (cleanName.endsWith(' חנות')) {
        suffix = ' Магазин';
        cleanName = cleanName.replace(/\s+חנות$/, '');
      }
      
      // If we extracted a clean name, check if it has a translation
      if (cleanName !== name && cleanName.length > 0) {
        const cleanTranslation = nameTranslations[cleanName];
        if (cleanTranslation && cleanTranslation.ru) {
          return prefix + cleanTranslation.ru + suffix;
        }
      }
      
      // If we have a prefix or suffix, check if cleanName has a translation
      if (prefix || suffix) {
        // Try to find translation for the clean name
        const cleanTranslation = nameTranslations[cleanName];
        if (cleanTranslation && cleanTranslation.ru) {
          return prefix + cleanTranslation.ru + suffix;
        }
        // If no translation for clean name, check if it's in the translations with the prefix
        const fullNameTranslation = nameTranslations[name];
        if (fullNameTranslation && fullNameTranslation.ru) {
          return fullNameTranslation.ru;
        }
        // If still no translation, return just the type (prefix/suffix) without Hebrew name
        // This is better than showing Hebrew when user selected Russian
        if (prefix) {
          return prefix.trim();
        } else if (suffix) {
          return suffix.trim();
        }
      }
      
      // Last resort: try to determine if it's a winery or shop based on common words
      // But don't show the Hebrew name - just show the type
      if (name.includes('יקב')) {
        return 'Винодельня';
      } else if (name.includes('חנות יין') || name.includes('חנות')) {
        return 'Винный магазин';
      }
      
      // If nothing worked and it's pure Hebrew, return generic type label
      // This ensures we always show something
      if (name.includes('יקב')) {
        return 'Винодельня';
      } else if (name.includes('חנות יין') || name.includes('חנות')) {
        return 'Винный магазин';
      }
      return 'Винодельня'; // Default fallback
    }
    
    // If name is pure English (no Hebrew, no Russian), translate to Russian
    if (hasEnglish && !hasRussian && !hasHebrew) {
      // Check if the English name has a translation
      const englishTranslation = nameTranslations[name];
      if (englishTranslation && englishTranslation.ru) {
        return englishTranslation.ru;
      }
      // Try to translate common English patterns to Russian
      let translated = name;
      translated = translated.replace(/\bWinery\b/gi, 'Винодельня');
      translated = translated.replace(/\bVineyards\b/gi, 'Виноградники');
      translated = translated.replace(/\bWine Shop\b/gi, 'Винный магазин');
      translated = translated.replace(/\bWine Store\b/gi, 'Винный магазин');
      translated = translated.replace(/\bShop\b/gi, 'Магазин');
      if (translated !== name) {
        return translated;
      }
      // If no translation found, return the English name anyway
      return name;
    }
    
    // If we get here and name has Hebrew, don't return Hebrew when Russian is selected
    // Return generic type instead
    if (hasHebrew && !hasEnglish && !hasRussian) {
      // Try to determine type
      if (name.includes('יקב')) {
        return 'Винодельня';
      } else if (name.includes('חנות יין') || name.includes('חנות')) {
        return 'Винный магазин';
      }
      return 'Винодельня'; // Default fallback
    }
    
    // Final fallback: if name is already in Russian or English, return it
    if (hasRussian || hasEnglish) {
      return name;
    }
    
    // Otherwise return original name or default (we're in Russian block, so default to Russian)
    return name.trim() || 'Винодельня';
  }
  
  // For English language
  if (language === 'en') {
    // If name contains both English and Hebrew, extract only the English part
    if (hasEnglish && hasHebrew) {
      let languagePart = name.replace(/[\u0590-\u05FF]/g, '').trim();
      languagePart = languagePart.replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();
      if (languagePart.length > 0 && languagePart !== '/') {
        return languagePart;
      }
    }
    
    // If the name contains only Hebrew characters but no translation exists,
    // try to provide a transliterated or default version
    if (hasHebrew && !hasEnglish && !hasRussian) {
      // Check if the original name has a translation first
      const originalTranslation = nameTranslations[name];
      if (originalTranslation && originalTranslation[language]) {
        return originalTranslation[language]!;
      }
      
      // Try to translate common Hebrew patterns and extract the name part
      let cleanName = name.trim();
      let prefix = '';
      let suffix = '';
      
      // Check for common prefixes
      if (cleanName.startsWith('יקב ')) {
        prefix = 'Winery ';
        cleanName = cleanName.replace(/^יקב\s+/, '');
      } else if (cleanName.startsWith('חנות יין ')) {
        prefix = 'Wine Shop ';
        cleanName = cleanName.replace(/^חנות יין\s+/, '');
      } else if (cleanName.startsWith('חנות ')) {
        prefix = 'Shop ';
        cleanName = cleanName.replace(/^חנות\s+/, '');
      }
      
      // Check for common suffixes
      if (cleanName.endsWith(' יקב')) {
        suffix = ' Winery';
        cleanName = cleanName.replace(/\s+יקב$/, '');
      } else if (cleanName.endsWith(' חנות יין')) {
        suffix = ' Wine Shop';
        cleanName = cleanName.replace(/\s+חנות יין$/, '');
      } else if (cleanName.endsWith(' חנות')) {
        suffix = ' Shop';
        cleanName = cleanName.replace(/\s+חנות$/, '');
      }
      
      // If we extracted a clean name, check if it has a translation
      if (cleanName !== name && cleanName.length > 0) {
        const cleanTranslation = nameTranslations[cleanName];
        if (cleanTranslation && cleanTranslation[language]) {
          return prefix + cleanTranslation[language]! + suffix;
        }
      }
      
      // If we have a prefix or suffix, check if cleanName has a translation
      if (prefix || suffix) {
        // Try to find translation for the clean name
        const cleanTranslation = nameTranslations[cleanName];
        if (cleanTranslation && cleanTranslation[language]) {
          return prefix + cleanTranslation[language]! + suffix;
        }
        // If no translation for clean name, check if it's in the translations with the prefix
        const fullNameTranslation = nameTranslations[name];
        if (fullNameTranslation && fullNameTranslation[language]) {
          return fullNameTranslation[language]!;
        }
        // If still no translation, return just the type (prefix/suffix) without Hebrew name
        // This is better than showing Hebrew when user selected English
        if (prefix) {
          return prefix.trim();
        } else if (suffix) {
          return suffix.trim();
        }
      }
      
      // Last resort: try to determine if it's a winery or shop based on common words
      // But don't show the Hebrew name - just show the type
      if (name.includes('יקב')) {
        return 'Winery';
      } else if (name.includes('חנות יין') || name.includes('חנות')) {
        return 'Wine Shop';
      }
      
      // If nothing worked and it's pure Hebrew, return the type at least
      // This ensures we don't show Hebrew when user selected English
      if (name.includes('יקב')) {
        return 'Winery';
      } else if (name.includes('חנות יין') || name.includes('חנות')) {
        return 'Wine Shop';
      }
      return 'Winery'; // Default fallback
    }
    
    // If name is pure English, return it
    if (hasEnglish && !hasHebrew && !hasRussian) {
      return name;
    }
  }
  
  // Final fallback: if we get here and language is not Hebrew, don't return Hebrew
  // Try to determine type and return that instead
  // Note: At this point, language is already narrowed to 'en' | 'ru' (we returned early if 'he')
  if (hasHebrew) {
    // Don't return Hebrew - return the type instead
    if (normalizedName.includes('יקב')) {
      return language === 'en' ? 'Winery' : 'Винодельня';
    } else if (normalizedName.includes('חנות יין') || normalizedName.includes('חנות')) {
      return language === 'en' ? 'Wine Shop' : 'Винный магазин';
    }
    return language === 'en' ? 'Winery' : 'Винодельня'; // Default
  }
  
  // If no translation found and it's not Hebrew, return original name (should be English/Russian)
  // But ensure it's not empty
  if (normalizedName.length > 0) {
    return normalizedName;
  }
  
  // Absolute fallback - should never happen
  return language === 'en' ? 'Winery' : language === 'ru' ? 'Винодельня' : 'יקב';
}

/**
 * Translate an address based on the selected language
 * @param address - The original address (usually in Hebrew)
 * @param language - The target language
 * @returns The translated address, or the original address if no translation is possible
 */
export function translateAddress(address: string, language: Language): string {
  if (!address) return '';
  
  // If Hebrew, return original address (but clean up if needed)
  if (language === 'he') {
    return address.trim();
  }
  
  // City name translations - order matters: longer names first to avoid partial matches
  const cityTranslations: Record<string, { en: string; ru: string }> = {
    'תל אביב-יפו': { en: 'Tel Aviv-Yafo', ru: 'Тель-Авив-Яффо' },
    'צפון מזרח כנרת': { en: 'North East Kinneret', ru: 'Северо-Восточный Кинерет' },
    'תל אביב': { en: 'Tel Aviv', ru: 'Тель-Авив' },
    'ירושלים': { en: 'Jerusalem', ru: 'Иерусалим' },
    'חיפה': { en: 'Haifa', ru: 'Хайфа' },
    'רמת גן': { en: 'Ramat Gan', ru: 'Рамат-Ган' },
    'רמות': { en: 'Ramot', ru: 'Рамот' },
    'כנרת': { en: 'Kinneret', ru: 'Кинерет' },
    'גבעתיים': { en: 'Givatayim', ru: 'Гиватаим' },
    'גבעת זאב': { en: 'Givat Ze\'ev', ru: 'Гиват-Зеэв' },
    'בני ברק': { en: 'Bnei Brak', ru: 'Бней-Брак' },
    'ראשון לציון': { en: 'Rishon LeZion', ru: 'Ришон-ле-Цион' },
    'נס ציונה': { en: 'Nes Ziona', ru: 'Нес-Циона' },
    'טירת כרמל': { en: 'Tirat Carmel', ru: 'Тират-Кармель' },
    'נשר': { en: 'Nesher', ru: 'Нешер' },
    'עתלית': { en: 'Atlit', ru: 'Атлит' },
    'זכרון יעקב': { en: 'Zichron Yaakov', ru: 'Зихрон-Яаков' },
    'בנימינה': { en: 'Binyamina', ru: 'Биньямина' },
    'קרית טבעון': { en: 'Kiryat Tivon', ru: 'Кирьят-Тивон' },
    'קרית אתא': { en: 'Kiryat Ata', ru: 'Кирьят-Ата' },
    'אשדוד': { en: 'Ashdod', ru: 'Ашдод' },
    'נתניה': { en: 'Netanya', ru: 'Нетания' },
    'באר שבע': { en: 'Beer Sheva', ru: 'Беэр-Шева' },
    'פתח תקווה': { en: 'Petah Tikva', ru: 'Петах-Тиква' },
    'חולון': { en: 'Holon', ru: 'Холон' },
    'בת ים': { en: 'Bat Yam', ru: 'Бат-Ям' },
    'אריאל': { en: 'Ariel', ru: 'Ариэль' },
    'אילת': { en: 'Eilat', ru: 'Эйлат' },
    'מצפה רמון': { en: 'Mitzpe Ramon', ru: 'Мицпе-Рамон' },
    'מישר': { en: 'Mishmar', ru: 'Мишмар' },
    'בקוע': { en: 'Bekoa', ru: 'Бекоа' },
    'נס הרים': { en: 'Nes Harim', ru: 'Нес-Харим' },
    'נאות סמדר': { en: 'Neot Semadar', ru: 'Неот-Смадар' },
    'קרני שומרון': { en: 'Karni Shomron', ru: 'Карней-Шомрон' },
    'שומרון': { en: 'Shomron', ru: 'Шомрон' },
    'מעלה אדומים': { en: 'Ma\'ale Adumim', ru: 'Маале-Адумим' },
    'מעלה אדום': { en: 'Ma\'ale Adumim', ru: 'Маале-Адумим' }
  };
  
  // Street/place name translations (for common street names and places)
  const placeTranslations: Record<string, { en: string; ru: string }> = {
    'הרימון': { en: 'Harimon', ru: 'Харимон' },
    'גבעת זאב': { en: 'Givat Ze\'ev', ru: 'Гиват-Зеэв' },
    'חרובית': { en: 'Charuvit', ru: 'Харувит' }
  };
  
  // Check if address contains English text
  const hasEnglish = /[a-zA-Z]/.test(address);
  const hasHebrew = containsHebrew(address);
  
  // Check if address contains a Plus Code (format: XXXX+XXX)
  const plusCodePattern = /[A-Z0-9]{4}\+[A-Z0-9]{2,3}[A-Z0-9]*/i;
  const hasPlusCode = plusCodePattern.test(address);
  
  // For English
  if (language === 'en') {
    // If address contains a Plus Code, handle it specially
    if (hasPlusCode) {
      const parts = address.split(',').map(p => p.trim()).filter(p => p.length > 0);
      const addressParts: string[] = [];
      
      for (const part of parts) {
        // Keep Plus Code as-is
        if (plusCodePattern.test(part)) {
          addressParts.push(part);
        }
        // Translate city names
        else {
          let cityFound = false;
          const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
          for (const hebrewCity of sortedCities) {
            if (part.includes(hebrewCity)) {
              addressParts.push(cityTranslations[hebrewCity].en);
              cityFound = true;
              break;
            }
          }
          // If not a city, check place names
          if (!cityFound) {
            const sortedPlaces = Object.keys(placeTranslations).sort((a, b) => b.length - a.length);
            for (const hebrewPlace of sortedPlaces) {
              if (part.includes(hebrewPlace)) {
                addressParts.push(placeTranslations[hebrewPlace].en);
                cityFound = true;
                break;
              }
            }
          }
          // If it's just "ישראל", translate it
          if (!cityFound && (part === 'ישראל' || part.trim() === 'ישראל')) {
            addressParts.push('Israel');
          }
        }
      }
      
      if (addressParts.length > 0) {
        return addressParts.join(', ');
      }
    }
    
    // If address already has English parts, extract and use them
    if (hasEnglish && hasHebrew) {
      // Extract English parts (keep numbers, postal codes, Plus Codes, etc.)
      let englishParts: string[] = [];
      const parts = address.split(/[,\s]+/);
      
      for (const part of parts) {
        // If part contains English letters or is a Plus Code, keep it
        if (/[a-zA-Z]/.test(part) || plusCodePattern.test(part)) {
          englishParts.push(part);
        }
        // Keep numbers and postal codes
        else if (/^\d+$/.test(part) || /^\d{5,7}$/.test(part)) {
          englishParts.push(part);
        }
      }
      
      if (englishParts.length > 0) {
        // Also translate city names
        let translated = englishParts.join(', ');
        
        // Translate city names
        const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
        sortedCities.forEach(hebrewCity => {
          if (address.includes(hebrewCity) && !translated.includes(cityTranslations[hebrewCity].en)) {
            translated += ', ' + cityTranslations[hebrewCity].en;
          }
        });
        
        // Translate place names
        const sortedPlaces = Object.keys(placeTranslations).sort((a, b) => b.length - a.length);
        sortedPlaces.forEach(hebrewPlace => {
          if (address.includes(hebrewPlace) && !translated.includes(placeTranslations[hebrewPlace].en)) {
            translated += ', ' + placeTranslations[hebrewPlace].en;
          }
        });
        
        // Translate ישראל to Israel
        if (address.includes('ישראל')) {
          translated += ', Israel';
        }
        
        return translated.trim().replace(/^,\s*/, '').replace(/\s*,\s*$/, '');
      }
    }
    
    // If pure Hebrew, translate city names and country, preserve structure
    if (hasHebrew && !hasEnglish) {
      // Split address by commas to get parts
      const parts = address.split(',').map(p => p.trim()).filter(p => p.length > 0);
      
      const addressParts: string[] = [];
      let foundCountry = false;
      
      // Process each part of the address
      for (const part of parts) {
        // Skip if this part is just "ישראל" (country) - we'll add it at the end
        if (part === 'ישראל' || part.trim() === 'ישראל') {
          foundCountry = true;
          continue;
        }
        
        let partProcessed = false;
        
        // First, check if this part is a Plus Code - keep it as-is
        if (plusCodePattern.test(part)) {
          addressParts.push(part);
          partProcessed = true;
        }
        
        // Then, check if this part contains a known city (longer names first)
        if (!partProcessed) {
          const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
          for (const hebrewCity of sortedCities) {
            const trimmedPart = part.trim();
            const trimmedCity = hebrewCity.trim();
            if (trimmedPart.includes(trimmedCity)) {
              // If the part is exactly the city (after trimming), use the translation
              if (trimmedPart === trimmedCity) {
                addressParts.push(cityTranslations[hebrewCity].en);
                partProcessed = true;
                break;
              }
              // If the part contains the city plus other text, extract and translate city
              const cityIndex = part.indexOf(hebrewCity);
              const beforeCity = part.substring(0, cityIndex).trim();
              const afterCity = part.substring(cityIndex + hebrewCity.length).trim();
              
              // Add translated city
              addressParts.push(cityTranslations[hebrewCity].en);
              
              // Process before/after parts if they contain numbers or Plus Codes
              if (beforeCity && (/\d/.test(beforeCity) || plusCodePattern.test(beforeCity))) {
                if (plusCodePattern.test(beforeCity)) {
                  addressParts.unshift(beforeCity);
                } else {
                  const numbers = beforeCity.match(/\d+/g);
                  if (numbers && numbers.length > 0 && !addressParts.includes(numbers[0])) {
                    addressParts.unshift(numbers[0]); // Add number at the beginning
                  }
                }
              }
              if (afterCity && (/\d/.test(afterCity) || plusCodePattern.test(afterCity))) {
                if (plusCodePattern.test(afterCity)) {
                  addressParts.push(afterCity);
                } else {
                  const numbers = afterCity.match(/\d+/g);
                  if (numbers && numbers.length > 0 && !addressParts.includes(numbers[0])) {
                    addressParts.push(numbers[0]);
                  }
                }
              }
              
              partProcessed = true;
              break;
            }
          }
        }
        
        // If not a city, check if it's a known place
        if (!partProcessed) {
          const sortedPlaces = Object.keys(placeTranslations).sort((a, b) => b.length - a.length);
          for (const hebrewPlace of sortedPlaces) {
            // Try exact match first (trimmed), then contains
            const trimmedPart = part.trim();
            const trimmedPlace = hebrewPlace.trim();
            if (trimmedPart === trimmedPlace || trimmedPart.includes(trimmedPlace)) {
              addressParts.push(placeTranslations[hebrewPlace].en);
              partProcessed = true;
              break;
            }
          }
        }
        
        // If not a known city/place, check if it contains numbers or Plus Code
        if (!partProcessed) {
          if (plusCodePattern.test(part)) {
            addressParts.push(part);
            partProcessed = true;
          } else {
            const hasNumber = /\d/.test(part);
            if (hasNumber) {
              // Extract numbers from this part
              const numbers = part.match(/\d+/g);
              if (numbers && numbers.length > 0) {
                // Extract any English text that might be with the number
                const englishText = part.replace(/[\u0590-\u05FF]/g, '').trim();
                if (englishText.length > 0 && /[a-zA-Z]/.test(englishText)) {
                  if (!addressParts.includes(englishText)) {
                    addressParts.push(englishText);
                  }
                } else {
                  // Just add the number
                  if (!addressParts.includes(numbers[0])) {
                    addressParts.push(numbers[0]);
                  }
                }
                partProcessed = true;
              }
            }
          }
        }
        
        // If still not processed and it's pure Hebrew (unknown street/neighborhood name),
        // we skip it to avoid showing Hebrew when language is not Hebrew
        // But we ensure at least the city is shown if we found one
      }
      
      // Add country at the end if it was found
      if (foundCountry) {
        addressParts.push('Israel');
      }
      
      // Before returning, ensure we have at least a city name, not just numbers
      // Check if addressParts contains only numbers (no meaningful text)
      const hasOnlyNumbers = addressParts.length > 0 && addressParts.every(part => /^\d+$/.test(part.trim()) || plusCodePattern.test(part.trim()));
      
      // If we only have numbers, try to find a city from the original address
      if (hasOnlyNumbers) {
        const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
        for (const hebrewCity of sortedCities) {
          if (address.includes(hebrewCity)) {
            // Prepend city name before numbers
            addressParts.unshift(cityTranslations[hebrewCity].en);
            break;
          }
        }
      }
      
      // Return formatted address - if we have at least one meaningful part, return it
      if (addressParts.length > 0) {
        const result = addressParts.join(', ');
        // Don't return if it's only numbers (shouldn't happen after above check, but safety)
        if (!/^[\d\s,]+$/.test(result.replace(plusCodePattern, '').trim())) {
          return result;
        }
      }
      
      // Fallback: try to find and translate at least one city from the entire address
      const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
      for (const hebrewCity of sortedCities) {
        if (address.includes(hebrewCity)) {
          const fallbackParts = [cityTranslations[hebrewCity].en];
          // Add numbers if they exist
          const streetNumberMatch = address.match(/(\d+)/);
          if (streetNumberMatch) {
            fallbackParts.unshift(streetNumberMatch[1]);
          }
          // Add Plus Code if it exists
          const plusCodeMatch = address.match(plusCodePattern);
          if (plusCodeMatch) {
            fallbackParts.unshift(plusCodeMatch[0]);
          }
          if (address.includes('ישראל')) {
            fallbackParts.push('Israel');
          }
          return fallbackParts.join(', ');
        }
      }
      
      // Last resort: remove all Hebrew characters and keep only numbers, English text, Plus Codes, and translate country
      let cleaned = address;
      // Translate country
      cleaned = cleaned.replace(/ישראל/g, 'Israel');
      // Remove all Hebrew characters
      cleaned = cleaned.replace(/[\u0590-\u05FF]/g, '');
      // Clean up extra spaces and commas
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      cleaned = cleaned.replace(/,\s*,/g, ',').trim();
      cleaned = cleaned.replace(/^,\s*/, '').replace(/\s*,\s*$/, '');
      
      // If we have something meaningful (not just numbers), return it
      if (cleaned.length > 0 && !/^[\d\s,]+$/.test(cleaned.replace(plusCodePattern, '').trim())) {
        return cleaned;
      }
      
      // If only numbers remain, don't return them - return empty string
      return '';
    }
    
    // If already in English, return as is (but ensure it's not empty)
    if (hasEnglish && !hasHebrew) {
      return address.trim() || '';
    }
  }
  
  // For Russian
  if (language === 'ru') {
    // If address contains a Plus Code, handle it specially
    if (hasPlusCode) {
      const parts = address.split(',').map(p => p.trim()).filter(p => p.length > 0);
      const addressParts: string[] = [];
      
      for (const part of parts) {
        // Keep Plus Code as-is
        if (plusCodePattern.test(part)) {
          addressParts.push(part);
        }
        // Translate city names
        else {
          let cityFound = false;
          const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
          for (const hebrewCity of sortedCities) {
            if (part.includes(hebrewCity)) {
              addressParts.push(cityTranslations[hebrewCity].ru);
              cityFound = true;
              break;
            }
          }
          // If not a city, check place names
          if (!cityFound) {
            const sortedPlaces = Object.keys(placeTranslations).sort((a, b) => b.length - a.length);
            for (const hebrewPlace of sortedPlaces) {
              if (part.includes(hebrewPlace)) {
                addressParts.push(placeTranslations[hebrewPlace].ru);
                cityFound = true;
                break;
              }
            }
          }
          // If it's just "ישראל", translate it
          if (!cityFound && (part === 'ישראל' || part.trim() === 'ישראל')) {
            addressParts.push('Израиль');
          }
        }
      }
      
      if (addressParts.length > 0) {
        return addressParts.join(', ');
      }
    }
    
    // If address already has English/Russian parts, try to use them
    if (hasEnglish && hasHebrew) {
      // Extract non-Hebrew parts (including Plus Codes)
      let languageParts: string[] = [];
      const parts = address.split(/[,\s]+/);
      
      for (const part of parts) {
        // If part contains English/Russian letters or is a Plus Code, keep it
        if (/[a-zA-Zа-яА-ЯёЁ]/.test(part) || plusCodePattern.test(part)) {
          languageParts.push(part);
        }
        // Keep numbers and postal codes
        else if (/^\d+$/.test(part) || /^\d{5,7}$/.test(part)) {
          languageParts.push(part);
        }
      }
      
      if (languageParts.length > 0) {
        // Translate English city names to Russian if needed
        let translated = languageParts.join(', ');
        
        // Translate city names from Hebrew
        const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
        sortedCities.forEach(hebrewCity => {
          if (address.includes(hebrewCity)) {
            translated += ', ' + cityTranslations[hebrewCity].ru;
          }
        });
        
        // Translate place names from Hebrew
        const sortedPlaces = Object.keys(placeTranslations).sort((a, b) => b.length - a.length);
        sortedPlaces.forEach(hebrewPlace => {
          if (address.includes(hebrewPlace)) {
            translated += ', ' + placeTranslations[hebrewPlace].ru;
          }
        });
        
        // Translate ישראל to Израиль
        if (address.includes('ישראל')) {
          translated += ', Израиль';
        }
        
        // Translate common English city names to Russian
        translated = translated.replace(/\bTel Aviv\b/gi, 'Тель-Авив');
        translated = translated.replace(/\bJerusalem\b/gi, 'Иерусалим');
        translated = translated.replace(/\bHaifa\b/gi, 'Хайфа');
        translated = translated.replace(/\bRamat Gan\b/gi, 'Рамат-Ган');
        translated = translated.replace(/\bIsrael\b/gi, 'Израиль');
        
        return translated.trim().replace(/^,\s*/, '').replace(/\s*,\s*$/, '');
      }
    }
    
    // If pure Hebrew, translate city names and country, preserve structure
    if (hasHebrew && !hasEnglish) {
      // Split address by commas to get parts
      const parts = address.split(',').map(p => p.trim()).filter(p => p.length > 0);
      
      const addressParts: string[] = [];
      let foundCountry = false;
      
      // Process each part of the address
      for (const part of parts) {
        // Skip if this part is just "ישראל" (country) - we'll add it at the end
        if (part === 'ישראל' || part.trim() === 'ישראל') {
          foundCountry = true;
          continue;
        }
        
        let partProcessed = false;
        
        // First, check if this part is a Plus Code - keep it as-is
        if (plusCodePattern.test(part)) {
          addressParts.push(part);
          partProcessed = true;
        }
        
        // Then, check if this part contains a known city (longer names first)
        if (!partProcessed) {
          const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
          for (const hebrewCity of sortedCities) {
            const trimmedPart = part.trim();
            const trimmedCity = hebrewCity.trim();
            if (trimmedPart.includes(trimmedCity)) {
              // If the part is exactly the city (after trimming), use the translation
              if (trimmedPart === trimmedCity) {
                addressParts.push(cityTranslations[hebrewCity].ru);
                partProcessed = true;
                break;
              }
              // If the part contains the city plus other text, extract and translate city
              const cityIndex = part.indexOf(hebrewCity);
              const beforeCity = part.substring(0, cityIndex).trim();
              const afterCity = part.substring(cityIndex + hebrewCity.length).trim();
              
              // Add translated city
              addressParts.push(cityTranslations[hebrewCity].ru);
              
              // Process before/after parts if they contain numbers or Plus Codes
              if (beforeCity && (/\d/.test(beforeCity) || plusCodePattern.test(beforeCity))) {
                if (plusCodePattern.test(beforeCity)) {
                  addressParts.unshift(beforeCity);
                } else {
                  const numbers = beforeCity.match(/\d+/g);
                  if (numbers && numbers.length > 0 && !addressParts.includes(numbers[0])) {
                    addressParts.unshift(numbers[0]); // Add number at the beginning
                  }
                }
              }
              if (afterCity && (/\d/.test(afterCity) || plusCodePattern.test(afterCity))) {
                if (plusCodePattern.test(afterCity)) {
                  addressParts.push(afterCity);
                } else {
                  const numbers = afterCity.match(/\d+/g);
                  if (numbers && numbers.length > 0 && !addressParts.includes(numbers[0])) {
                    addressParts.push(numbers[0]);
                  }
                }
              }
              
              partProcessed = true;
              break;
            }
          }
        }
        
        // If not a city, check if it's a known place
        if (!partProcessed) {
          const sortedPlaces = Object.keys(placeTranslations).sort((a, b) => b.length - a.length);
          for (const hebrewPlace of sortedPlaces) {
            // Try exact match first (trimmed), then contains
            const trimmedPart = part.trim();
            const trimmedPlace = hebrewPlace.trim();
            if (trimmedPart === trimmedPlace || trimmedPart.includes(trimmedPlace)) {
              addressParts.push(placeTranslations[hebrewPlace].ru);
              partProcessed = true;
              break;
            }
          }
        }
        
        // If not a known city/place, check if it contains numbers or Plus Code
        if (!partProcessed) {
          if (plusCodePattern.test(part)) {
            addressParts.push(part);
            partProcessed = true;
          } else {
            const hasNumber = /\d/.test(part);
            if (hasNumber) {
              // Extract numbers from this part
              const numbers = part.match(/\d+/g);
              if (numbers && numbers.length > 0) {
                // Extract any English/Russian text that might be with the number
                const languageText = part.replace(/[\u0590-\u05FF]/g, '').trim();
                if (languageText.length > 0 && /[a-zA-Zа-яА-ЯёЁ]/.test(languageText)) {
                  if (!addressParts.includes(languageText)) {
                    addressParts.push(languageText);
                  }
                } else {
                  // Just add the number
                  if (!addressParts.includes(numbers[0])) {
                    addressParts.push(numbers[0]);
                  }
                }
                partProcessed = true;
              }
            }
          }
        }
        
        // If still not processed and it's pure Hebrew (unknown street/neighborhood name),
        // we skip it to avoid showing Hebrew when language is not Hebrew
        // But we ensure at least the city is shown if we found one
      }
      
      // Add country at the end if it was found
      if (foundCountry) {
        addressParts.push('Израиль');
      }
      
      // Before returning, ensure we have at least a city name, not just numbers
      // Check if addressParts contains only numbers (no meaningful text)
      const hasOnlyNumbers = addressParts.length > 0 && addressParts.every(part => /^\d+$/.test(part.trim()) || plusCodePattern.test(part.trim()));
      
      // If we only have numbers, try to find a city from the original address
      if (hasOnlyNumbers) {
        const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
        for (const hebrewCity of sortedCities) {
          if (address.includes(hebrewCity)) {
            // Prepend city name before numbers
            addressParts.unshift(cityTranslations[hebrewCity].ru);
            break;
          }
        }
      }
      
      // Return formatted address - if we have at least one meaningful part, return it
      if (addressParts.length > 0) {
        const result = addressParts.join(', ');
        // Don't return if it's only numbers (shouldn't happen after above check, but safety)
        if (!/^[\d\s,]+$/.test(result.replace(plusCodePattern, '').trim())) {
          return result;
        }
      }
      
      // Fallback: try to find and translate at least one city from the entire address
      const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
      for (const hebrewCity of sortedCities) {
        if (address.includes(hebrewCity)) {
          const fallbackParts = [cityTranslations[hebrewCity].ru];
          // Add numbers if they exist
          const streetNumberMatch = address.match(/(\d+)/);
          if (streetNumberMatch) {
            fallbackParts.unshift(streetNumberMatch[1]);
          }
          // Add Plus Code if it exists
          const plusCodeMatch = address.match(plusCodePattern);
          if (plusCodeMatch) {
            fallbackParts.unshift(plusCodeMatch[0]);
          }
          if (address.includes('ישראל')) {
            fallbackParts.push('Израиль');
          }
          return fallbackParts.join(', ');
        }
      }
      
      // Last resort: remove all Hebrew characters and keep only numbers, English/Russian text, Plus Codes, and translate country
      let cleaned = address;
      // Translate country
      cleaned = cleaned.replace(/ישראל/g, 'Израиль');
      // Remove all Hebrew characters
      cleaned = cleaned.replace(/[\u0590-\u05FF]/g, '');
      // Clean up extra spaces and commas
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      cleaned = cleaned.replace(/,\s*,/g, ',').trim();
      cleaned = cleaned.replace(/^,\s*/, '').replace(/\s*,\s*$/, '');
      
      // If we have something meaningful (not just numbers), return it
      if (cleaned.length > 0 && !/^[\d\s,]+$/.test(cleaned.replace(plusCodePattern, '').trim())) {
        return cleaned;
      }
      
      // If only numbers remain, don't return them - return empty string
      return '';
    }
    
    // If already in Russian, return as is (but ensure it's not empty)
    if (/[а-яА-ЯёЁ]/.test(address) && !hasHebrew) {
      return address.trim() || '';
    }
    
    // If address is in English only (no Hebrew, no Russian), translate English city names to Russian
    if (hasEnglish && !hasHebrew && !/[а-яА-ЯёЁ]/.test(address)) {
      let translated = address;
      // Translate common English city names to Russian
      translated = translated.replace(/\bTel Aviv\b/gi, 'Тель-Авив');
      translated = translated.replace(/\bJerusalem\b/gi, 'Иерусалим');
      translated = translated.replace(/\bHaifa\b/gi, 'Хайфа');
      translated = translated.replace(/\bRamat Gan\b/gi, 'Рамат-Ган');
      translated = translated.replace(/\bIsrael\b/gi, 'Израиль');
      translated = translated.replace(/\bRishon LeZion\b/gi, 'Ришон-ле-Цион');
      translated = translated.replace(/\bNetanya\b/gi, 'Нетания');
      translated = translated.replace(/\bBeer Sheva\b/gi, 'Беэр-Шева');
      translated = translated.replace(/\bPetah Tikva\b/gi, 'Петах-Тиква');
      translated = translated.replace(/\bHolon\b/gi, 'Холон');
      translated = translated.replace(/\bBat Yam\b/gi, 'Бат-Ям');
      translated = translated.replace(/\bAriel\b/gi, 'Ариэль');
      translated = translated.replace(/\bEilat\b/gi, 'Эйлат');
      return translated.trim() || '';
    }
  }
  
  // Final fallback: if address still has Hebrew and language is not Hebrew, remove Hebrew
  // (This should not happen if the above logic worked, but safety net)
  // At this point, language can only be 'en' or 'ru' (Hebrew case already handled above)
  if (hasHebrew && (language === 'en' || language === 'ru')) {
    // Try one more time to find a city before removing all Hebrew
    const sortedCities = Object.keys(cityTranslations).sort((a, b) => b.length - a.length);
    for (const hebrewCity of sortedCities) {
      if (address.includes(hebrewCity)) {
        const fallbackParts = [language === 'en' ? cityTranslations[hebrewCity].en : cityTranslations[hebrewCity].ru];
        // Add Plus Code if it exists
        const plusCodeMatch = address.match(plusCodePattern);
        if (plusCodeMatch) {
          fallbackParts.unshift(plusCodeMatch[0]);
        }
        // Add numbers if they exist
        const streetNumberMatch = address.match(/(\d+)/);
        if (streetNumberMatch) {
          fallbackParts.unshift(streetNumberMatch[1]);
        }
        if (address.includes('ישראל')) {
          fallbackParts.push(language === 'en' ? 'Israel' : 'Израиль');
        }
        return fallbackParts.join(', ');
      }
    }
    
    let cleaned = address;
    // Translate country based on language
    if (language === 'en') {
      cleaned = cleaned.replace(/ישראל/g, 'Israel');
    } else if (language === 'ru') {
      cleaned = cleaned.replace(/ישראל/g, 'Израиль');
    }
    // Remove all Hebrew characters
    cleaned = cleaned.replace(/[\u0590-\u05FF]/g, '');
    // Clean up extra spaces and commas
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/,\s*,/g, ',').trim();
    cleaned = cleaned.replace(/^,\s*/, '').replace(/\s*,\s*$/, '');
    
    // If we have something meaningful (not just numbers), return it
    if (cleaned.length > 0 && !/^[\d\s,]+$/.test(cleaned.replace(plusCodePattern, '').trim())) {
      return cleaned;
    }
    
    // Return empty string if nothing meaningful left (don't show Hebrew or just numbers)
    return '';
  }
  
  // Fallback: return original address (should only happen if no Hebrew was found and language matches)
  // But ensure it's not empty
  return address.trim() || '';
}

/**
 * Translate offer text based on the selected language
 * Similar to translateAddress, uses pattern matching and dictionaries
 * @param offerText - The offer text (can be in Hebrew, English, or mixed)
 * @param language - The target language
 * @returns The translated offer text
 */
export function translateOffer(offerText: string, language: Language): string {
  if (!offerText || !offerText.trim()) return offerText;
  
  // If Hebrew, return original
  if (language === 'he') {
    return offerText.trim();
  }
  
  // Detect what languages are present in the text
  const hasHebrew = containsHebrew(offerText);
  const hasEnglish = /[a-zA-Z]/.test(offerText);
  const hasRussian = /[а-яА-ЯёЁ]/.test(offerText);
  
  // Common offer phrase translations
  const offerPhrases: Record<string, { en: string; ru: string }> = {
    'מבצע': { en: 'Sale', ru: 'Акция' },
    'מבצעים': { en: 'Sales', ru: 'Акции' },
    'הנחה': { en: 'Discount', ru: 'Скидка' },
    'הנחות': { en: 'Discounts', ru: 'Скидки' },
    'הצעות': { en: 'Offers', ru: 'Предложения' },
    'הצעה': { en: 'Offer', ru: 'Предложение' },
    'מבצע מיוחד': { en: 'Special Sale', ru: 'Специальная акция' },
    'מבצעים מיוחדים': { en: 'Special Sales', ru: 'Специальные акции' },
    'הנחה מיוחדת': { en: 'Special Discount', ru: 'Специальная скидка' },
    'הנחות מיוחדות': { en: 'Special Discounts', ru: 'Специальные скидки' },
    'הצעות מיוחדות': { en: 'Special Offers', ru: 'Специальные предложения' },
    'הצעה מיוחדת': { en: 'Special Offer', ru: 'Специальное предложение' },
    'קנה 2 קבל 1': { en: 'Buy 2 Get 1', ru: 'Купи 2 Получи 1' },
    'קנה 2 קבל 1 חינם': { en: 'Buy 2 Get 1 Free', ru: 'Купи 2 Получи 1 Бесплатно' },
    'קנה אחד קבל אחד': { en: 'Buy One Get One', ru: 'Купи Один Получи Один' },
    'קנה אחד קבל אחד חינם': { en: 'Buy One Get One Free', ru: 'Купи Один Получи Один Бесплатно' },
    'הנחה של': { en: 'Discount of', ru: 'Скидка' },
    'הנחה עד': { en: 'Discount up to', ru: 'Скидка до' },
    'אחוז': { en: 'Percent', ru: 'Процент' },
    'אחוזים': { en: 'Percent', ru: 'Проценты' },
    'על כל': { en: 'On all', ru: 'На все' },
    'על כל המוצרים': { en: 'On all products', ru: 'На все товары' },
    'על כל היינות': { en: 'On all wines', ru: 'На все вина' },
    'על כל הבקבוקים': { en: 'On all bottles', ru: 'На все бутылки' },
    'חינם': { en: 'Free', ru: 'Бесплатно' },
    'בחינם': { en: 'For free', ru: 'Бесплатно' },
    'מתנה': { en: 'Gift', ru: 'Подарок' },
    'מתנות': { en: 'Gifts', ru: 'Подарки' },
    'עם כל רכישה': { en: 'With every purchase', ru: 'С каждой покупкой' },
    'עם כל קנייה': { en: 'With every purchase', ru: 'С каждой покупкой' },
    'מינימום רכישה': { en: 'Minimum purchase', ru: 'Минимальная покупка' },
    'מינימום קנייה': { en: 'Minimum purchase', ru: 'Минимальная покупка' },
    'שקל': { en: 'Shekel', ru: 'Шекель' },
    'שקלים': { en: 'Shekels', ru: 'Шекели' },
    '₪': { en: 'NIS', ru: '₪' },
    'תוקף עד': { en: 'Valid until', ru: 'Действительно до' },
    'תוקף': { en: 'Valid', ru: 'Действительно' },
    'עד': { en: 'Until', ru: 'До' },
    'מ': { en: 'From', ru: 'От' },
    'מ-': { en: 'From', ru: 'От' },
    'בין': { en: 'Between', ru: 'Между' },
    'ימים': { en: 'Days', ru: 'Дни' },
    'יום': { en: 'Day', ru: 'День' },
    'שעות': { en: 'Hours', ru: 'Часы' },
    'שעה': { en: 'Hour', ru: 'Час' },
    'שבוע': { en: 'Week', ru: 'Неделя' },
    'שבועות': { en: 'Weeks', ru: 'Недели' },
    'חודש': { en: 'Month', ru: 'Месяц' },
    'חודשים': { en: 'Months', ru: 'Месяцы' },
    'בימים': { en: 'On days', ru: 'В дни' },
    'בימי': { en: 'On days', ru: 'В дни' },
    'ראשון': { en: 'Sunday', ru: 'Воскресенье' },
    'שני': { en: 'Monday', ru: 'Понедельник' },
    'שלישי': { en: 'Tuesday', ru: 'Вторник' },
    'רביעי': { en: 'Wednesday', ru: 'Среда' },
    'חמישי': { en: 'Thursday', ru: 'Четверг' },
    'שישי': { en: 'Friday', ru: 'Пятница' },
    'שבת': { en: 'Saturday', ru: 'Суббота' },
    'בראשון': { en: 'On Sunday', ru: 'В воскресенье' },
    'בשני': { en: 'On Monday', ru: 'В понедельник' },
    'בשלישי': { en: 'On Tuesday', ru: 'Во вторник' },
    'ברביעי': { en: 'On Wednesday', ru: 'В среду' },
    'בחמישי': { en: 'On Thursday', ru: 'В четверг' },
    'בשישי': { en: 'On Friday', ru: 'В пятницу' },
    'בשבת': { en: 'On Saturday', ru: 'В субботу' },
  };
  
  // For English
  if (language === 'en') {
    // If already in English (or mixed with English), extract English parts
    if (hasEnglish && hasHebrew) {
      // Extract English parts and translate Hebrew parts
      let result = offerText;
      
      // Translate Hebrew phrases (longer phrases first)
      const sortedPhrases = Object.keys(offerPhrases).sort((a, b) => b.length - a.length);
      for (const hebrewPhrase of sortedPhrases) {
        const regex = new RegExp(hebrewPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, offerPhrases[hebrewPhrase].en);
      }
      
      // Remove remaining Hebrew characters
      result = result.replace(/[\u0590-\u05FF]/g, '').trim();
      result = result.replace(/\s+/g, ' ').trim();
      
      if (result.length > 0) {
        return result;
      }
    }
    
    // If pure Hebrew, translate all phrases
    if (hasHebrew && !hasEnglish) {
      let result = offerText;
      
      // Translate Hebrew phrases (longer phrases first)
      const sortedPhrases = Object.keys(offerPhrases).sort((a, b) => b.length - a.length);
      for (const hebrewPhrase of sortedPhrases) {
        const regex = new RegExp(hebrewPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, offerPhrases[hebrewPhrase].en);
      }
      
      // Remove remaining Hebrew characters
      result = result.replace(/[\u0590-\u05FF]/g, '').trim();
      result = result.replace(/\s+/g, ' ').trim();
      
      if (result.length > 0) {
        return result;
      }
      
      // If nothing left, return empty
      return '';
    }
    
    // If already in English, return as is
    if (hasEnglish && !hasHebrew) {
      return offerText.trim();
    }
  }
  
  // For Russian
  if (language === 'ru') {
    // If already in Russian (or mixed with Russian), extract Russian parts
    if (hasRussian && hasHebrew) {
      // Extract Russian parts and translate Hebrew parts
      let result = offerText;
      
      // Translate Hebrew phrases (longer phrases first)
      const sortedPhrases = Object.keys(offerPhrases).sort((a, b) => b.length - a.length);
      for (const hebrewPhrase of sortedPhrases) {
        const regex = new RegExp(hebrewPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, offerPhrases[hebrewPhrase].ru);
      }
      
      // Remove remaining Hebrew characters
      result = result.replace(/[\u0590-\u05FF]/g, '').trim();
      result = result.replace(/\s+/g, ' ').trim();
      
      if (result.length > 0) {
        return result;
      }
    }
    
    // If pure Hebrew, translate all phrases
    if (hasHebrew && !hasRussian) {
      let result = offerText;
      
      // Translate Hebrew phrases (longer phrases first)
      const sortedPhrases = Object.keys(offerPhrases).sort((a, b) => b.length - a.length);
      for (const hebrewPhrase of sortedPhrases) {
        const regex = new RegExp(hebrewPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, offerPhrases[hebrewPhrase].ru);
      }
      
      // Remove remaining Hebrew characters
      result = result.replace(/[\u0590-\u05FF]/g, '').trim();
      result = result.replace(/\s+/g, ' ').trim();
      
      if (result.length > 0) {
        return result;
      }
      
      // If nothing left, return empty
      return '';
    }
    
    // If already in Russian, return as is
    if (hasRussian && !hasHebrew) {
      return offerText.trim();
    }
    
    // If English only, translate common English phrases to Russian
    if (hasEnglish && !hasHebrew && !hasRussian) {
      let result = offerText;
      // Translate common English offer phrases to Russian
      result = result.replace(/\bSale\b/gi, 'Акция');
      result = result.replace(/\bSales\b/gi, 'Акции');
      result = result.replace(/\bDiscount\b/gi, 'Скидка');
      result = result.replace(/\bDiscounts\b/gi, 'Скидки');
      result = result.replace(/\bOffer\b/gi, 'Предложение');
      result = result.replace(/\bOffers\b/gi, 'Предложения');
      result = result.replace(/\bSpecial\b/gi, 'Специальный');
      result = result.replace(/\bFree\b/gi, 'Бесплатно');
      result = result.replace(/\bGift\b/gi, 'Подарок');
      result = result.replace(/\bGifts\b/gi, 'Подарки');
      result = result.replace(/\bBuy\b/gi, 'Купи');
      result = result.replace(/\bGet\b/gi, 'Получи');
      result = result.replace(/\bOne\b/gi, 'Один');
      result = result.replace(/\bPercent\b/gi, 'Процент');
      result = result.replace(/\bValid\b/gi, 'Действительно');
      result = result.replace(/\bUntil\b/gi, 'До');
      result = result.replace(/\bFrom\b/gi, 'От');
      result = result.replace(/\bBetween\b/gi, 'Между');
      return result.trim();
    }
  }
  
  // Fallback: return original text
  return offerText.trim();
}
