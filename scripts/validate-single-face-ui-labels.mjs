import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

const styles = read("styles.css");
const translations = read("src/i18n/translations.js");
if (!/Microsoft YaHei/.test(styles)) {
  failures.push("styles.css must set the UI font to Microsoft YaHei.");
}

function expectTranslation(label, description) {
  if (!translations.includes(label)) {
    failures.push(`translation label missing for ${description}: ${label}`);
  }
}

function expectSourceKey(source, key, description) {
  if (!source.includes(key)) {
    failures.push(`${description} translation key missing: ${key}`);
  }
}

const sourceFiles = [
  "src/views/taskbar.js",
  "src/views/chartEditorToolbar.js",
  "src/views/leftBar.js",
  "src/views/yarnLengthReadout.js",
  "src/views/yarnPlyPanel.js",
  "src/views/yarnPicker.js",
  "src/views/repeatTools.js",
  "src/views/repeatCanvas.js",
  "src/views/chartTools.js",
  "src/views/libraryModal.js",
  "src/views/debugPane.js",
  "src/views/downloadModal.js",
  "src/views/view.js",
  "src/components/runSimulation.js",
];

for (const file of sourceFiles) {
  const source = read(file);
  if (/<button[\s\S]*?<i\s+class=/.test(source)) {
    failures.push(`${file} must not render FontAwesome-only button icons.`);
  }
}

const taskbar = read("src/views/taskbar.js");
if (!taskbar.includes("companyLogo")) {
  failures.push("taskbar must render the company logo.");
}
expectTranslation("针织实验室（单面布）", "taskbar title");
if (!taskbar.includes('t("taskbar.title"')) {
  failures.push("taskbar title must use the taskbar.title translation key.");
}
if (/github|源码|branchwelder/i.test(taskbar)) {
  failures.push("taskbar must not expose GitHub source button or link.");
}
for (const [key, label] of [
  ["taskbar.undo", "撤销"],
  ["taskbar.new", "新建"],
  ["taskbar.import", "导入"],
  ["taskbar.export", "导出"],
  ["taskbar.library", "图库"],
  ["taskbar.settings", "设置"],
  ["taskbar.fullscreen", "全屏"],
]) {
  expectSourceKey(taskbar, key, "taskbar");
  expectTranslation(label, key);
}

const leftBar = [
  "src/views/leftBar.js",
  "src/views/yarnLengthReadout.js",
  "src/views/yarnPlyPanel.js",
  "src/views/yarnPicker.js",
]
  .map(read)
  .join("\n");
const chartEditorToolbar = read("src/views/chartEditorToolbar.js");
for (const [key, label] of [
  ["left.addRepeat", "添加花型"],
  ["yarns.editPalette", "编辑色纱"],
  ["yarns.addColor", "添加颜色"],
  ["yarns.shuffle", "打乱颜色"],
  ["yarns.randomize", "随机颜色"],
]) {
  expectSourceKey(leftBar, key, "left bar");
  expectTranslation(label, key);
}
if (!chartEditorToolbar.includes("SYMBOL_ICON_URLS")) {
  failures.push("central symbol picker must use image assets for its button icons.");
}
if (!/<img[\s\S]*class="symbol-preview-image"/.test(chartEditorToolbar)) {
  failures.push("central symbol picker must render symbol previews as images.");
}
if (/<canvas\s+class="symbol-preview"/.test(chartEditorToolbar)) {
  failures.push("central symbol picker must not render canvas previews.");
}
if (!leftBar.includes("importYarnScanTexture")) {
  failures.push("left bar must include an import handler for scanned yarn texture images.");
}
if (!leftBar.includes("yarn-texture-import-button")) {
  failures.push("each yarn ply card must expose a scanned texture import button.");
}
if (!leftBar.includes("yarn-texture-preview")) {
  failures.push("each yarn ply card must show the processed scanned texture preview.");
}
for (const [key, label] of [
  ["yarnTexture.useOriginalColor", "使用扫描原色"],
  ["yarnTexture.enable", "启用纹理"],
  ["yarnTexture.size", "纹理尺寸"],
  ["texturePerformance.label", "预览性能"],
  ["texturePerformance.auto", "自动"],
  ["texturePerformance.quality", "质量"],
  ["texturePerformance.solid", "纯色"],
  ["yarnTexture.background", "去背景"],
  ["yarnTexture.textureStrength", "纹理强度"],
  ["yarnTexture.fuzzStrength", "毛羽强度"],
  ["yarnTexture.clear", "清除纹理"],
]) {
  expectSourceKey(leftBar, key, "scan yarn texture UI");
  expectTranslation(label, key);
}
if (/真实\s*PBR|完整\s*PBR/.test(leftBar)) {
  failures.push("left bar must not claim the 2D scan texture brush is full PBR.");
}
for (const asset of [
  "src/assets/symbols/knit.svg",
  "src/assets/symbols/purl.svg",
  "src/assets/symbols/slip.svg",
  "src/assets/symbols/tuck.svg",
]) {
  if (!fs.existsSync(path.join(root, asset))) {
    failures.push(`left symbol image asset missing: ${asset}`);
  }
}
for (const [key, label] of [
  ["symbols.knit", "成圈（下）"],
  ["symbols.purl", "成圈（上）"],
  ["symbols.slip", "平针"],
  ["symbols.tuck", "半针"],
]) {
  if (!translations.includes(`"${key}": "${label}"`)) {
    failures.push(`translation label mismatch for ${key}: ${label}`);
  }
}
for (const [asset, pathSignature] of [
  ["src/assets/symbols/knit.svg", "M16 48L32 16L48 48"],
  ["src/assets/symbols/purl.svg", "M16 16L32 48L48 16"],
  ["src/assets/symbols/slip.svg", "M12 32H52"],
  ["src/assets/symbols/tuck.svg", "M18 18H46V46H18Z"],
]) {
  const source = read(asset);
  if (!source.includes(pathSignature)) {
    failures.push(`${asset} must use the requested stitch symbol path: ${pathSignature}`);
  }
  if (/<text\b/.test(source)) {
    failures.push(`${asset} must draw the stitch symbol as vector paths, not text.`);
  }
}

