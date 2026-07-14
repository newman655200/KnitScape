export const DEFAULT_LANGUAGE = "zh-CN";
export const LANGUAGE_STORAGE_KEY = "knitscape-language";

export const LANGUAGES = [
  { code: "zh-CN", label: "简体中文", htmlLang: "zh-CN" },
  { code: "zh-TW", label: "繁體中文", htmlLang: "zh-Hant" },
  { code: "en", label: "English", htmlLang: "en" },
  { code: "vi", label: "Tiếng Việt", htmlLang: "vi" },
];

export function normalizeLanguage(language) {
  return LANGUAGES.some(({ code }) => code === language)
    ? language
    : DEFAULT_LANGUAGE;
}

export function languageMeta(language) {
  const normalized = normalizeLanguage(language);
  return LANGUAGES.find(({ code }) => code === normalized) || LANGUAGES[0];
}
