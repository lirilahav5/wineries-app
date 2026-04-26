// Simple language detection
function detectLanguage(text) {
  // Hebrew: Contains Hebrew characters (Unicode range \u0590-\u05FF)
  const hebrewRegex = /[\u0590-\u05FF]/;
  // Russian: Contains Cyrillic characters (Unicode range \u0400-\u04FF)
  const russianRegex = /[\u0400-\u04FF]/;
  
  if (hebrewRegex.test(text)) {
    return 'he';
  } else if (russianRegex.test(text)) {
    return 'ru';
  } else {
    return 'en';
  }
}

module.exports = { detectLanguage };
