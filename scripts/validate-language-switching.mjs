import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const failures = [];

function expectFile(file) {
  if (!exists(file)) {
    failures.push(`${file} must exist.`);
    return "";
  }

  return read(file);
}

const languagesSource = expectFile("src/i18n/languages.js");
const translationsSource = expectFile("src/i18n/translations.js");
const i18nSource = expectFile("src/i18n/index.js");

if (languagesSource) {
  if (!/DEFAULT_LANGUAGE\s*=\s*["']zh-CN["']/.test(languagesSource)) {
    failures.push("default language must be zh-CN.");
  }
  if (!/LANGUAGE_STORAGE_KEY\s*=\s*["']knitscape-language["']/.test(languagesSource)) {
    failures.push("language selection must use the knitscape-language storage key.");
  }
  for (const code of ["zh-CN", "zh-TW", "en", "vi"]) {
    if (!languagesSource.includes(`code: "${code}"`) && !languagesSource.includes(`code: '${code}'`)) {
      failures.push(`LANGUAGES must include ${code}.`);
    }
  }
}

if (i18nSource) {
  for (const fn of ["getInitialLanguage", "setStoredLanguage", "getTranslation", "t"]) {
    if (!new RegExp(`function\\s+${fn}|const\\s+${fn}\\s*=|export\\s+function\\s+${fn}`).test(i18nSource)) {
      failures.push(`src/i18n/index.js must export ${fn}.`);
    }
  }
}

if (translationsSource) {
  for (const code of ["zh-CN", "zh-TW", "en", "vi"]) {
    if (!new RegExp(`["']?${code}["']?\\s*:`).test(translationsSource)) {
      failures.push(`translations must include ${code}.`);
    }
  }
  for (const key of [
    "taskbar.title",
    "taskbar.language",
    "taskbar.import",
    "left.yarnPlyPanel",
    "machine.gauge",
    "machine.needlePitch",
    "yarnLength.current",
    "yarnLength.cmPer100",
    "symbols.title",
    "yarns.title",
    "repeatTools.brush",
    "chartTools.cols",
    "settings.title",
    "download.title",
    "library.title",
    "simulation.flip",
    "alerts.textureImportFailed",
  ]) {
    if (!translationsSource.includes(key)) {
      failures.push(`translation key missing: ${key}.`);
    }
  }
}

const stateSource = read("src/state.js");
if (!stateSource.includes("language: getInitialLanguage()")) {
  failures.push("GLOBAL_STATE must initialize language from getInitialLanguage().");
}
const snapshotFields = stateSource.match(/SNAPSHOT_FIELDS\s*=\s*\[([\s\S]*?)\]/)?.[1] || "";
if (snapshotFields.includes("language")) {
  failures.push("language must not be part of undo snapshots.");
}

const taskbarSource = read("src/views/taskbar.js");
if (!taskbarSource.includes("LANGUAGES") || !taskbarSource.includes("language-select")) {
  failures.push("taskbar must render a language selector from LANGUAGES.");
}
if (!taskbarSource.includes("setStoredLanguage") || !taskbarSource.includes("dispatch({ language")) {
  failures.push("taskbar language selector must persist and dispatch language changes.");
}
if (!taskbarSource.includes('t("taskbar.title"')) {
  failures.push("taskbar title must use the i18n translation helper.");
}

const sourceExpectations = [
  ["src/views/leftBar.js", ["left.yarnPlyPanel", "yarnTexture.import", "yarns.title"]],
  ["src/views/chartEditorToolbar.js", ["symbols.title", "taskbar.width", "taskbar.height"]],
  ["src/views/repeatTools.js", ["repeatTools.brush", "repeatTools.exit"]],
  ["src/views/chartTools.js", ["chartTools.cols", "chartTools.rows"]],
  ["src/views/settingsModal.js", ["settings.title", "settings.grid"]],
  ["src/views/downloadModal.js", ["download.title", "download.patternJson"]],
  ["src/views/libraryModal.js", ["library.title", "library.load"]],
  ["src/components/runSimulation.js", ["simulation.flip", "simulation.fit"]],
];

for (const [file, keys] of sourceExpectations) {
  const source = read(file);
  for (const key of keys) {
    if (!source.includes(key) || !source.includes("t(")) {
      failures.push(`${file} must use translation key ${key}.`);
    }
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: language switching is configured.");
