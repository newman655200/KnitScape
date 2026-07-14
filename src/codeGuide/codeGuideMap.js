import definitions from "./codeGuideDefinitions.json";
import generatedLines from "./generatedLines.json";

export const PROJECT_ROOT = "C:/Users/liuchen/Desktop/GitHub/knitscape";

export const CODE_GUIDE_MAP = Object.freeze(
  Object.fromEntries(
    Object.entries(definitions).map(([key, definition]) => [
      key,
      { ...definition, line: generatedLines[key] ?? null },
    ])
  )
);

export function getCodeGuideEntry(key) {
  return Object.hasOwn(CODE_GUIDE_MAP, key) ? CODE_GUIDE_MAP[key] : null;
}

export function absoluteCodeGuidePath(entry) {
  return `${PROJECT_ROOT}/${entry.file}`;
}

export function createVSCodeHref(entry) {
  return `vscode://file/${absoluteCodeGuidePath(entry)}:${entry.line}`;
}
