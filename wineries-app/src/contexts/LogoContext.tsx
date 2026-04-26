import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type LogoVariant = 'svg' | 'option1' | 'option2' | 'option3';

interface LogoContextType {
  logoVariant: LogoVariant;
  setLogoVariant: (variant: LogoVariant) => void;
}

const LOGO_STORAGE_KEY = 'app_logo_variant';

const getDefaultVariant = (): LogoVariant => {
  const envVariant = import.meta.env?.VITE_LOGO_VARIANT;
  if (envVariant === 'svg' || envVariant === 'option1' || envVariant === 'option2' || envVariant === 'option3') {
    return envVariant;
  }
  return 'option1';
};

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export const LogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const defaultVariant = useMemo(() => getDefaultVariant(), []);
  const [logoVariant, setLogoVariantState] = useState<LogoVariant>(defaultVariant);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOGO_STORAGE_KEY);
      if (stored === 'svg' || stored === 'option1' || stored === 'option2' || stored === 'option3') {
        setLogoVariantState(stored);
      }
    } catch {
      // Ignore storage errors and keep default
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOGO_STORAGE_KEY, logoVariant);
    } catch {
      // Ignore storage errors
    }
  }, [logoVariant]);

  const setLogoVariant = (variant: LogoVariant) => {
    setLogoVariantState(variant);
  };

  return (
    <LogoContext.Provider value={{ logoVariant, setLogoVariant }}>
      {children}
    </LogoContext.Provider>
  );
};

export const useLogo = (): LogoContextType => {
  const context = useContext(LogoContext);
  if (context) {
    return context;
  }
  const fallbackVariant = getDefaultVariant();
  return {
    logoVariant: fallbackVariant,
    setLogoVariant: () => undefined
  };
};
