import { html, nothing } from "lit-html";

import { isCodeGuideMode } from "./mode";
import {
  clearActiveCodeGuideKey,
  getActiveCodeGuideKey,
  setActiveCodeGuideKey,
} from "./codeGuideState";
import {
  absoluteCodeGuidePath,
  createVSCodeHref,
  getCodeGuideEntry,
} from "./codeGuideMap";

const CHART_LAYER_OPTIONS = [
  { key: "chart.yarn-sequence", label: "纱线序列层" },
  { key: "chart.yarn-color", label: "纱线颜色层" },
  { key: "chart.symbols", label: "针法符号层" },
  { key: "chart.grid", label: "网格层" },
];

let copyLabel = "复制位置";
let previousKey = null;
let copyRequestId = 0;
let previousFocus = null;
let focusRequestId = 0;
let cachedGuideMode;

function isChartLayerKey(key) {
  return CHART_LAYER_OPTIONS.some((layer) => layer.key === key);
}

function isGuideModeEnabled() {
  if (cachedGuideMode === undefined) {
    cachedGuideMode = isCodeGuideMode();
  }
  return cachedGuideMode;
}

function closeCodeGuide() {
  ++copyRequestId;
  ++focusRequestId;
  clearActiveCodeGuideKey();
  if (previousFocus?.isConnected) {
    previousFocus.focus();
  }
  previousFocus = null;
}

function handleDrawerKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeCodeGuide();
  }
}

function missingEntry(key) {
  return {
    file: "src/codeGuide/codeGuideDefinitions.json",
    line: 1,
    status: "missing",
    symbol: key,
    title: "尚未建立源码说明",
    description: `源码说明映射中尚未包含“${key}”。`,
    changeHint: "请在 codeGuideDefinitions.json 中为这个键添加源码说明。",
  };
}

async function copyWithClipboard(path) {
  try {
    const write = globalThis.navigator?.clipboard?.writeText;
    if (typeof write !== "function") return false;

    return await Promise.race([
      write.call(globalThis.navigator.clipboard, path).then(
        () => true,
        () => false
      ),
      new Promise((resolve) => setTimeout(() => resolve(false), 500)),
    ]);
  } catch {
    return false;
  }
}

async function copySourcePath(path, key) {
  const requestId = ++copyRequestId;
  let copied = false;
  const source = document.querySelector(".code-guide-copy-source");

  if (source) {
    source.value = path;
    source.select();
    source.setSelectionRange(0, path.length);
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
  }

  if (!copied) copied = await copyWithClipboard(path);
  if (requestId !== copyRequestId || getActiveCodeGuideKey() !== key) return;
  copyLabel = copied ? "已复制" : "请手动复制上方路径";
}

export function codeGuideOverlay() {
  if (!isGuideModeEnabled()) return nothing;

  const key = getActiveCodeGuideKey();
  if (key !== previousKey) {
    ++copyRequestId;
    copyLabel = "复制位置";
    if (key !== null && previousKey === null) {
      previousFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const requestId = ++focusRequestId;
      requestAnimationFrame(() => {
        if (
          requestId !== focusRequestId ||
          getActiveCodeGuideKey() !== key
        ) {
          return;
        }
        document.querySelector(".code-guide-close")?.focus();
      });
    }
    previousKey = key;
  }

  const entry = key ? getCodeGuideEntry(key) ?? missingEntry(key) : null;
  const absolutePath = entry ? absoluteCodeGuidePath(entry) : null;
  const sourceLocation = entry ? `${absolutePath}:${entry.line}` : null;
  const implemented = entry?.status === "implemented";

  return html`
    <div class="code-guide-badge" data-code-guide-ui>源码说明模式</div>
    ${entry
      ? html`
          <div class="code-guide-backdrop" data-code-guide-ui></div>
          <aside
            class="code-guide-drawer"
            data-code-guide-ui
            role="dialog"
            aria-modal="true"
            aria-labelledby="code-guide-title"
            @keydown=${handleDrawerKeydown}
            aria-label="源码说明">
            <header class="code-guide-drawer-header">
              <div>
                <p
                  class="code-guide-status ${implemented
                    ? "implemented"
                    : "missing"}">
                  ${implemented ? "当前已实现" : "当前未实现"}
                </p>
                <h2 id="code-guide-title">${entry.title}</h2>
              </div>
              <button
                class="code-guide-close"
                type="button"
                aria-label="Close code guide"
                autofocus
                @click=${closeCodeGuide}>
                关闭
              </button>
            </header>
            <div class="code-guide-drawer-body">
              ${isChartLayerKey(key)
                ? html`
                    <section class="code-guide-layer-selector">
                      <h3>重叠画布源码层</h3>
                      <div class="code-guide-layer-options">
                        ${CHART_LAYER_OPTIONS.map(
                          (layer) => html`
                            <button
                              class="code-guide-layer-option ${layer.key === key
                                ? "current"
                                : ""}"
                              type="button"
                              aria-current=${layer.key === key
                                ? "true"
                                : nothing}
                              @click=${() =>
                                setActiveCodeGuideKey(layer.key)}>
                              ${layer.label}
                            </button>
                          `
                        )}
                      </div>
                    </section>
                  `
                : nothing}
              <p>${entry.description}</p>
              <dl>
                <dt>文件</dt>
                <dd>${absolutePath}</dd>
                <dt>行号</dt>
                <dd>第 ${entry.line} 行</dd>
                <dt>符号</dt>
                <dd>${entry.symbol}</dd>
              </dl>
              <p class="code-guide-hint">${entry.changeHint}</p>
              <div class="code-guide-actions">
                <button
                  type="button"
                  @click=${() => copySourcePath(sourceLocation, key)}>
                  <span aria-live="polite">${copyLabel}</span>
                </button>
                <a href=${createVSCodeHref(entry)}>在 VS Code 中打开</a>
              </div>
              <textarea
                class="code-guide-copy-source"
                readonly
                .value=${sourceLocation}
                aria-hidden="true"
                tabindex="-1"></textarea>
            </div>
          </aside>
        `
      : nothing}
  `;
}
