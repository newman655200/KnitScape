# Language Switching Design

## Goal

Add full-page language switching for the single-face KnitScape web app.

Supported languages:

- Simplified Chinese: `zh-CN`, label `简体中文`
- Traditional Chinese: `zh-TW`, label `繁體中文`
- English: `en`, label `English`
- Vietnamese: `vi`, label `Tiếng Việt`

The default language is Simplified Chinese. When the user changes language, the selection is saved locally and restored on the next visit.

## Scope

This feature should cover all visible UI text in the single-face web app:

- Top taskbar title, fabric label, Width / Height labels, and command buttons.
- Left sidebar labels, yarn controls, scan texture controls, performance controls, symbol/yarn/motif sections, and alerts.
- Repeat tools, chart tools, toolbar buttons, canvas control labels, and status text.
- Settings, download, library, debug, and other modal text.
- Button accessible labels and image alt text.
- Browser document language and title where practical.

This is a UI text localization feature. It does not change knitting logic, canvas rendering, yarn simulation, JSON schema, or intranet build behavior.

## Recommended Architecture

Create a small local i18n layer under `src/i18n/`.

Suggested files:

```text
src/i18n/languages.js
src/i18n/translations.js
src/i18n/index.js
```

`languages.js` owns supported language metadata:

```js
export const DEFAULT_LANGUAGE = "zh-CN";
export const LANGUAGE_STORAGE_KEY = "knitscape-language";
export const LANGUAGES = [
  { code: "zh-CN", label: "简体中文", htmlLang: "zh-CN" },
  { code: "zh-TW", label: "繁體中文", htmlLang: "zh-Hant" },
  { code: "en", label: "English", htmlLang: "en" },
  { code: "vi", label: "Tiếng Việt", htmlLang: "vi" },
];
```

`translations.js` owns one nested dictionary keyed by stable IDs:

```js
export const translations = {
  "zh-CN": {
    "taskbar.title": "针织实验室（单面布）",
    "taskbar.import": "导入",
  },
  "zh-TW": {
    "taskbar.title": "針織實驗室（單面布）",
    "taskbar.import": "匯入",
  },
  en: {
    "taskbar.title": "Knitting Lab (Single Jersey)",
    "taskbar.import": "Import",
  },
  vi: {
    "taskbar.title": "Phòng thí nghiệm dệt kim (Vải một mặt)",
    "taskbar.import": "Nhập",
  },
};
```

`index.js` owns helper functions:

- `getInitialLanguage()`: read localStorage, fall back to Simplified Chinese.
- `setLanguage(languageCode)`: validate, save to localStorage, update app state.
- `t(key, values?)`: return the current-language translation, fallback to Simplified Chinese, and finally fallback to the key string.

## State Design

Add `language` to `GLOBAL_STATE`.

```js
language: getInitialLanguage()
```

Language changes should use `dispatch({ language })` so every lit-html component re-renders. This state should not be part of undo snapshots because changing UI language is not a knitting edit.

The selected language should be stored in:

```text
localStorage["knitscape-language"]
```

If localStorage is unavailable, the app should continue with Simplified Chinese without crashing.

## UI Placement

Add a language selector to the top taskbar, near the right-side command buttons or between the brand area and command buttons if space allows.

Control type:

```text
select dropdown
```

Visible options:

```text
简体中文
繁體中文
English
Tiếng Việt
```

The selector should be compact and stable so it does not resize the taskbar awkwardly. The selector itself may show native language labels even after switching, because language names are easier to recognize in their own language.

## Font Strategy

Keep the default UI font as Microsoft YaHei.

CSS should continue using this baseline:

```css
font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
```

The language switch should not introduce separate per-language fonts in the first version. English and Vietnamese should use the same fallback chain to keep layout stable and avoid text jumping between languages.

## Translation Strategy

Use stable semantic keys, not source text, as translation IDs.

Good:

```js
t("yarnTexture.enable")
t("download.modalTitle")
t("repeatTools.width")
```

Avoid:

```js
t("启用纹理")
```

This avoids problems caused by current source encoding display issues and makes future translation maintenance safer.

Every user-facing string touched during implementation should move into `translations.js`. Hardcoded technical values such as JSON keys, CSS classes, object names, and internal constants should not be translated.

## Error Handling

If a translation is missing:

1. Fall back to Simplified Chinese.
2. If Simplified Chinese also lacks the key, show the key string.
3. Validation should catch missing keys before release.

Alerts should also be translated through the same dictionary.

## Validation

Extend the existing validation scripts or add a focused i18n validation script.

Validation should check:

- `LANGUAGES` contains `zh-CN`, `zh-TW`, `en`, `vi`.
- Default language is `zh-CN`.
- `GLOBAL_STATE` includes `language`.
- Taskbar renders a language selector.
- Each language dictionary has the same key set.
- The main UI no longer hardcodes the high-priority visible labels that should be translated.
- Existing checks continue to pass:
  - `npm run validate:single-ui`
  - `npm run validate:two-ply-yarn`
  - `npm run validate:repeat-dimensions`
  - `npm run validate:intranet`
  - `npm run build`

Browser smoke check:

- Open the app.
- Confirm default language is Simplified Chinese.
- Switch to Traditional Chinese, English, and Vietnamese.
- Confirm taskbar, left sidebar, scan texture controls, and modal labels update.
- Reload the page and confirm the selected language is restored.

## Out Of Scope

- Machine translation at runtime.
- User-editable translation files in the browser.
- Backend language detection.
- Translating pattern JSON data supplied by users.
- Per-language font switching.
- Changing knitting, yarn, texture, PBR, or canvas rendering behavior.
