import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enErrors from '../../public/locales/en/errors.json';
import ruErrors from '../../public/locales/ru/errors.json';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['errors'],
  defaultNS: 'errors',
  resources: {
    en: { errors: enErrors },
    ru: { errors: ruErrors }
  },
  interpolation: {
    escapeValue: false
  }
});
