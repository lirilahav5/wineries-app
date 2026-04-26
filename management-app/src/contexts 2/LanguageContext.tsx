import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    // Login
    'login.title': 'התחברות',
    'login.email': 'אימייל',
    'login.password': 'סיסמה',
    'login.signIn': 'התחבר',
    'login.signUp': 'הרשמה',
    'login.forgotPassword': 'שכחתי סיסמה',
    'login.dontHaveAccount': 'אין לך חשבון?',
    'login.alreadyHaveAccount': 'יש לך כבר חשבון?',
    'login.rememberMe': 'זכור אותי',
    'login.phoneNumber': 'מספר טלפון',
    'login.sendCode': 'שלח קוד',
    'login.verifyCode': 'אימות קוד',
    'login.enterCode': 'הזן קוד אימות',
    'login.resendCode': 'שלח קוד מחדש',
    'login.confirmPassword': 'אישור סיסמה',
    'login.createAccount': 'צור חשבון',
    'login.backToLogin': 'חזור להתחברות',
    
    // Dashboard
    'dashboard.title': 'לוח בקרה',
    'dashboard.welcome': 'ברוכים הבאים לפורטל הניהול של WineME',
    'dashboard.wineries': 'יקבים',
    'dashboard.wineShops': 'חנויות יין',
    'dashboard.totalEntries': 'סה"כ רשומות',
    'dashboard.manageWineries': 'נהל יקבים',
    'dashboard.manageShops': 'נהל חנויות',
    'dashboard.quickActions': 'פעולות מהירות',
    'dashboard.addWinery': 'הוסף יקב חדש',
    'dashboard.addWineryDesc': 'צור רשומת יקב חדשה',
    'dashboard.addShop': 'הוסף חנות יין חדשה',
    'dashboard.addShopDesc': 'צור רשומת חנות יין חדשה',
    'dashboard.paidLogos': 'לוגואים ששולמו',
    'dashboard.totalEarnings': 'סה"כ הכנסות',
    'dashboard.currency': '₪',
    
    // Settings
    'settings.title': 'הגדרות',
    'settings.security': 'הגדרות אבטחה',
    'settings.manageQuickSignIn': 'נהל אפשרויות התחברות מהירה',
    'settings.language': 'שפה',
    'settings.theme': 'ערכת נושא',
    'settings.theme.light': 'בהיר',
    'settings.theme.dark': 'כהה',
    'settings.theme.system': 'מערכת',
    'settings.backToDashboard': 'חזור ללוח הבקרה',
    'settings.biometric': 'אימות ביומטרי',
    'settings.pin': 'קוד PIN',
    'settings.setPin': 'הגדר PIN',
    'settings.enterPin': 'הזן PIN (4-6 ספרות)',
    'settings.confirmPin': 'אישור PIN',
    'settings.cancel': 'ביטול',
    
    // Navigation
    'nav.dashboard': 'לוח בקרה',
    'nav.wineries': 'יקבים',
    'nav.wineShops': 'חנויות יין',
    'nav.settings': 'הגדרות',
    'nav.logout': 'התנתק',
    
    // Common
    'common.loading': 'טוען...',
    'common.error': 'שגיאה',
    'common.success': 'הצלחה',
    'common.save': 'שמור',
    'common.cancel': 'ביטול',
    'common.delete': 'מחק',
    'common.edit': 'ערוך',
    'common.add': 'הוסף',
    'common.back': 'חזור',
  }
  // English translations removed - only Hebrew is supported
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('he');

  const setLanguage = (_lang: Language) => {
    // Only Hebrew is supported
    setLanguageState('he');
    localStorage.setItem('management_app_language', 'he');
    // Set document direction for Hebrew
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';
  };

  // Set initial document direction
  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

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
