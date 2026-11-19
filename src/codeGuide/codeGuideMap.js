import definitions from "./codeGuideDefinitions.json";
import generatedLines from "./generatedLines.json";

export const PROJECT_ROOT = import.meta.env.CODE_GUIDE_ROOT;

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

export function absoluteCodeGuidePath(entry, projectRoot = PROJECT_ROOT) {
  return `${projectRoot.replace(/\\/g, "/").replace(/\/+$/, "")}/${entry.file}`;
}

export function createVSCodeHref(entry, projectRoot = PROJECT_ROOT) {
  const sourcePath = encodeURI(absoluteCodeGuidePath(entry, projectRoot))
    .replace(/[?#]/g, encodeURIComponent);
  return `vscode://file/${sourcePath}:${entry.line}`;
}
