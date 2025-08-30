// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: { welcome: "Welcome", about: "About Us" } },
      hi: { translation: { welcome: "स्वागत है", about: "हमारे बारे में" } },
      bn: { translation: { welcome: "স্বাগতম", about: "আমাদের সম্পর্কে" } },
      ta: { translation: { welcome: "வரவேற்கிறோம்", about: "எங்களை பற்றி" } },
      te: { translation: { welcome: "స్వాగతం", about: "మా గురించి" } },
      mr: { translation: { welcome: "स्वागत आहे", about: "आमच्याबद्दल" } },
      gu: { translation: { welcome: "સ્વાગત છે", about: "અમારા વિશે" } },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
