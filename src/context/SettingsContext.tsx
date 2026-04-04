import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Unit } from '../types';
import { translations } from '../lib/i18n';

interface SettingsContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  unit: Unit;
  setUnit: (unit: Unit) => void;
  t: (key: string) => string;
  formatMeasurement: (pixels: number, pixelsPerMeter: number) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('planify_language');
    if (saved) return saved as Language;
    
    // Detect browser language
    if (typeof navigator !== 'undefined' && navigator.language) {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('en')) return 'en';
      if (browserLang.startsWith('es')) return 'es';
    }
    return 'es';
  });

  const [unit, setUnit] = useState<Unit>(() => {
    const saved = localStorage.getItem('planify_unit');
    return (saved as Unit) || 'm';
  });

  useEffect(() => {
    localStorage.setItem('planify_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('planify_unit', unit);
  }, [unit]);

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Fallback to key if not found
      }
    }
    return typeof value === 'string' ? value : key;
  };

  const formatMeasurement = (pixels: number, pixelsPerMeter: number): string => {
    const meters = pixels / pixelsPerMeter;
    if (unit === 'm') {
      return `${meters.toFixed(2)}m`;
    } else {
      // Convert meters to inches (1 meter = 39.3701 inches)
      const inches = meters * 39.3701;
      // Convert to feet and inches
      const feet = Math.floor(inches / 12);
      const remainingInches = Math.round(inches % 12);
      if (feet === 0) {
        return `${remainingInches}"`;
      }
      return `${feet}' ${remainingInches}"`;
    }
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, unit, setUnit, t, formatMeasurement }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