const drawSymbolsSource = read("src/components/drawSymbols.js");
const drawRepeatsSource = read("src/components/drawRepeats.js");
for (const [file, source] of [
  ["src/components/drawSymbols.js", drawSymbolsSource],
  ["src/components/drawRepeats.js", drawRepeatsSource],
]) {
  if (!source.includes("SYMBOL_PATHS") || !source.includes("ctx.stroke(SYMBOL_PATHS[symbol])")) {
    failures.push(`${file} must keep Path2D drawing for the central stitch canvas.`);
  }
}

const uiButton = read("src/views/uiButton.js");
if (!uiButton.includes("data:image/svg+xml")) {
  failures.push("uiButton helper must provide local SVG image assets.");
}

const repeatCanvas = read("src/views/repeatCanvas.js");
for (const label of ["缩放", "高度", "宽度"]) {
  if (repeatCanvas.includes(label)) {
    failures.push(`repeat canvas handle label should be icon-only: ${label}`);
  }
}
if (/buttonIcon|buttonIconSrc|button-image|<img|<i\s+class=/.test(repeatCanvas)) {
  failures.push("repeat canvas handles must not render text or icons.");
}

const viewSource = read("src/views/view.js");
if (viewSource.includes("color-dragger") || viewSource.includes("拖动")) {
  failures.push("left-bottom yarn sequence drag button must be removed.");
}

