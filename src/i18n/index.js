import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, languageMeta, normalizeLanguage } from "./languages.js";
import { translations } from "./translations.js";

export function getInitialLanguage() {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_LANGUAGE;
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch (_error) {
    return DEFAULT_LANGUAGE;
  }
}

export function setStoredLanguage(language) {
  const normalized = normalizeLanguage(language);

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    }
  } catch (_error) {
    // localStorage 不可用时保持当前页面语言，不影响编辑功能。
  }

  return normalized;
}

function interpolate(text, values = {}) {
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    text
  );
}

export function getTranslation(key, language = getInitialLanguage(), values = {}) {
  const normalized = normalizeLanguage(language);
  const text =
    translations[normalized]?.[key] ??
    translations[DEFAULT_LANGUAGE]?.[key] ??
    key;

  return interpolate(text, values);
}

export function t(key, languageOrValues, maybeValues) {
  const hasLanguage = typeof languageOrValues === "string";
  const language = hasLanguage ? languageOrValues : getInitialLanguage();
  const values = hasLanguage ? maybeValues : languageOrValues;

  return getTranslation(key, language, values || {});
}

export function syncDocumentLanguage(language) {
  if (typeof document === "undefined") return;

  const normalized = normalizeLanguage(language);
  document.documentElement.lang = languageMeta(normalized).htmlLang;
  document.title = t("taskbar.title", normalized);
}
