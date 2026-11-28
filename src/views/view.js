import { html } from "lit-html";
import { when } from "lit-html/directives/when.js";
import { dispatch, GLOBAL_STATE } from "../state";

import { taskbar } from "./taskbar";
import { downloadModal } from "./downloadModal";
import { libraryModal } from "./libraryModal";
import { settingsModal } from "./settingsModal";
import { chartTools } from "./chartTools";
import { debugPane } from "./debugPane";
import { leftBar } from "./leftBar";
import { repeatCanvas } from "./repeatCanvas";
import { repeatTools } from "./repeatTools";
import { chartEditorToolbar } from "./chartEditorToolbar";
import { needleArrangementBar } from "./needleArrangementBar";
import { singleJerseyCamProgramEditor } from "./singleJerseyCamProgramEditor";
import { yarnLibraryWorkspace } from "./yarnLibrary.js";
import { pbrWorkbench } from "./pbrWorkbench.js";
import { fabricTextureWorkbench } from "./fabricTextureWorkbench.js";
import { simulationView } from "../components/runSimulation";
import { syncDocumentLanguage } from "../i18n";
import { codeGuideOverlay } from "../codeGuide/codeGuideOverlay";

function selectedChartCell() {
  const selected = GLOBAL_STATE.selectedChartCell;
  if (!selected) return null;

  const cellSize = GLOBAL_STATE.scale / devicePixelRatio;
  return html`<div
    class="selected-chart-cell"
    style="left:${selected.x * cellSize}px; top:${selected.y *
    cellSize}px; width:${cellSize}px; height:${cellSize}px;"></div>`;
}

export function view() {
  syncDocumentLanguage(GLOBAL_STATE.language);
  const patternWorkspaceClass =
    GLOBAL_STATE.workspaceMode === "pattern" ? "" : "workspace-hidden";
  const machineWorkspaceClass =
    GLOBAL_STATE.workspaceMode === "machine" ? "" : "workspace-hidden";

  return html`
    ${when(GLOBAL_STATE.showDownload, downloadModal)}
    ${when(GLOBAL_STATE.showLibrary, libraryModal)}
    ${when(GLOBAL_STATE.showSettings, settingsModal)} ${taskbar()}

    <div id="site" class="${GLOBAL_STATE.workspaceMode === "yarns" ? "yarn-library-active" : ""} ${GLOBAL_STATE.workbenchMode === "pbr25d" ? "pbr-workbench-active" : ""} ${GLOBAL_STATE.workbenchMode === "fabricTexture" ? "fabric-texture-active" : ""}">
      <div id="chart-pane">
        <div id="chart-layout">
          ${leftBar()}
          <main id="chart-workspace">
            <div
              id="pattern-workspace"
              class="workspace-panel ${patternWorkspaceClass}"
              aria-hidden=${GLOBAL_STATE.workspaceMode !== "pattern"}>
              ${chartEditorToolbar()}
              ${when(GLOBAL_STATE.editingRepeat > -1, repeatTools)}
              <div id="desktop">
                <div
                  id="canvas-transform-group"
                  style="transform: translate(${Math.floor(
                    GLOBAL_STATE.chartPan.x
                  )}px, ${Math.floor(GLOBAL_STATE.chartPan.y)}px);">
                  <div id="yarn-sequence">
                    <canvas id="yarn-sequence-canvas" data-code-guide-key="chart.yarn-sequence"></canvas>
                  </div>
                  <canvas id="yarn-color-canvas" data-code-guide-key="chart.yarn-color"></canvas>
                  <canvas id="symbol-canvas" data-code-guide-key="chart.symbols"></canvas>
                  <canvas id="grid" class="grid-canvas" data-code-guide-key="chart.grid"></canvas>
                  ${selectedChartCell()} ${repeatCanvas()}
                </div>
              </div>
              ${chartTools()}
            </div>
            <div
              id="machine-workspace"
              class="workspace-panel ${machineWorkspaceClass}"
              aria-hidden=${GLOBAL_STATE.workspaceMode !== "machine"}>
              ${needleArrangementBar()} ${singleJerseyCamProgramEditor()}
            </div>
          </main>
        </div>
      </div>
      ${simulationView()}
      <main id="yarn-library-workspace"
        class=${GLOBAL_STATE.workspaceMode === "yarns" ? "" : "workspace-hidden"}
        aria-hidden=${GLOBAL_STATE.workspaceMode !== "yarns"}>
        ${yarnLibraryWorkspace()}
      </main>
      ${pbrWorkbench()}
      ${fabricTextureWorkbench()}
    </div>
    ${when(GLOBAL_STATE.debug, debugPane)}
    ${codeGuideOverlay()}
  `;
}
