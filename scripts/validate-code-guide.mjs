import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const REQUIRED_KEYS = [
  "taskbar.brand",
  "taskbar.title",
  "taskbar.language",
  "taskbar.undo",
  "taskbar.new",
  "taskbar.import",
  "taskbar.export",
  "taskbar.library",
  "taskbar.settings",
  "taskbar.fullscreen",
  "machine.gauge",
  "machine.needle-pitch",
  "yarn.length-current",
  "yarn.ply-color",
  "yarn.ply-visible",
  "yarn.ply-diameter",
  "yarn.ply-length",
  "yarn.texture-import",
  "yarn.texture-original-color",
  "yarn.texture-enable",
  "yarn.texture-background",
  "yarn.texture-size",
  "yarn.texture-strength",
  "yarn.texture-fuzz",
  "yarn.texture-clear",
  "yarn.performance",
  "stitch.symbol",
  "canvas.width",
  "canvas.height",
  "cam.yarn-sequence",
  "cam.symbols",
  "cam.grid",
  "needle.start",
  "needle.input",
  "needle.apply",
  "palette.edit",
  "palette.add",
  "palette.label",
  "palette.delete",
  "palette.color",
  "palette.shuffle",
  "palette.randomize",
  "chart.zoom-out",
  "chart.zoom-range",
  "chart.zoom-in",
  "chart.fit",
  "needle.yarn-sequence",
  "needle.symbols",
  "needle.grid",
  "layout.split",
  "layout.editor-split",
  "simulation.canvas",
  "simulation.flip",
  "simulation.zoom-out",
  "simulation.zoom-range",
  "simulation.zoom-in",
  "simulation.fit",
];
const requiredFiles = [
  "src/codeGuide/mode.js",
  "src/codeGuide/codeGuideState.js",
  "src/codeGuide/codeGuideDefinitions.json",
  "src/codeGuide/generatedLines.json",
  "src/codeGuide/codeGuideMap.js",
  "src/codeGuide/codeGuideOverlay.js",
  "src/codeGuide/codeGuideEvents.js",
];
const failures = [];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`missing required file: ${relativePath}`);
  }
}

function readObject(relativePath) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      failures.push(`${relativePath} must contain a non-array object`);
      return null;
    }
    return value;
  } catch (error) {
    failures.push(`${relativePath} must contain valid JSON: ${error.message}`);
    return null;
  }
}

const definitionsPath = "src/codeGuide/codeGuideDefinitions.json";
const generatedLinesPath = "src/codeGuide/generatedLines.json";
const definitions = fs.existsSync(path.join(root, definitionsPath))
  ? readObject(definitionsPath)
  : null;
const generatedLines = fs.existsSync(path.join(root, generatedLinesPath))
  ? readObject(generatedLinesPath)
  : null;

if (!fs.existsSync(path.join(root, "scripts/generate-code-guide-lines.mjs"))) {
  failures.push("missing code guide line generator: scripts/generate-code-guide-lines.mjs");
}

let packageJson = null;
try {
  packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
} catch (error) {
  failures.push(`package.json must contain valid JSON: ${error.message}`);
}
if (
  packageJson?.scripts?.["generate:code-guide-lines"] !==
  "node scripts/generate-code-guide-lines.mjs"
) {
  failures.push(
    "package.json must define generate:code-guide-lines as node scripts/generate-code-guide-lines.mjs"
  );
}

