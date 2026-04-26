import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'he';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation object
const translations: Record<Language, Record<string, string>> = {
  he: {
    // Navigation
    'nav.search': 'חיפוש',
    'nav.home': 'בית',
    'nav.list': 'רשימה',
    'nav.map': 'מפה',
    'nav.offers': 'מבצעים',
    'nav.experiences': 'חוויות',
    'nav.info': 'מידע',
    'nav.more': 'עוד',
    
    // Filters
    'filter.filter': 'פילטר',
    'filter.wineries': 'יקבים',
    'filter.wineShops': 'חנויות יין',
    'filter.byRegion': 'פילטר על פי אזור',
    'filter.allRegions': 'כל האזורים',
    'filter.byCity': 'פילטר לפי עיר',
    'filter.allCities': 'כל הערים',
    'filter.kosher': 'כשרות',
    'filter.kosherOnly': 'כשר בלבד',
    'filter.notKosher': 'לא כשר',
    'filter.openNow': 'פתוח עכשיו',
    'filter.openOnly': 'פתוח בלבד',
    'filter.closedOnly': 'סגור בלבד',
    'filter.all': 'הכל',
    'filter.close': 'סגור',
    
    // Regions
    'region.golan': 'רמת הגולן',
    'region.galilee': 'גליל',
    'region.shomron': 'שומרון',
    'region.judeanHills': 'הרי יהודה',
    'region.jerusalem': 'ירושלים',
    'region.sharon': 'שרון',
    'region.central': 'מרכז',
    'region.negev': 'נגב',
    'region.north': 'צפון',
    'region.south': 'דרום',
    
    // List View
    'list.kosher': 'כשר',
    'list.distance': 'מטר',
    'list.distanceKm': 'ק"מ',
    'list.goThere': 'סע לשם',
    'list.noResults': 'לא נמצאו יקבים או חנויות יין',
    'list.noResultsRegion': 'לא נמצאו יקבים או חנויות יין באזור',
    'list.offersAndDeals': 'מבצעים והצעות',
    'list.specialOffer': 'הטבה מיוחדת',
    'list.winery': 'יקב',
    'list.wineShop': 'חנות יין',
    'list.type.wineries': 'יקבים',
    'list.type.wineShops': 'חנויות יין',
    'list.type.both': 'יקבים וחנויות יין',
    'list.areaMy': 'באזור שלי',
    'list.areaRegion': 'באזור',
    'list.areaRegions': 'באזורים',
    'list.address': 'כתובת',
    'list.website': 'אתר אינטרנט',
    'list.region': 'אזור',
    'list.openNow': 'פתוח כעת',
    'list.closed': 'סגור',
    'list.toViewHours': 'לצפייה בשעות',
    'list.closesAt': 'נסגר ב־',
    
    // Offers
    'offer.title': 'מבצעים והצעות',
    'offer.close': 'סגור',
    'offer.noOffers': 'כרגע אין מבצעים זמינים עבור מקום זה. בקרוב יופיעו כאן מבצעים והצעות מיוחדות!',
    
    // Regions Page
    'regions.search': 'חיפוש',
    'regions.regions': 'אזורים',
    'regions.searchPlaceholder': 'באיזה עיר תרצה לחפש?',
    'regions.cancel': 'ביטול',
    'regions.selectFromMap': 'בחר יעד מהמפה',
    'regions.orChooseByRegion': 'בחר לפי אזור במפה - משוך כלפי מטה או בחר אזור',
    'regions.area': 'איזור',
    'regions.wineriesAndShopsInArea': 'יקבים וחנויות באיזור זה',
    'regions.loading': 'טוען...',
    'regions.noRegions': 'לא נמצאו אזורים',
    
    // Map
    'map.navigate': 'Navigate',
    'map.website': 'Website',
    'map.youAreHere': 'You are here',
    
    // Language Selection
    'lang.select': 'בחר שפה / Select Language',
    'lang.hebrew': 'עברית',
    'lang.english': 'English',
    'lang.continue': 'המשך / Continue',
    
    // Home Buttons & Hero
    'home.heroTitle': 'גלו יקבים וחנויות',
    'home.heroSub': 'בחרו אזור או השתמשו במיקום שלכם',
    'home.nearMe': 'יקבים וחנויות באזור שלי',
    'home.otherArea': 'יקבים וחנויות באזור אחר בישראל',
    'home.tutorial.title': 'ברוך הבא!',
    'home.tutorial.body': 'גלול למטה כדי לראות את המפה.\nכדי לחזור, גלול למעלה או לחץ על החץ.',
    'onboard.title1': 'ברוך הבא ל-WineMe',
    'onboard.body1': 'כאן תמצא יקבים וחנויות יין קרובים בקלות ובמהירות.',
    'onboard.title2': 'מסך הבית והמפה',
    'onboard.body2': 'גלול למטה כדי לעבור למפה, וגלול למעלה כדי לחזור למסך הבית.',
    'onboard.title3': 'חיפוש וסינון',
    'onboard.body3': 'השתמש בחיפוש ובמסננים כדי למצוא בדיוק את מה שאתה צריך.',
    'onboard.title4': 'הוספת מקום חדש',
    'onboard.body4': 'אם מצאת מקום שלא מופיע, אפשר להוסיף אותו בלחיצה על "הוספת מקום".',
    'onboard.next': 'הבא',
    'onboard.back': 'חזור',
    'onboard.done': 'התחל',
    'onboard.skip': 'דלג',
    
    // Navigation
    'nav.language': 'שפה',
    'nav.settings': 'הגדרות',//'הגדרות'
    'nav.feedback': 'דיווח על בעיה',
    'nav.addPlace': 'הוספת מקום',
    'nav.myLocation': 'המיקום שלי',
    
    // Settings
    'settings.title': 'הגדרות',
    'settings.theme': 'ערכת נושא',
    'settings.theme.light': 'בהיר',
    'settings.theme.dark': 'כהה',
    'settings.theme.system': 'מערכת',
    'settings.language': 'שפה',
    'settings.clearFilters': 'נקה מסננים',
    'settings.resetMap': 'איפוס מפה',
    'settings.about': 'אודות',
    'settings.version': 'גרסה',
    'settings.close': 'סגור',
    'settings.zoom': 'גודל תצוגה',
    'settings.zoomIn': 'הגדל',
    'settings.zoomOut': 'הקטן',
    'settings.resetZoom': 'איפוס גודל',
    'settings.logo': 'לוגו האפליקציה',
    'settings.logo.description': 'בחר לוגו זמני להצגה בכל האפליקציה',
    'settings.logo.option1': 'לוגו 1',
    'settings.logo.option2': 'לוגו 2',
    'settings.logo.option3': 'לוגו 3',
    
    // Add Place
    'addPlace.title': 'הוספת מקום',
    'addPlace.description': 'מלא את הפרטים כדי להציע מקום חדש. הפרטים יישלחו למנהלי האפליקציה.',
    'addPlace.type.winery': 'יקב',
    'addPlace.type.shop': 'חנות יין',
    'addPlace.name': 'שם המקום *',
    'addPlace.region': 'אזור *',
    'addPlace.regionOther': 'אחר (הזן ידנית)',
    'addPlace.regionCustom': 'הזן אזור אחר',
    'addPlace.address': 'כתובת *',
    'addPlace.phone': 'טלפון *',
    'addPlace.website': 'אתר',
    'addPlace.openingHours': 'שעות פתיחה',
    'addPlace.descriptionField': 'תיאור *',
    'addPlace.offers': 'מבצעים',
    'addPlace.latitude': 'קו רוחב (Latitude)',
    'addPlace.longitude': 'קו אורך (Longitude)',
    'addPlace.submit': 'שלח',
    'addPlace.cancel': 'ביטול',
    'addPlace.submitting': 'שולח...',
    'addPlace.success': 'תודה! הבקשה נשלחה בהצלחה.',
    'addPlace.error': 'שגיאה בשליחת הבקשה. אנא נסה שוב.',
    'addPlace.emptyName': 'אנא הזן שם מקום.',
    'addPlace.emptyRegion': 'אנא הזן אזור.',
    'addPlace.emptyPhone': 'אנא הזן מספר טלפון.',
    'addPlace.emptyAddress': 'אנא הזן כתובת.',
    'addPlace.emptyDescription': 'אנא הזן תיאור.',
    
    // Errors
    'error.loading': 'שגיאה בטעינת הנתונים',
    'error.retry': 'נסה שוב',
    'error.loadingData': 'טוען נתונים...',
  }
  // English and Russian translations removed - only Hebrew is supported
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('he');
  const setLanguage = (_lang: Language) => {
    // Only Hebrew is supported
    setLanguageState('he');
    localStorage.setItem('app_language', 'he');
    // Set document direction for Hebrew
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

