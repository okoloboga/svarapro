import { en } from "./en";
import { ru } from "./ru";

export type Locale = 'en' | 'ru';

export const locales = {
    en,
    ru,
};

export function getLocale(lang: Locale = 'ru') {
    return locales[lang] || locales.ru;
}

export function getMessage(lang: Locale, key: string, ...args: any[]) {
    const locale = getLocale(lang);
    const keys = key.split('.');
    let message: any = locale;

    for (const k of keys) {
        message = message[k];
        if (!message) return key;
    }

    if (typeof message === 'function') {
        return message(...args);
    }

    return message;
}