if (definitions && generatedLines) {
  const definitionFields = [
    "title",
    "file",
    "anchor",
    "symbol",
    "status",
    "description",
    "changeHint",
  ];
  const requiredKeySet = new Set(REQUIRED_KEYS);

  for (const key of REQUIRED_KEYS) {
    const entry = definitions[key];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      failures.push(`missing code guide definition: ${key}`);
      continue;
    }

    for (const field of definitionFields) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        failures.push(`${key}.${field} must be a non-empty string`);
      }
    }
    if (entry.status !== "implemented" && entry.status !== "missing") {
      failures.push(`${key}.status must be implemented or missing`);
    }

    if (typeof entry.file === "string" && entry.file.trim()) {
      const sourcePath = path.join(root, entry.file);
      if (!fs.existsSync(sourcePath)) {
        failures.push(`${key}.file does not exist: ${entry.file}`);
      } else if (typeof entry.anchor === "string" && entry.anchor.trim()) {
        const sourceLines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);
        const actualLine =
          sourceLines.findIndex((line) => line.includes(entry.anchor)) + 1;
        if (actualLine === 0) {
          failures.push(`${key}.anchor not found in ${entry.file}: ${entry.anchor}`);
        } else if (generatedLines[key] !== actualLine) {
          failures.push(
            `${key} generated line must equal ${actualLine}, received ${generatedLines[key]}`
          );
        }
      }
    }

    if (!Number.isInteger(generatedLines[key]) || generatedLines[key] < 1) {
      failures.push(`${key} generated line must be a positive integer`);
    }
  }

  for (const key of Object.keys(definitions)) {
    if (!requiredKeySet.has(key)) {
      failures.push(`unknown code guide definition: ${key}`);
    }
  }
  for (const key of Object.keys(generatedLines)) {
    if (!requiredKeySet.has(key)) {
      failures.push(`unknown generated code guide line: ${key}`);
    }
  }

  const chartFit = definitions["chart.fit"];
  if (chartFit && typeof chartFit === "object" && !Array.isArray(chartFit)) {
    const chartFitGuidance = [
      chartFit.title,
      chartFit.description,
      chartFit.changeHint,
    ].join(" ");
    const semanticRequirements = [
      [/16\s*[×xX]\s*16/, "must describe the 16×16 initial view"],
      [/共享/, "must describe the shared editor viewport"],
      [
        /(?:重置|恢复)[^。；]*(?:平移|原点)|chartPan[^。；]*(?:0\s*[,，]\s*0|\{\s*x\s*:\s*0\s*,\s*y\s*:\s*0\s*\})/,
        "must describe resetting the shared pan to the origin",
      ],
    ];

    for (const [pattern, message] of semanticRequirements) {
      if (!pattern.test(chartFitGuidance)) {
        failures.push(`chart.fit ${message}`);
      }
    }
    if (/完整图案[^。；]*居中/.test(chartFitGuidance)) {
      failures.push(
        "chart.fit must not claim that fitChart centers the complete pattern"
      );
    }
  }
}

function requireSourceTokens(relativePath, tokens) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    return;
  }

  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) {
      failures.push(`${relativePath} must include ${token}`);
    }
  }
}

function requireSourcePattern(relativePath, pattern, description) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    return;
  }

  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  if (!pattern.test(source)) {
    failures.push(`${relativePath} ${description}`);
  }
}

function cssRuleBody(source, selector) {
  for (const match of source.matchAll(/([^{}]+)\{([^}]*)\}/gs)) {
    const ruleSelector = match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (ruleSelector === selector) return match[2];
  }
  return null;
}