const stateSource = read("src/state.js");
const simulationViewSource = read("src/components/runSimulation.js");
const simulationPointerSource = read("src/events/simulationPointerInteraction.js");
if (
  stateSource.includes("simRotation") ||
  simulationViewSource.includes("simRotation") ||
  simulationPointerSource.includes("simRotation")
) {
  failures.push("simulation preview must not keep plane-rotation state.");
}
if (/rotate[XY]\(|perspective|preserve-3d/.test(simulationViewSource)) {
  failures.push("simulation preview must render as a flat 2D plane without rotation transform.");
}
if (!/dispatch\(\{\s*simPan:\s*\{\s*x:\s*0,\s*y:\s*0\s*\},\s*simScale:\s*1\s*\}\)/s.test(simulationViewSource)) {
  failures.push("simulation preview reset must only clear pan and zoom.");
}
if (
  simulationPointerSource.includes("rotatePreview") ||
  simulationPointerSource.includes("RIGHT_BUTTON_MASK") ||
  simulationPointerSource.includes("contextmenu")
) {
  failures.push("simulation pointer interaction must not expose preview rotation or right-button panning.");
}
if (
  !/e\.button\s*!={1,2}\s*0/.test(simulationPointerSource) ||
  !simulationPointerSource.includes("pan(e, simContainer)")
) {
  failures.push("simulation pointer interaction must use the left button for flat preview panning.");
}
if (
  styles.includes("perspective") ||
  styles.includes("transform-style: preserve-3d") ||
  /rotate[XY]\(/.test(styles)
) {
  failures.push("simulation preview styles must not imply 3D rotation for the flat preview.");
}

for (const [file, source] of [
  ["src/index.js", read("src/index.js")],
  [
    "src/events/colorSequencePointerInteraction.js",
    read("src/events/colorSequencePointerInteraction.js"),
  ],
  [
    "src/events/colorSequenceTouchInteraction.js",
    read("src/events/colorSequenceTouchInteraction.js"),
  ],
]) {
  if (source.includes("color-dragger") || source.includes("resizeColorCanvas")) {
    failures.push(`${file} must not bind the removed yarn sequence drag button.`);
  }
}
for (const [file, source] of [
  ["src/views/repeatCanvas.js", repeatCanvas],
  ["src/events/repeatPointerInteraction.js", read("src/events/repeatPointerInteraction.js")],
  ["src/events/repeatTouchInteraction.js", read("src/events/repeatTouchInteraction.js")],
  ["styles.css", styles],
]) {
  if (source.includes("resize-repeat")) {
    failures.push(`${file} must not include the canvas drag button.`);
  }
}

if (!repeatCanvas.includes("repeat-area-dragger y-axis")) {
  failures.push("repeat canvas must render the height boundary dragger.");
}
if (!repeatCanvas.includes("repeat-area-dragger x-axis")) {
  failures.push("repeat canvas must render the width boundary dragger.");
}

const repeatPointerInteraction = read("src/events/repeatPointerInteraction.js");
const repeatTouchInteraction = read("src/events/repeatTouchInteraction.js");
const repeatTools = read("src/views/repeatTools.js");
const repeatEditingTools = read("src/actions/repeatEditingTools.js");
const constants = read("src/constants.js");
const stateSourceForDefaults = read("src/state.js");
const importersSourceForDefaults = read("src/actions/importers.js");
const generateChartSourceForDefaults = read("src/components/generateChart.js");

for (const [file, source] of [
  ["src/views/repeatTools.js", repeatTools],
  ["src/actions/repeatEditingTools.js", repeatEditingTools],
  ["src/constants.js", constants],
  ["src/events/repeatPointerInteraction.js", repeatPointerInteraction],
  ["src/events/repeatTouchInteraction.js", repeatTouchInteraction],
  ["styles.css", styles],
]) {
  if (
    source.includes("move-repeat") ||
    source.includes('activeTool == "move"') ||
    source.includes("function moveRepeat") ||
    source.includes("shift:") ||
    source.includes("function shift") ||
    source.includes("平移") ||
    source.includes("移动")
  ) {
    failures.push(`${file} must not expose unrelated repeat shift/move tools.`);
  }
}
for (const [file, source] of [
  ["src/events/repeatPointerInteraction.js", repeatPointerInteraction],
  ["src/events/repeatTouchInteraction.js", repeatTouchInteraction],
]) {
  if (!source.includes("repeat-area-dragger") || !source.includes("editRepeatArea")) {
    failures.push(`${file} must handle manual repeat area boundary dragging.`);
  }
}

if (!fs.existsSync(path.join(root, "src", "assets", "company-logo.jpg"))) {
  failures.push("company logo must be copied into src/assets/company-logo.jpg.");
}

if (
  !constants.includes('DEFAULT_STITCH_SYMBOL = "purl"') ||
  !constants.includes("DEFAULT_STITCH_SYMBOL_INDEX")
) {
  failures.push("default central stitch symbol must be purl/up-stitch.");
}
for (const pathSignature of [
  "M 0.25 0.75 L 0.5 0.25 L 0.75 0.75",
  "M 0.25 0.25 L 0.5 0.75 L 0.75 0.25",
  "M 0.2 0.5 L 0.8 0.5",
  "M 0.25 0.25 L 0.75 0.25 L 0.75 0.75 L 0.25 0.75 Z",
]) {
  if (!constants.includes(pathSignature)) {
    failures.push(`central stitch Path2D missing requested symbol path: ${pathSignature}`);
  }
}
for (const [file, source] of [
  ["src/state.js", stateSourceForDefaults],
  ["src/actions/importers.js", importersSourceForDefaults],
  ["src/components/generateChart.js", generateChartSourceForDefaults],
  ["src/views/leftBar.js", leftBar],
]) {
  if (!source.includes("DEFAULT_STITCH_SYMBOL_INDEX")) {
    failures.push(`${file} must use DEFAULT_STITCH_SYMBOL_INDEX for blank/default stitch cells.`);
  }
}
if (
  /chart:\s*Bimp\.empty\(48,\s*60,\s*0\)/.test(stateSourceForDefaults) ||
  /Bimp\.empty\(30,\s*40,\s*0\)/.test(importersSourceForDefaults) ||
  /Bimp\.empty\([^)]*,\s*0\s*\)/.test(generateChartSourceForDefaults)
) {
  failures.push("blank/default central stitch chart must not default to knit/down-stitch index 0.");
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: single-face UI labels and images are configured.");