function requireCssDeclaration(ruleBody, selector, property, valuePattern) {
  if (ruleBody === null || !new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*${valuePattern}\\s*(?:;|$)`, "i").test(ruleBody)) {
    failures.push(`styles.css ${selector} must set ${property} to ${valuePattern}`);
  }
}

requireSourceTokens("src/codeGuide/codeGuideOverlay.js", [
  "data-code-guide-ui",
  "createVSCodeHref",
  "复制位置",
  "当前未实现",
  "尚未建立源码说明",
]);
requireSourceTokens("src/codeGuide/codeGuideOverlay.js", [
  "重叠画布源码层",
  "cam.yarn-sequence",
  "三角座纱线序列层",
  "cam.symbols",
  "三角座针法层",
  "needle.yarn-sequence",
  "排针纱线序列层",
  "needle.symbols",
  "排针针法层",
]);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /import\s*\{[\s\S]*?clearActiveCodeGuideKey[\s\S]*?getActiveCodeGuideKey[\s\S]*?setActiveCodeGuideKey[\s\S]*?\}\s*from\s*["']\.\/codeGuideState["']/,
  "must import and use setActiveCodeGuideKey for drawer layer selection"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /const\s+CHART_LAYER_OPTIONS\s*=\s*\[[\s\S]*?cam\.yarn-sequence[\s\S]*?cam\.symbols[\s\S]*?cam\.grid[\s\S]*?needle\.yarn-sequence[\s\S]*?needle\.symbols[\s\S]*?needle\.grid[\s\S]*?\]\s*;/,
  "must define the six active cam and needle canvas layer options"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /function\s+isChartLayerKey\s*\(\s*key\s*\)\s*\{[\s\S]*?CHART_LAYER_OPTIONS\.some\([\s\S]*?\.key\s*={2,3}\s*key[\s\S]*?\)[\s\S]*?\}/,
  "must identify chart layers from the selector option array"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /isChartLayerKey\(\s*key\s*\)\s*\?\s*html`[\s\S]*?code-guide-layer-selector[\s\S]*?CHART_LAYER_OPTIONS\.map\([\s\S]*?setActiveCodeGuideKey\([\s\S]*?\.key\s*\)[\s\S]*?:\s*nothing/,
  "must render the layer selector only for an active chart layer and switch state from its buttons"
);
if (fs.existsSync(path.join(root, "src/codeGuide/codeGuideOverlay.js"))) {
  const overlaySource = fs.readFileSync(
    path.join(root, "src/codeGuide/codeGuideOverlay.js"),
    "utf8"
  );
  const copySourceTextarea =
    /<textarea\b(?=[^>]*\bclass=["']code-guide-copy-source["'])(?=[^>]*(?:\breadonly\b|\.readOnly\s*=\s*\$\{\s*true\s*\}))[^>]*>/s;
  if (!copySourceTextarea.test(overlaySource)) {
    failures.push(
      "src/codeGuide/codeGuideOverlay.js copy-source textarea must be readonly"
    );
  }
}
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /let\s+cachedGuideMode(?:\s*=\s*undefined)?\s*;/,
  "must cache the guide-mode result in the overlay module"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /function\s+isGuideModeEnabled\s*\(\s*\)\s*\{[\s\S]*?cachedGuideMode\s*={1,3}\s*undefined[\s\S]*?cachedGuideMode\s*=\s*isCodeGuideMode\(\)[\s\S]*?return\s+cachedGuideMode\s*;/,
  "must lazily evaluate and reuse the cached guide-mode result"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /let\s+copyRequestId\s*=\s*0\s*;/,
  "must track clipboard request generations"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /async\s+function\s+copySourcePath\s*\(\s*path\s*,\s*key\s*\)[\s\S]*?const\s+requestId\s*=\s*\+\+copyRequestId\s*;/,
  "copySourcePath must capture its key and a new request generation"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /requestId\s*!==\s*copyRequestId\s*\|\|\s*getActiveCodeGuideKey\(\)\s*!==\s*key/,
  "must guard clipboard completion by request generation and active key"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /key\s*!==\s*previousKey[\s\S]*?\+\+copyRequestId/,
  "must invalidate clipboard requests when the active key changes"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /function\s+closeCodeGuide\s*\([^)]*\)\s*\{[\s\S]*?\+\+copyRequestId[\s\S]*?clearActiveCodeGuideKey\(\)/,
  "closeCodeGuide must invalidate clipboard requests before closing"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /role=["']dialog["'][\s\S]*?aria-modal=["']true["'][\s\S]*?aria-labelledby=["']code-guide-title["']/,
  "drawer must be an aria-modal dialog labelled by code-guide-title"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /<h2\s+id=["']code-guide-title["']>/,
  "drawer title must expose the stable code-guide-title id"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /<button[\s\S]*?class=["']code-guide-close["'][\s\S]*?aria-label=["'][^"']+["'][\s\S]*?autofocus/,
  "close button must have its class, accessible label, and autofocus"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /let\s+previousFocus\s*=\s*null\s*;[\s\S]*?let\s+focusRequestId\s*=\s*0\s*;/,
  "must track previous focus and scheduled focus generations"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /previousFocus\s*=\s*document\.activeElement[\s\S]*?requestAnimationFrame\([\s\S]*?\.code-guide-close[\s\S]*?\.focus\(\)/,
  "must capture previous focus and focus the close button after opening"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /function\s+closeCodeGuide\s*\([^)]*\)\s*\{[\s\S]*?\+\+focusRequestId[\s\S]*?previousFocus\?\.isConnected[\s\S]*?previousFocus\.focus\(\)[\s\S]*?previousFocus\s*=\s*null/,
  "closeCodeGuide must invalidate scheduled focus and restore connected previous focus"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /function\s+handleDrawerKeydown\s*\([^)]*\)\s*\{[\s\S]*?key\s*={1,3}\s*["']Escape["'][\s\S]*?closeCodeGuide\(\)[\s\S]*?\}/,
  "drawer keydown handler must close on Escape"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /@keydown=\$\{handleDrawerKeydown\}/,
  "drawer must bind its Escape keydown handler"
);
requireSourcePattern(
  "src/codeGuide/codeGuideOverlay.js",
  /aria-live=["']polite["'][^>]*>[\s\S]*?\$\{copyLabel\}/,
  "copy feedback must be inside an aria-live polite region"
);
requireSourcePattern(
  "src/codeGuide/codeGuideEvents.js",
  /import\s*\{\s*getActiveCodeGuideKey\s*,\s*setActiveCodeGuideKey\s*,?\s*\}\s*from\s*["']\.\/codeGuideState["']/,
  "must import getActiveCodeGuideKey and setActiveCodeGuideKey from codeGuideState"
);
requireSourcePattern(
  "src/codeGuide/codeGuideEvents.js",
  /const\s+BLOCKED_EVENTS\s*=\s*\[\s*["']pointerdown["']\s*,\s*["']pointerup["']\s*,\s*["']click["']\s*,\s*["']input["']\s*,\s*["']change["']\s*,\s*["']wheel["']\s*,\s*["']contextmenu["']\s*,?\s*\]\s*;/,
  "must define the exact blocked event list"
);
requireSourcePattern(
  "src/codeGuide/codeGuideEvents.js",
  /function\s+guideTarget\s*\(\s*event\s*\)\s*\{[\s\S]*?event\.target\s+instanceof\s+Element[\s\S]*?\.closest\(\s*["']\[data-code-guide-ui\]["']\s*\)[\s\S]*?return\s+null[\s\S]*?\.closest\(\s*["']\[data-code-guide-key\]["']\s*\)[\s\S]*?\}/,
  "guideTarget must ignore non-elements and guide UI before selecting an annotated control"
);
requireSourcePattern(
  "src/codeGuide/codeGuideEvents.js",
  /function\s+blockGuideEvent\s*\(\s*event\s*\)\s*\{[\s\S]*?guideTarget\(\s*event\s*\)[\s\S]*?preventDefault\(\)[\s\S]*?stopImmediatePropagation\(\)[\s\S]*?setActiveCodeGuideKey\(\s*[^)]*\.dataset\.codeGuideKey\s*\)[\s\S]*?\}/,
  "blockGuideEvent must cancel annotated controls and activate their data-code-guide-key"
);
requireSourcePattern(
  "src/codeGuide/codeGuideEvents.js",
  /getActiveCodeGuideKey\(\)\s*!==\s*target\.dataset\.codeGuideKey[\s\S]*?setActiveCodeGuideKey\(\s*target\.dataset\.codeGuideKey\s*\)/,
  "must avoid setting an already-active code guide key"
);
requireSourcePattern(
  "src/codeGuide/codeGuideEvents.js",
  /function\s+blockGuideKeyboard\s*\(\s*event\s*\)\s*\{[\s\S]*?event\.key[\s\S]*?["']Enter["'][\s\S]*?event\.key[\s\S]*?["'] ["'][\s\S]*?blockGuideEvent\(\s*event\s*\)[\s\S]*?\}/,
  "blockGuideKeyboard must delegate Enter and Space to blockGuideEvent"
);
requireSourcePattern(
  "src/codeGuide/codeGuideEvents.js",
  /export\s+function\s+initCodeGuideEvents\s*\(\s*documentTarget\s*=\s*document\s*\)\s*\{[\s\S]*?BLOCKED_EVENTS[\s\S]*?addEventListener\(\s*[^,]+\s*,\s*blockGuideEvent\s*,\s*\{\s*capture\s*:\s*true\s*,\s*passive\s*:\s*false\s*,?\s*\}\s*\)[\s\S]*?addEventListener\(\s*["']keydown["']\s*,\s*blockGuideKeyboard\s*,\s*\{\s*capture\s*:\s*true\s*,?\s*\}\s*\)[\s\S]*?\}/,
  "initCodeGuideEvents must register cancelable blocked events and keydown in capture phase"
);
requireSourceTokens("src/index.js", [
  'import { isCodeGuideMode } from "./codeGuide/mode.js"',
  'import { initCodeGuideEvents } from "./codeGuide/codeGuideEvents.js"',
  'import { subscribeCodeGuideState } from "./codeGuide/codeGuideState.js"',
  'data-code-guide-key="layout.split"',
  'data-code-guide-key="layout.editor-split"',
]);
requireSourcePattern(
  "src/index.js",
  /if\s*\(\s*isCodeGuideMode\(\)\s*\)\s*\{[\s\S]*?subscribeCodeGuideState\(\s*appRenderer\.syncState\s*\)[\s\S]*?addEventListener\(\s*["']pagehide["']\s*,[\s\S]*?\{\s*once\s*:\s*true\s*,?\s*\}\s*\)/,
  "must subscribe the guide renderer and release it when the page closes"
);
requireSourcePattern(
  "src/index.js",
  /if\s*\(\s*isCodeGuideMode\(\)\s*\)\s*\{[\s\S]*?initCodeGuideEvents\(\)[\s\S]*?\}\s*else\s*\{[\s\S]*?isMobile\(\)\s*\?\s*initTouch\([^)]*\)\s*:\s*initKeyboard\([^)]*\)/,
  "must initialize guide interception instead of keyboard or touch business listeners in guide mode"
);
requireSourcePattern(
  "src/index.js",
  /Split\(\["#chart-pane",\s*"#sim-pane"\][\s\S]*?Split\(\["#cam-editor-pane",\s*"#needle-editor-pane"\][\s\S]*?if\s*\(\s*isCodeGuideMode\(\)\s*\)/,
  "must initialize both Split layouts before choosing code-guide or ordinary interactions"
);
requireSourceTokens("src/views/view.js", [
  'import { codeGuideOverlay } from "../codeGuide/codeGuideOverlay"',
  "codeGuideOverlay()",
]);
requireSourceTokens("styles.css", [".code-guide-drawer"]);
if (fs.existsSync(path.join(root, "styles.css"))) {
  const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const badgeRule = cssRuleBody(styles, ".code-guide-badge");
  if (badgeRule === null) {
    failures.push("styles.css must define .code-guide-badge");
  } else {
    requireCssDeclaration(badgeRule, ".code-guide-badge", "position", "fixed");
    requireCssDeclaration(badgeRule, ".code-guide-badge", "top", "[^;]+");
    requireCssDeclaration(badgeRule, ".code-guide-badge", "left", "50%");
    requireCssDeclaration(
      badgeRule,
      ".code-guide-badge",
      "transform",
      "translateX\\(\\s*-50%\\s*\\)"
    );
    requireCssDeclaration(badgeRule, ".code-guide-badge", "pointer-events", "none");
    requireCssDeclaration(badgeRule, ".code-guide-badge", "z-index", "1200");
    if (/(?:^|;)\s*(?:right|bottom)\s*:/i.test(badgeRule)) {
      failures.push("styles.css .code-guide-badge must not use right or bottom placement");
    }
  }

  const drawerDdRule = cssRuleBody(styles, ".code-guide-drawer dd");
  requireCssDeclaration(drawerDdRule, ".code-guide-drawer dd", "margin", "0");
}

if (requiredFiles.every((relativePath) => fs.existsSync(path.join(root, relativePath)))) {
  let server;
  try {
    const { createServer } = await import("vite");
    server = await createServer({
      root,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const mode = await server.ssrLoadModule("/src/codeGuide/mode.js");
    const state = await server.ssrLoadModule("/src/codeGuide/codeGuideState.js");
    const map = await server.ssrLoadModule("/src/codeGuide/codeGuideMap.js");
    const overlay = await server.ssrLoadModule(
      "/src/codeGuide/codeGuideOverlay.js"
    );
    const events = await server.ssrLoadModule(
      "/src/codeGuide/codeGuideEvents.js"
    );

    if (typeof mode.isCodeGuideMode !== "function") {
      failures.push("mode.js must export isCodeGuideMode as a function");
    } else {
      if (mode.isCodeGuideMode("?codeGuide=1") !== true) {
        failures.push('isCodeGuideMode("?codeGuide=1") must return true');
      }
      if (mode.isCodeGuideMode("?codeGuide=0") !== false) {
        failures.push('isCodeGuideMode("?codeGuide=0") must return false');
      }
    }

    for (const api of [
      "getActiveCodeGuideKey",
      "setActiveCodeGuideKey",
      "clearActiveCodeGuideKey",
      "subscribeCodeGuideState",
    ]) {
      if (typeof state[api] !== "function") {
        failures.push(`codeGuideState.js must export ${api} as a function`);
      }
    }

    if (
      typeof state.getActiveCodeGuideKey === "function" &&
      typeof state.setActiveCodeGuideKey === "function" &&
      typeof state.clearActiveCodeGuideKey === "function" &&
      typeof state.subscribeCodeGuideState === "function"
    ) {
      if (state.getActiveCodeGuideKey() !== null) {
        failures.push("code guide state must initially be null");
      }
      state.setActiveCodeGuideKey("sample");
      if (state.getActiveCodeGuideKey() !== "sample") {
        failures.push("code guide state set/get must preserve the active key");
      }
      state.clearActiveCodeGuideKey();
      if (state.getActiveCodeGuideKey() !== null) {
        failures.push("clearActiveCodeGuideKey() must restore null");
      }
    }

    if (
      map.CODE_GUIDE_MAP === null ||
      typeof map.CODE_GUIDE_MAP !== "object" ||
      Array.isArray(map.CODE_GUIDE_MAP)
    ) {
      failures.push("codeGuideMap.js must export CODE_GUIDE_MAP as an object");
    }
    for (const api of [
      "getCodeGuideEntry",
      "absoluteCodeGuidePath",
      "createVSCodeHref",
    ]) {
      if (typeof map[api] !== "function") {
        failures.push(`codeGuideMap.js must export ${api} as a function`);
      }
    }

    if (typeof map.getCodeGuideEntry === "function") {
      if (map.getCodeGuideEntry("missing") !== null) {
        failures.push('getCodeGuideEntry("missing") must return null');
      }
      if (map.getCodeGuideEntry("constructor") !== null) {
        failures.push('getCodeGuideEntry("constructor") must return null');
      }
    }

    if (typeof overlay.codeGuideOverlay !== "function") {
      failures.push(
        "codeGuideOverlay.js must export codeGuideOverlay as a function"
      );
    }
    if (typeof events.initCodeGuideEvents !== "function") {
      failures.push(
        "codeGuideEvents.js must export initCodeGuideEvents as a function"
      );
    } else {
      const registrations = [];
      const documentTarget = {
        addEventListener(type, callback, options) {
          registrations.push({ type, callback, options });
        },
      };
      const previousElement = globalThis.Element;

      try {
        class FakeElement {
          constructor(kind, codeGuideKey = null) {
            this.kind = kind;
            this.dataset = { codeGuideKey };
            this.overlayAncestor = kind === "overlay" ? {} : null;
          }

          closest(selector) {
            if (selector === "[data-code-guide-ui]") {
              return this.overlayAncestor;
            }
            if (selector === "[data-code-guide-key]") {
              return this.kind === "annotated" ? this : null;
            }
            return null;
          }
        }

        globalThis.Element = FakeElement;
        events.initCodeGuideEvents(documentTarget);

        const expectedRegistrations = [
          ["pointerdown", { capture: true, passive: false }],
          ["pointerup", { capture: true, passive: false }],
          ["click", { capture: true, passive: false }],
          ["input", { capture: true, passive: false }],
          ["change", { capture: true, passive: false }],
          ["wheel", { capture: true, passive: false }],
          ["contextmenu", { capture: true, passive: false }],
          ["keydown", { capture: true }],
        ];
        const registrationsMatch =
          registrations.length === expectedRegistrations.length &&
          registrations.every(
            (registration, index) =>
              registration.type === expectedRegistrations[index][0] &&
              typeof registration.callback === "function" &&
              JSON.stringify(registration.options) ===
                JSON.stringify(expectedRegistrations[index][1])
          );
        if (!registrationsMatch) {
          failures.push(
            "initCodeGuideEvents() must register the exact blocked-event and keydown listeners"
          );
        }

        const callbackFor = (type) =>
          registrations.find((registration) => registration.type === type)
            ?.callback;
        const fakeEvent = (target, key) => {
          const event = {
            target,
            prevented: false,
            propagationStopped: false,
            preventDefault() {
              this.prevented = true;
            },
            stopImmediatePropagation() {
              this.propagationStopped = true;
            },
          };
          if (key !== undefined) event.key = key;
          return event;
        };
        const assertBlocked = (event, description) => {
          if (!event.prevented || !event.propagationStopped) {
            failures.push(`${description} must prevent default and stop propagation`);
          }
        };
        const assertUnblocked = (event, description) => {
          if (event.prevented || event.propagationStopped) {
            failures.push(`${description} must not block the event`);
          }
        };

        const click = callbackFor("click");
        const keydown = callbackFor("keydown");
        if (typeof click === "function" && typeof keydown === "function") {
          state.clearActiveCodeGuideKey();
          const annotatedClick = fakeEvent(
            new FakeElement("annotated", "annotated-click")
          );
          click(annotatedClick);
          assertBlocked(annotatedClick, "annotated click");
          if (state.getActiveCodeGuideKey() !== "annotated-click") {
            failures.push("annotated click must activate its code guide key");
          }

          state.setActiveCodeGuideKey("unchanged");
          const overlayClick = fakeEvent(new FakeElement("overlay"));
          click(overlayClick);
          assertUnblocked(overlayClick, "overlay click");
          if (state.getActiveCodeGuideKey() !== "unchanged") {
            failures.push("overlay click must leave code guide state unchanged");
          }

          const plainClick = fakeEvent(new FakeElement("plain"));
          click(plainClick);
          assertUnblocked(plainClick, "plain click");
          if (state.getActiveCodeGuideKey() !== "unchanged") {
            failures.push("plain click must leave code guide state unchanged");
          }

          const enterKeydown = fakeEvent(
            new FakeElement("annotated", "keyboard-enter"),
            "Enter"
          );
          keydown(enterKeydown);
          assertBlocked(enterKeydown, "annotated Enter keydown");
          if (state.getActiveCodeGuideKey() !== "keyboard-enter") {
            failures.push("annotated Enter keydown must activate its code guide key");
          }

          const spaceKeydown = fakeEvent(
            new FakeElement("annotated", "keyboard-space"),
            " "
          );
          keydown(spaceKeydown);
          assertBlocked(spaceKeydown, "annotated Space keydown");
          if (state.getActiveCodeGuideKey() !== "keyboard-space") {
            failures.push("annotated Space keydown must activate its code guide key");
          }

          const otherKeydown = fakeEvent(
            new FakeElement("annotated", "keyboard-other"),
            "Escape"
          );
          keydown(otherKeydown);
          assertUnblocked(otherKeydown, "other annotated keydown");
          if (state.getActiveCodeGuideKey() !== "keyboard-space") {
            failures.push("other annotated keydown must leave code guide state unchanged");
          }

          const nonElementClick = fakeEvent({});
          click(nonElementClick);
          assertUnblocked(nonElementClick, "non-Element click target");
          if (state.getActiveCodeGuideKey() !== "keyboard-space") {
            failures.push("non-Element click target must leave code guide state unchanged");
          }

          state.setActiveCodeGuideKey("same-key");
          const sameKeyClick = fakeEvent(
            new FakeElement("annotated", "same-key")
          );
          click(sameKeyClick);
          assertBlocked(sameKeyClick, "same-key annotated click");
          if (state.getActiveCodeGuideKey() !== "same-key") {
            failures.push("same-key annotated click must preserve the active key");
          }
          state.clearActiveCodeGuideKey();
        }
      } finally {
        if (previousElement === undefined) {
          delete globalThis.Element;
        } else {
          globalThis.Element = previousElement;
        }
      }
    }

    const sampleEntry = { file: "src/views/taskbar.js", line: 11 };
    if (
      typeof map.absoluteCodeGuidePath === "function" &&
      map.absoluteCodeGuidePath(sampleEntry) !==
        "C:/Users/liuchen/Desktop/GitHub/knitscape/src/views/taskbar.js"
    ) {
      failures.push("absoluteCodeGuidePath() must return the exact absolute sample path");
    }
    if (
      typeof map.createVSCodeHref === "function" &&
      map.createVSCodeHref(sampleEntry) !==
        "vscode://file/C:/Users/liuchen/Desktop/GitHub/knitscape/src/views/taskbar.js:11"
    ) {
      failures.push("createVSCodeHref() must return the exact sample VS Code href");
    }
  } catch (error) {
    failures.push(`unable to execute code guide modules: ${error.message}`);
  } finally {
    await server?.close();
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log("PASS: code guide core contract is present.");
